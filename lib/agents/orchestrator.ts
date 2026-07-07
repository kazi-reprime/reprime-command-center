/**
 * Nora Orchestrator Agent
 * 
 * The central dispatcher. Classifies user intent and routes to the
 * appropriate specialist agent. Handles handoff chains and session persistence.
 */

import {
  type AgentDefinition,
  type AgentContext,
  type AgentResult,
  type AgentMessage,
  registerAgent,
  getAgent,
  executeAgent,
  promptInjectionGuardrail,
  sensitiveActionGuardrail,
} from './types'

// ── Specialist Agent Imports (lazy) ────────────────────────────────────────────

async function ensureAgentsRegistered(): Promise<void> {
  if (getAgent('communications')) return // Already registered

  const mods = await Promise.allSettled([
    import('./communications'),
    import('./calendar'),
    import('./tasks'),
    import('./search'),
    import('./hebrew'),
    import('./shabbat'),
    // P0 specialist agents
    import('./email-agent'),
    import('./whatsapp-agent'),
    import('./meeting-agent'),
    import('./contact-agent'),
    import('./security-agent'),
  ])

  for (const m of mods) {
    if (m.status === 'rejected') {
      console.warn('[orchestrator] agent module failed to load:', m.reason)
    }
  }
}

// ── Orchestrator Definition ────────────────────────────────────────────────────

const orchestratorDef: AgentDefinition = {
  id: 'orchestrator',
  name: 'Nora Orchestrator',
  description: 'Routes requests to specialist agents based on intent classification',
  systemPrompt: `You are Nora, Gideon Gratsiani's executive assistant at RePrime Group (institutional commercial real estate).

TEAM: Gideon Gratsiani (Co-Founder, Miami/NYC), Chaim Abrahams (Co-Founder, NYC), Steve Philipp (AVP Acquisitions & Tech), Colonel Yaron Sitbon (Israel Ops), Adir Yonasi (VP Investor Relations), Kazi Musharraf (AI Engineer).

YOUR IDENTITY: nora@reprime.com | +1 (917) 970-3154 | Keypad: 770770

DOMAIN: Cross-border CRE investments (US/Israel), 1031 exchanges, LP structuring, institutional acquisitions.

You are the orchestrator. Route to specialist agents using [HANDOFF:agent_id]:

Specialist agents:
- email — Gmail inbox, threads, search, send, reply (REAL Gmail access for g@reprime.com + g@floridastatetrust.com)
- whatsapp — WhatsApp threads, messages, send, unread counts (REAL Timelines.ai data, 305 + 718 panels)
- meeting — Zoom meetings: list, create, briefs, attendance (REAL Zoom API)
- contact — Cross-platform contact search (WhatsApp, Gmail, Pipedrive CRM, team directory)
- calendar — Google Calendar, scheduling, meeting prep
- tasks — bucket items, reminders, to-dos
- search — cross-source search (notes, contacts, deals)
- hebrew — Hebrew language, translation
- shabbat — Shabbat/Yom Tov rules
- security — Approval flows

Routing rules:
- Emails, inbox, unread → [HANDOFF:email]
- WhatsApp, messages, text → [HANDOFF:whatsapp]
- Zoom, meeting, schedule call → [HANDOFF:meeting]
- Who is, find contact, team members, staff → [HANDOFF:contact]
- Calendar, today's schedule → [HANDOFF:calendar]
- Task, remind, to-do → [HANDOFF:tasks]
- Search, find, look up → [HANDOFF:search]
- Hebrew text → [HANDOFF:hebrew]
- Shabbat timing → [HANDOFF:shabbat]
- General chat, greetings → handle directly

CRITICAL: NEVER say "please wait" or "I can't access that." Route to the right agent and let them handle it. All agents have REAL data access.

Style: warm, direct, concise — sharp chief of staff. Code-switch Hebrew naturally. Never invent facts.`,
  tools: [],
  canHandoffTo: ['email', 'whatsapp', 'meeting', 'contact', 'communications', 'calendar', 'tasks', 'search', 'hebrew', 'shabbat', 'security'],
  maxToolRounds: 1,
}

