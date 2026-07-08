/**
 * Nora Agent System — Shared Types & Runtime
 * 
 * OpenAI-style agents with tools, handoffs, sessions, guardrails, and tracing.
 * Each specialist agent has focused responsibilities and tools.
 */

// ── Agent Types ────────────────────────────────────────────────────────────────

export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (params: Record<string, unknown>, context: AgentContext) => Promise<string>
}

export interface AgentDefinition {
  id: string
  name: string
  description: string
  systemPrompt: string
  tools: AgentTool[]
  /** Other agents this agent can hand off to */
  canHandoffTo: string[]
  /** Whether this agent needs approval before executing side effects */
  requiresApproval?: boolean
  /** Maximum tool rounds before forcing a text response */
  maxToolRounds?: number
}

export interface AgentContext {
  /** Conversation session ID for persistence */
  sessionId: string
  /** Current user message */
  userMessage: string
  /** Conversation history */
  history: AgentMessage[]
  /** Live context data (calendar, emails, WhatsApp counts, etc.) */
  liveContext?: Record<string, unknown>
  /** The originating agent (for handoff tracing) */
  sourceAgent?: string
  /** User language preference */
  language: 'en' | 'he'
  /** Accumulated tool results for tracing */
  toolTrace: ToolTraceEntry[]
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  agentId?: string
  toolName?: string
  timestamp?: string
}

export interface ToolTraceEntry {
  agentId: string
  toolName: string
  input: Record<string, unknown>
  output: string
  durationMs: number
  timestamp: Date
}

export interface HandoffRequest {
  targetAgentId: string
  reason: string
  context?: Record<string, unknown>
}

export interface AgentResult {
  reply: string
  language: 'en' | 'he'
  agentId: string
  handoff?: HandoffRequest
  navigation?: {
    path: string
    reason?: string
  }
  toolTrace: ToolTraceEntry[]
  /** Actions that need user approval before execution */
  pendingApprovals?: PendingApproval[]
}

export interface PendingApproval {
  id: string
  action: string
  description: string
  agentId: string
  params: Record<string, unknown>
}

// ── Guardrails ─────────────────────────────────────────────────────────────────

export interface GuardrailCheck {
  name: string
  check: (input: string, context: AgentContext) => GuardrailResult
}

export interface GuardrailResult {
  passed: boolean
  reason?: string
  /** If true, the input is modified before processing */
  sanitized?: string
}

/** Basic prompt injection detector */
export const promptInjectionGuardrail: GuardrailCheck = {
  name: 'prompt_injection',
  check: (input: string) => {
    const INJECTION_PATTERNS = [
      /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules)/i,
      /you\s+are\s+now\s+(a|an|my)\s+/i,
      /system\s*:\s*/i,
      /\[INST\]/i,
      /\<\|im_start\|\>/i,
      /disregard\s+(your|all|the)\s+/i,
      /forget\s+(everything|your|all|what)/i,
      /new\s+instructions?\s*:/i,
      /override\s+(system|safety|security)/i,
    ]

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        return {
          passed: false,
          reason: `Potential prompt injection detected: ${pattern.source}`,
        }
      }
    }

    return { passed: true }
  },
}

/** Sensitive action guardrail — flags actions that need approval */
export const sensitiveActionGuardrail: GuardrailCheck = {
  name: 'sensitive_action',
  check: (input: string) => {
    const SENSITIVE_PATTERNS = [
      /send\s+(all|every|bulk)\s+(message|email|whatsapp)/i,
      /delete\s+(all|every|the)\s+/i,
      /cancel\s+(all|every|the)\s+meeting/i,
      /transfer\s+(money|funds|wire)/i,
      /share\s+(password|credential|secret|key)/i,
    ]

    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(input)) {
        return {
          passed: false,
          reason: 'This action requires explicit approval',
        }
      }
    }

    return { passed: true }
  },
}

// ── Agent Registry ─────────────────────────────────────────────────────────────

const agentRegistry = new Map<string, AgentDefinition>()

export function registerAgent(agent: AgentDefinition): void {
  agentRegistry.set(agent.id, agent)
}

export function getAgent(id: string): AgentDefinition | undefined {
  return agentRegistry.get(id)
}

export function getAllAgents(): AgentDefinition[] {
  return Array.from(agentRegistry.values())
}

// ── Agent Execution Runtime ────────────────────────────────────────────────────

const HEBREW_RE = /[א-ת]/

/**
 * Execute an agent with tool-use loop.
 * Uses the gateway's AI capability for LLM calls.
 */
