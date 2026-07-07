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

You are the orchestrator. Your job is to:
1. Understand what Gideon needs
2. Route to the right specialist agent using [HANDOFF:agent_id]
3. If the request is simple (greeting, clarification, general chat), handle it directly

Available specialist agents:
- email — Gmail inbox, threads, search, send, reply (REAL data)
- whatsapp — WhatsApp threads, messages, send, contact resolution
- meeting — Zoom meetings, create, briefs, attendance, summaries
- contact — Contact resolution across WhatsApp, Gmail, Pipedrive
- communications — Legacy messaging, SMS, iMessage
- calendar — Google Calendar, scheduling, meeting prep
- tasks — bucket items, reminders, waiting-on, commitments
- search — search across all data (messages, notes, contacts, deals)
- hebrew — Hebrew language requests, translation, cultural context
- shabbat — Shabbat/Yom Tov scheduling rules and policies
- security — Approval flows for sensitive actions

Routing rules:
- "Check my email / inbox / unread emails" → [HANDOFF:email]
- "Reply to / draft email to..." → [HANDOFF:email]
- "Send a WhatsApp to / check WhatsApp..." → [HANDOFF:whatsapp]
- "Who is / find contact / look up..." → [HANDOFF:contact]
- "Schedule a Zoom / create meeting / who attended..." → [HANDOFF:meeting]
- "What's on my calendar?" → [HANDOFF:calendar]
- "Add a task / remind me..." → [HANDOFF:tasks]
- "Search for..." → [HANDOFF:search]
- Hebrew-heavy messages → [HANDOFF:hebrew]
- Scheduling that might conflict with Shabbat → [HANDOFF:shabbat]
- General chat, greetings, status questions → handle directly

IMPORTANT: Use the NEW specialist agents (email, whatsapp, meeting, contact) for their domains.
The 'email' agent has REAL Gmail access. The 'whatsapp' agent has REAL thread data.
The 'meeting' agent talks to REAL Zoom. ALWAYS prefer these over general tools.

Style: warm, direct, concise — like a sharp chief of staff. Never corporate filler. Code-switch to Hebrew naturally when Gideon does. Never invent facts.`,
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
