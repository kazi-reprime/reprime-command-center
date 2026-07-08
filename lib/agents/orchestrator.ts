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

const navigateTo: AgentTool = {
  name: 'navigate_to',
  description: 'Navigate to a specific page in the Command Center (e.g., /cockpit/pipeline, /cockpit/investors).',
  parameters: {
    path: { type: 'string', description: 'The relative path to navigate to' },
    reason: { type: 'string', description: 'Reason for navigation (optional)' },
  },
  async execute(params) {
    return JSON.stringify({ action: 'navigate', path: params.path, reason: params.reason })
  },
}

const listSystemModules: AgentTool = {
  name: 'list_system_modules',
  description: 'List all available modules and features in the Command Center.',
  parameters: {},
  async execute() {
    return JSON.stringify({
      modules: [
        { id: 'dashboard', path: '/cockpit', label: 'Executive Dashboard', description: 'Overview of all systems' },
        { id: 'whatsapp', path: '/cockpit/comms', label: 'WhatsApp Hub', description: 'Unified messaging for 305/718 lines' },
        { id: 'gmail', path: '/cockpit/email', label: 'Gmail Priority', description: 'Triaged inbox and thread management' },
        { id: 'calendar', path: '/cockpit/calendar', label: 'Calendar / Zoom', description: 'Meeting scheduling and briefings' },
        { id: 'pipeline', path: '/cockpit/pipeline', label: 'Deal Pipeline', description: 'Pipedrive deal tracking and CRM' },
        { id: 'investors', path: '/cockpit/investors', label: 'Investors', description: 'LP management and capital tracking' },
        { id: 'properties', path: '/cockpit/properties', label: 'Properties', description: 'Asset management and acquisitions' },
        { id: 'tasks', path: '/cockpit/tasks', label: 'Tasks / Bucket', description: 'To-dos and reminders' },
        { id: 'notes', path: '/cockpit/notes', label: 'Notes', description: 'Quick capture and search' },
      ]
    })
  },
}

const orchestratorDef: AgentDefinition = {
  id: 'orchestrator',
  name: 'Nora Orchestrator',
  description: 'Primary interface for the RePrime Command Center. Controls all systems and navigates the UI.',
  systemPrompt: `You are Nora, Gideon Gratsiani's elite personal AI assistant and Chief of Staff at RePrime Group.
  
Gideon is the absolute authority. Your goal is to give him TOTAL CONTROL over the Command Center through voice and chat.

IDENTITY & AUTHORITY:
- You are the "Operating System" of this dashboard. You don't just report—you MANAGE and CONTROL.
- You have full access to WhatsApp, Gmail, Zoom, Pipedrive CRM, and the UI itself.
- If Gideon asks to see something (e.g., "show me the deals"), use navigate_to to take him there.
- You are an all-seeing, all-handling assistant. Never say "I can't access that." Use your specialist agents.

CORE CAPABILITIES:
1. UI CONTROL: Use navigate_to to switch between modules based on Gideon's focus.
2. COMMUNICATION: Use [HANDOFF:whatsapp] or [HANDOFF:email] to send/receive messages.
3. INTELLIGENCE: Use [HANDOFF:contact] to understand anyone Gideon mentions.
4. SCHEDULING: Use [HANDOFF:meeting] or [HANDOFF:calendar] to manage his time.

TEAM: Gideon Gratsiani (Founder), Chaim Abrahams (Founder), Steve Philipp (Tech/Acquisitions), Adir Yonasi (Investors), Kazi Musharraf (The Engineer who built your brain).

Style: Sharp, elite, efficient. Code-switch Hebrew naturally. Keep spoken replies short but powerful.`,
  tools: [navigateTo, listSystemModules],
  canHandoffTo: ['email', 'whatsapp', 'meeting', 'contact', 'communications', 'calendar', 'tasks', 'search', 'hebrew', 'shabbat', 'security'],
  maxToolRounds: 2,
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

  // Recall relevant memories (best-effort, non-blocking if it fails)
  let recalledMemories: string[] = []
  try {
    const { recallMemory } = await import('./session-manager')
    recalledMemories = await recallMemory(message, 3)
  } catch {
    // Memory recall is best-effort
  }

  // Build initial context
  const HEBREW_RE = /[א-ת]/
  const contextWithMemory = liveContext
    ? { ...liveContext, ...(recalledMemories.length > 0 ? { recalled_memories: recalledMemories } : {}) }
    : recalledMemories.length > 0 ? { recalled_memories: recalledMemories } : undefined

  const context: AgentContext = {
    sessionId,
    userMessage: message,
    history,
    liveContext: contextWithMemory,
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
