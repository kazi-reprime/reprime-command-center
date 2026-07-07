import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { getTodayEvents } from '@/lib/google/calendar'

export const dynamic = 'force-dynamic'

const HEBREW_RE = /[א-ת]/

type ChatTurn = {
  role: 'user' | 'assistant'
  content: string
}

type ChatRequestBody = {
  message?: string
  history?: ChatTurn[]
  context?: unknown
}

const NORA_SYSTEM = `You are Nora, Gideon Gratsiani's executive assistant at RePrime Group (institutional commercial real estate). You speak plainly, warmly, concise — like a sharp chief of staff, never corporate filler. You know his business. You can read the live context provided (WhatsApp threads, Pipedrive deals, today's calendar, the morning brief) and answer specific questions grounded in it. If asked to draft a reply or take an action, draft it but note it needs his approval. Code-switch to Hebrew naturally when he does. Never invent facts not in the context — if you don't have the data, say so.

You have tools to look up live data. Use them proactively when Gideon asks about his calendar, emails, WhatsApp messages, tasks, or the daily briefing. Don't say you can't access something — call the tool first.`

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const OPUS_MODEL = 'claude-opus-4-6'
const COMPLEX_RE = /\b(analy[sz]e|compare|strategy|why|forecast|model|break\s?down|pros and cons|trade-?offs?|recommend)\b/i

/** Max tool-use round-trips before we force a text reply. */
const MAX_TOOL_ROUNDS = 3

// ---------------------------------------------------------------------------
// Tool definitions (Anthropic tool_use format)
// ---------------------------------------------------------------------------
const NORA_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'read_calendar_today',
    description:
      "Fetch today's calendar events from Google Calendar. Returns an array of meetings with title, start/end times, Zoom links, and attendees.",
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'read_emails',
    description:
      'Fetch the highest-priority triaged emails. Returns scored emails with sender, subject, snippet, score, and Gmail link.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Max emails to return (default 10, max 30).',
        },
        min_score: {
          type: 'number',
          description: 'Minimum triage score (default 5).',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_whatsapp',
    description:
      'Search WhatsApp threads by contact name. Returns matching threads with contact name, phone, panel, unread count, and last message preview.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_name: {
          type: 'string',
          description: 'Full or partial contact name to search for.',
        },
      },
      required: ['contact_name'],
    },
  },
  {
    name: 'create_note',
    description:
      "Create a note in Gideon's notes. Use when he asks you to jot something down, remember something, or save information.",
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Short title for the note.',
        },
        body: {
          type: 'string',
          description: 'Full note content.',
        },
      },
      required: ['title', 'body'],
    },
  },
  {
    name: 'create_task',
    description:
      "Create a task in Gideon's bucket (task list). Use when he says to add a to-do, reminder, or action item.",
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Task title / what needs to be done.',
        },
        priority: {
          type: 'number',
          description: 'Priority 1 (highest) to 5 (lowest). Default 3.',
        },
        source_type: {
          type: 'string',
          description: "Where the task originated, e.g. 'nora', 'whatsapp', 'email'.",
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'read_briefing',
    description:
      "Fetch today's morning briefing. Returns meetings, unread counts, active deals, pending follow-ups, investor threads, and suggested focus.",
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'check_whatsapp_unread',
    description:
      'Check unread WhatsApp message counts across all panels (305, 718, investors). Returns totals and per-panel breakdown.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
]