// Register the orchestrator
registerAgent(orchestratorDef)

// ── Public API ─────────────────────────────────────────────────────────────────

const MAX_HANDOFF_DEPTH = 3

/**
 * Process a user message through the Nora multi-agent system.
 * 
 * Flow:
 * 1. Run guardrails on input
 * 2. Execute orchestrator
 * 3. If handoff requested, execute target agent
 * 4. Return final result with full trace
 */
export async function processMessage(params: {
  message: string
  history?: AgentMessage[]
  liveContext?: Record<string, unknown>
  sessionId?: string
}): Promise<AgentResult> {
  const {
    message,
    history = [],
    liveContext,
    sessionId = `session-${Date.now()}`,
  } = params

  // Ensure all specialist agents are registered
  await ensureAgentsRegistered()

  // Run guardrails
  const injectionCheck = promptInjectionGuardrail.check(message, {} as AgentContext)
  if (!injectionCheck.passed) {
    return {
      reply: "I can't process that request. Let me know how I can help with your actual work.",
      language: 'en',
      agentId: 'orchestrator',
      toolTrace: [],
    }
  }

  const sensitiveCheck = sensitiveActionGuardrail.check(message, {} as AgentContext)

  // Build initial context
  const HEBREW_RE = /[א-ת]/
  const context: AgentContext = {
    sessionId,
    userMessage: message,
    history,
    liveContext,
    language: HEBREW_RE.test(message) ? 'he' : 'en',
    toolTrace: [],
  }

  // Execute orchestrator
  let result = await executeAgent(orchestratorDef, context)
  let depth = 0

  // Follow handoff chain
  while (result.handoff && depth < MAX_HANDOFF_DEPTH) {
    depth++
    const targetAgent = getAgent(result.handoff.targetAgentId)

    if (!targetAgent) {
      console.warn(`[orchestrator] handoff target not found: ${result.handoff.targetAgentId}`)
      break
    }

    console.log(
      `[orchestrator] handoff: ${result.agentId} → ${targetAgent.id} (reason: ${result.handoff.reason})`,
    )

    // Build new context for the target agent
    const handoffContext: AgentContext = {
      ...context,
      sourceAgent: result.agentId,
      toolTrace: result.toolTrace,
      // Prepend orchestrator's partial reply as context
      history: [
        ...context.history,
        ...(result.reply ? [{ role: 'assistant' as const, content: result.reply, agentId: result.agentId }] : []),
      ],
    }

    result = await executeAgent(targetAgent, handoffContext)
  }

  // Flag sensitive actions for approval
  if (!sensitiveCheck.passed) {
    result.pendingApprovals = [{
      id: `approval-${Date.now()}`,
      action: 'sensitive_action',
      description: sensitiveCheck.reason || 'This action requires approval',
      agentId: result.agentId,
      params: { originalMessage: message },
    }]
  }

  return result
}

// ── Session Persistence (optional) ─────────────────────────────────────────────

/**
 * Persist a conversation turn to the database.
 * Best-effort — never blocks the response.
 */
export async function persistConversation(
  sessionId: string,
  userMessage: string,
  result: AgentResult,
): Promise<void> {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const supabase = createServiceClient()

    const userLanguage = /[א-ת]/.test(userMessage) ? 'he' : 'en'

    await supabase.from('nora_chat_messages').insert([
      { role: 'user', content: userMessage, language: userLanguage },
      { role: 'assistant', content: result.reply, language: result.language },
    ])

    // Persist to vector memory
    try {
      const { getEmbedding } = await import('@/lib/embeddings')
      const embedding = await getEmbedding(`${userMessage}\n\nAssistant: ${result.reply}`)
      const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'
      await supabase.from('nora_memory').insert({
        org_id: DEFAULT_ORG_ID,
        content: `User: ${userMessage}\nAssistant: ${result.reply}`,
        embedding,
      })
    } catch {
      // Memory persistence is best-effort
    }
  } catch (err) {
    console.error('[orchestrator] persist failed:', (err as Error).message)
  }
}