export async function executeAgent(
  agentDef: AgentDefinition,
  context: AgentContext,
): Promise<AgentResult> {
  const maxRounds = agentDef.maxToolRounds ?? 3

  // Build messages for the LLM
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: agentDef.systemPrompt },
    ...context.history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: context.userMessage },
  ]

  // Add live context if available
  if (context.liveContext) {
    const contextStr = JSON.stringify(context.liveContext).slice(0, 8000)
    messages[0].content += `\n\nLIVE CONTEXT:\n${contextStr}`
  }

  // Tool-use loop using Anthropic directly (primary AI provider)
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Fallback to OpenAI or Groq when Anthropic is unavailable
    const openaiKey = process.env.OPENAI_API_KEY
    const groqKey = process.env.GROQ_API_KEY
    const fallbackKey = (openaiKey?.startsWith('sk-') ? openaiKey : null) || groqKey
    
    if (!fallbackKey) {
      return {
        reply: 'AI provider not configured. Please add ANTHROPIC_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY.',
        language: 'en',
        agentId: agentDef.id,
        toolTrace: context.toolTrace,
      }
    }

    // Use OpenAI/Groq as fallback (no tool-use, plain chat)
    const isGroq = !openaiKey?.startsWith('sk-')
    const endpoint = isGroq
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions'
    const model = isGroq ? 'llama-3.1-70b-versatile' : 'gpt-4o-mini'

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fallbackKey}` },
        body: JSON.stringify({ model, messages }),
      })
      if (res.ok) {
        const json = await res.json()
        const reply = json.choices?.[0]?.message?.content || ''
        return {
          reply,
          language: HEBREW_RE.test(reply) ? 'he' : 'en',
          agentId: agentDef.id,
          toolTrace: context.toolTrace,
        }
      }
    } catch (err) {
      console.error(`[agent:${agentDef.id}] fallback AI failed:`, (err as Error).message)
    }

    return {
      reply: 'All AI providers are currently unavailable. Please try again.',
      language: 'en',
      agentId: agentDef.id,
      toolTrace: context.toolTrace,
    }
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })

  // Convert tools to Anthropic format
  const anthropicTools = agentDef.tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object' as const,
      properties: t.parameters,
      required: Object.keys(t.parameters).filter(k => {
        const prop = t.parameters[k] as { required?: boolean }
        return prop?.required !== false
      }),
    },
  }))

  // Separate system from messages for Anthropic API
  const systemContent = messages.filter(m => m.role === 'system').map(m => m.content).join('\n')
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  // Choose model based on complexity
  const COMPLEX_RE = /\b(analy[sz]e|compare|strategy|why|forecast|break\s?down|recommend|explain)/i
  const model = COMPLEX_RE.test(context.userMessage) ? 'claude-sonnet-4-20250514' : 'claude-haiku-4-5-20251001'

  let response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemContent,
    messages: chatMessages,
    ...(anthropicTools.length > 0 ? { tools: anthropicTools } : {}),
  })

  const anthropicMessages = [...chatMessages]
  let rounds = 0

  while (response.stop_reason === 'tool_use' && rounds < maxRounds) {
    rounds++

    const toolBlocks = response.content.filter(
      (b) => b.type === 'tool_use',
    ) as Array<{ type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }>

    if (!toolBlocks.length) break

    // Execute tools
    const toolResults = await Promise.all(
      toolBlocks.map(async (block) => {
        const tool = agentDef.tools.find(t => t.name === block.name)
        const start = Date.now()

        let result: string
        if (tool) {
          try {
            result = await tool.execute(block.input, context)
          } catch (err) {
            result = JSON.stringify({ error: (err as Error).message })
          }
        } else {
          result = JSON.stringify({ error: `Unknown tool: ${block.name}` })
        }

        context.toolTrace.push({
          agentId: agentDef.id,
          toolName: block.name,
          input: block.input,
          output: result.slice(0, 500),
          durationMs: Date.now() - start,
          timestamp: new Date(),
        })

        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: result,
        }
      }),
    )

    anthropicMessages.push({ role: 'assistant', content: response.content as unknown as string })
    anthropicMessages.push({ role: 'user', content: toolResults as unknown as string })

    response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: systemContent,
      messages: anthropicMessages,
      ...(anthropicTools.length > 0 ? { tools: anthropicTools } : {}),
    })
  }

  // Extract text reply
  const textBlocks = response.content.filter((b) => b.type === 'text') as Array<{ type: 'text'; text: string }>
  const reply = textBlocks.map(b => b.text).join('\n').trim()

  const language: 'en' | 'he' = HEBREW_RE.test(reply) ? 'he' : 'en'

  // Check for handoff requests in the reply
  let handoff: HandoffRequest | undefined
  const handoffMatch = reply.match(/\[HANDOFF:(\w+)\]\s*(.*)/i)
  if (handoffMatch && agentDef.canHandoffTo.includes(handoffMatch[1])) {
    handoff = {
      targetAgentId: handoffMatch[1],
      reason: handoffMatch[2] || 'Agent requested handoff',
    }
  }

  return {
    reply: handoff ? reply.replace(/\[HANDOFF:\w+\].*/, '').trim() : reply,
    language,
    agentId: agentDef.id,
    handoff,
    toolTrace: context.toolTrace,
  }
}