// ---------------------------------------------------------------------------
// Tool execution — each tool calls real DB/APIs, never mocks
// ---------------------------------------------------------------------------
async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<string> {
  const service = createServiceClient()

  try {
    switch (toolName) {
      // ── Calendar ──────────────────────────────────────────────────────
      case 'read_calendar_today': {
        const events = await getTodayEvents()
        if (!events.length) return JSON.stringify({ message: 'No events on the calendar today.', events: [] })
        return JSON.stringify({ count: events.length, events })
      }

      // ── Email triage ──────────────────────────────────────────────────
      case 'read_emails': {
        const limit = Math.min(Number(toolInput.limit) || 10, 30)
        const minScore = Number(toolInput.min_score) || 5
        const { data: rows, error } = await service
          .from('email_scores')
          .select('message_id, thread_id, from_address, subject, score, reasons, scored_at')
          .gte('score', minScore)
          .order('score', { ascending: false })
          .order('scored_at', { ascending: false })
          .limit(limit)
        if (error) return JSON.stringify({ error: error.message })
        const emails = (rows ?? []).map((r: Record<string, unknown>) => {
          const reasons = (r.reasons || {}) as Record<string, unknown>
          return {
            from: r.from_address,
            from_name: reasons.from_name || '',
            subject: r.subject || '',
            snippet: reasons.snippet || '',
            score: r.score,
            received_at: reasons.received_at || r.scored_at,
            unread: !!reasons.unread,
          }
        })
        return JSON.stringify({ count: emails.length, emails })
      }

      // ── WhatsApp search ───────────────────────────────────────────────
      case 'search_whatsapp': {
        const name = String(toolInput.contact_name || '').trim()
        if (!name) return JSON.stringify({ error: 'contact_name is required' })
        const { data, error } = await service
          .from('whatsapp_threads')
          .select('id, contact_name, phone, panel, channel_type, is_investor, unread_count, last_message_at, last_message_preview')
          .ilike('contact_name', `%${name}%`)
          .order('last_message_at', { ascending: false })
          .limit(10)
        if (error) return JSON.stringify({ error: error.message })
        if (!data?.length) return JSON.stringify({ message: `No WhatsApp threads found matching "${name}".`, threads: [] })
        return JSON.stringify({ count: data.length, threads: data })
      }

      // ── Create note ───────────────────────────────────────────────────
      case 'create_note': {
        const title = String(toolInput.title || '').trim()
        const body = String(toolInput.body || '').trim()
        if (!title || !body) return JSON.stringify({ error: 'title and body are required' })
        const { data, error } = await service
          .from('notes')
          .insert({ title, body })
          .select('id')
          .single()
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({ success: true, id: data?.id, message: `Note "${title}" created.` })
      }

      // ── Create task ───────────────────────────────────────────────────
      case 'create_task': {
        const title = String(toolInput.title || '').trim()
        if (!title) return JSON.stringify({ error: 'title is required' })
        const priority = Math.max(1, Math.min(5, Number(toolInput.priority) || 3))
        const sourceType = String(toolInput.source_type || 'nora')
        const { data, error } = await service
          .from('bucket_items')
          .insert({ title, priority, source_type: sourceType, status: 'open' })
          .select('id')
          .single()
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({ success: true, id: data?.id, message: `Task "${title}" created with priority ${priority}.` })
      }

      // ── Briefing ──────────────────────────────────────────────────────
      case 'read_briefing': {
        // Fetch the briefing by calling the internal endpoint's data-fetch
        // logic directly via a lightweight server-side fetch to our own API.
        // This is the one case where internal fetch is pragmatic — the briefing
        // route aggregates 8+ data sources with timeouts and caching that we
        // don't want to duplicate.
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000'
        try {
          const res = await fetch(`${baseUrl}/api/briefing/today`, {
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
          })
          if (!res.ok) return JSON.stringify({ error: `Briefing fetch failed: ${res.status}` })
          const briefing = await res.json()
          return JSON.stringify(briefing)
        } catch (err) {
          return JSON.stringify({ error: `Briefing unavailable: ${(err as Error).message}` })
        }
      }

      // ── Unread counts ─────────────────────────────────────────────────
      case 'check_whatsapp_unread': {
        const { data, error } = await service
          .from('whatsapp_threads')
          .select('panel, unread_count, is_investor')
        if (error) return JSON.stringify({ error: error.message })
        const counts = { '305': 0, '718': 0, investors: 0, total: 0 }
        for (const t of data ?? []) {
          const row = t as { panel: string; unread_count: number; is_investor: boolean }
          if (row.is_investor && row.unread_count > 0) {
            counts.investors += row.unread_count
          } else if (row.panel === '305') {
            counts['305'] += row.unread_count || 0
          } else if (row.panel === '718') {
            counts['718'] += row.unread_count || 0
          }
        }
        counts.total = counts['305'] + counts['718'] + counts.investors
        return JSON.stringify(counts)
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` })
    }
  } catch (err) {
    console.error(`[nora/chat] tool ${toolName} threw`, err)
    return JSON.stringify({ error: `Tool ${toolName} failed: ${(err as Error).message}` })
  }
}

/**
 * Cap the inbound context JSON so a runaway client payload can't blow the
 * prompt. We stringify, and if it's huge we drop it rather than send garbage.
 */
function serializeContext(context: unknown): string {
  if (context == null) return ''
  let json: string
  try {
    json = JSON.stringify(context)
  } catch {
    return ''
  }
  // ~8KB hard ceiling (client is asked to keep it under ~4KB).
  if (json.length > 8000) {
    json = json.slice(0, 8000)
  }
  return json
}

function sanitizeHistory(history: unknown): ChatTurn[] {
  if (!Array.isArray(history)) return []
  const turns: ChatTurn[] = []
  for (const h of history) {
    if (!h || typeof h !== 'object') continue
    const role = (h as ChatTurn).role
    const content = (h as ChatTurn).content
    if ((role === 'user' || role === 'assistant') && typeof content === 'string' && content.trim()) {
      turns.push({ role, content: content.trim() })
    }
  }
  // Keep the last 20 turns to bound the prompt.
  return turns.slice(-20)
}

/**
 * Persist the user message and assistant reply to nora_chat_messages so the
 * conversation survives a cockpit reload. Best-effort: never blocks or fails
 * the chat response. If the table hasn't been migrated yet (see
 * supabase/migrations/2026-06-22-nora-chat.sql) this silently no-ops.
 */
async function persistTurn(
  orgId: string,
  userMessage: string,
  userLanguage: 'en' | 'he',
  reply: string,
  replyLanguage: 'en' | 'he',
): Promise<void> {
  try {
    const service = createServiceClient()
    
    // 1. Persist to chat messages (history)
    const { error: msgErr } = await service.from('nora_chat_messages').insert([
      { role: 'user', content: userMessage, language: userLanguage },
      { role: 'assistant', content: reply, language: replyLanguage },
    ])
    if (msgErr) console.error('[nora/chat] msg persist failed', msgErr.message)

    // 2. Persist to semantic memory (vector spine)
    const { getEmbedding } = await import('@/lib/embeddings')
    const embedding = await getEmbedding(`${userMessage}\n\nAssistant: ${reply}`)
    const { error: memErr } = await service.from('nora_memory').insert({
      org_id: orgId,
      content: `User: ${userMessage}\nAssistant: ${reply}`,
      embedding: embedding
    })
    if (memErr) console.error('[nora/chat] memory persist failed', memErr.message)

  } catch (err) {
    console.error('[nora/chat] persist threw', (err as Error).message)
  }
}

/**
 * Extract the final text reply from an Anthropic response, ignoring tool_use
 * blocks. Returns empty string if no text blocks are present.
 */
function extractTextReply(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== 'g@reprime.com') {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  let body: ChatRequestBody
  try {
    body = (await request.json()) as ChatRequestBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })
  }

  const history = sanitizeHistory(body.history)
  const contextJson = serializeContext(body.context)

  const system = contextJson
    ? `${NORA_SYSTEM}\n\nLIVE CONTEXT (Gideon's cockpit data right now — JSON). Ground every answer in this; do not invent anything beyond it:\n${contextJson}`
    : `${NORA_SYSTEM}\n\n(No live context was provided for this turn — answer from the conversation only, and say so if asked about specific data you don't have.)`

  const model = COMPLEX_RE.test(message) ? OPUS_MODEL : HAIKU_MODEL

  const messages: Anthropic.Messages.MessageParam[] = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content: message },
  ]

  const client = new Anthropic({ apiKey })

  try {
    // ── Tool-use loop: call Claude, execute tools, feed results back ───
    let response = await client.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages,
      tools: NORA_TOOLS,
    })

    let rounds = 0
    while (response.stop_reason === 'tool_use' && rounds < MAX_TOOL_ROUNDS) {
      rounds++

      // Collect all tool_use blocks from the response
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
      )

      if (!toolUseBlocks.length) break

      // Execute each tool and build tool_result content blocks
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          console.log(`[nora/chat] tool call: ${block.name}`, JSON.stringify(block.input).slice(0, 200))
          const result = await executeTool(block.name, block.input as Record<string, unknown>)
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: result,
          }
        }),
      )

      // Append the assistant's response (with tool_use blocks) and user's
      // tool_result messages, then call Claude again.
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })

      response = await client.messages.create({
        model,
        max_tokens: 1024,
        system,
        messages,
        tools: NORA_TOOLS,
      })
    }

    // ── Extract final text reply ────────────────────────────────────────
    const reply = extractTextReply(response)

    const language: 'en' | 'he' = HEBREW_RE.test(reply) ? 'he' : 'en'
    if (reply) {
      const userLanguage: 'en' | 'he' = HEBREW_RE.test(message) ? 'he' : 'en'
      const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'
      await persistTurn(DEFAULT_ORG_ID, message, userLanguage, reply, language)
    }
    return NextResponse.json({ reply, language })
  } catch (err) {
    // Never leak the API key or raw SDK internals.
    return NextResponse.json(
      { error: 'anthropic_failed', message: (err as Error).message },
      { status: 500 }
    )
  }
}

