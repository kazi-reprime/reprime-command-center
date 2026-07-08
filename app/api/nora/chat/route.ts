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

const NORA_SYSTEM = `You are Nora, Gideon Gratsiani's elite executive assistant at RePrime Group. You are talking directly to Gideon (always address him as Gideon or Sir, but stay warm and familiar). 

Gideon is the absolute controlling force of this Command Center. He values extreme speed, precision, and zero fluff. Your goal is to make his life effortless.

IDENTITY & AUTHORITY:
- You are an all-seeing, all-handling AI assistant. You have full visibility into the RePrime universe.
- You handle EVERYTHING: WhatsApp messages, emails, Pipedrive deals, calendar events, tasks, and notes.
- You are Gideon's primary interface. You don't just "report" data; you MANAGE it. 
- If Gideon says "handle this," you identify the correct tool (email, WhatsApp, task) and execute immediately.

CRITICAL PERSONALITY & PROTOCOL:
- You are his Personal AI Assistant. You are NORA.
- You are speaking to him via voice. Gideon can and will interrupt you at any time.
- If Gideon starts talking (or presses the stop button/Escape key), you stop immediately.
- Keep spoken responses extremely concise (1-2 sentences). 
- If you are listing things, ask "Shall I continue?" after the first 3.
- Be proactive. Check WhatsApp and Pipedrive automatically when discussing contacts.
- Tone: Professional, elite, efficient, and loyal.

TEAM CONTEXT:
- Gideon Gratsiani — Principal. The BOSS.
- Chaim Abrahams — Co-Founder.
- Steve Philipp — AVP, Acquisitions & Tech.
- Colonel Yaron Sitbon — Israel Ops.
- Kazi Musharraf — AI Engineer (The creator of your logic).
- Your Phone: +1 (917) 970-3154 (Quo)

You are Hebrew/English bilingual. Code-switch naturally if Gideon speaks Hebrew.`

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
  {
    name: 'read_email_inbox',
    description:
      'Read real emails from Gmail inbox with full body text. Returns sender, subject, snippet, date, and unread status from the actual inbox.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Max emails to return (default 10, max 20).',
        },
        query: {
          type: 'string',
          description: 'Optional Gmail search query (e.g. "from:david", "is:unread").',
        },
      },
      required: [],
    },
  },
  {
    name: 'send_whatsapp',
    description:
      'Send a WhatsApp message to a contact. Requires phone number and message text. Uses WhatsApp 305 line by default.',
    input_schema: {
      type: 'object' as const,
      properties: {
        phone: {
          type: 'string',
          description: 'Recipient phone number in E.164 format (e.g. +1305...).',
        },
        message: {
          type: 'string',
          description: 'Message text to send.',
        },
        channel: {
          type: 'string',
          description: 'WhatsApp line to send from: "305" or "718". Default "305".',
        },
      },
      required: ['phone', 'message'],
    },
  },
  {
    name: 'list_zoom_meetings',
    description:
      'List upcoming Zoom meetings. Returns meeting title, start time, join URL, and attendees.',
    input_schema: {
      type: 'object' as const,
      properties: {
        include_past: {
          type: 'boolean',
          description: 'Include past meetings (default false).',
        },
      },
      required: [],
    },
  },
  {
    name: 'read_whatsapp_messages',
    description:
      'Read recent messages from a specific WhatsApp thread. Pass the thread ID from search_whatsapp.',
    input_schema: {
      type: 'object' as const,
      properties: {
        thread_id: {
          type: 'string',
          description: 'WhatsApp thread ID (UUID from search_whatsapp results).',
        },
        limit: {
          type: 'number',
          description: 'Max messages to return (default 20).',
        },
      },
      required: ['thread_id'],
    },
  },
  {
    name: 'create_reminder',
    description:
      'Create a reminder for Gideon. Similar to a task but specifically time-based.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Reminder title / what to remember.',
        },
        due_at: {
          type: 'string',
          description: 'When to remind (ISO 8601 datetime or relative like "tomorrow 9am").',
        },
        priority: {
          type: 'number',
          description: 'Priority 1-5 (default 2 for reminders).',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'draft_email',
    description:
      'Draft an email for Gideon to review. Does NOT send. Returns the draft for approval.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address.',
        },
        subject: {
          type: 'string',
          description: 'Email subject line.',
        },
        body: {
          type: 'string',
          description: 'Full email body text.',
        },
      },
      required: ['to', 'subject', 'body'],
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

      // ── Read real Gmail inbox ─────────────────────────────────────────
      case 'read_email_inbox': {
        try {
          const { fetchInbox } = await import('@/lib/email/unified-inbox')
          const limit = Math.min(Number(toolInput.limit) || 10, 20)
          const query = String(toolInput.query || '')
          const inboxEmails = await fetchInbox({ maxResults: limit, query: query || undefined })
          const emails = inboxEmails.map((e: { fromName: string; from: string; subject: string; snippet: string; receivedAt: string; unread: boolean; important: boolean; messageId: string }) => ({
            from: e.fromName || e.from,
            subject: e.subject,
            snippet: e.snippet,
            date: e.receivedAt,
            unread: e.unread,
            important: e.important,
            messageId: e.messageId,
          }))
          return JSON.stringify({ count: emails.length, emails })
        } catch (err) {
          return JSON.stringify({ error: `Email inbox read failed: ${(err as Error).message}` })
        }
      }

      // ── Send WhatsApp message ─────────────────────────────────────────
      case 'send_whatsapp': {
        const phone = String(toolInput.phone || '').trim()
        const message = String(toolInput.message || '').trim()
        if (!phone || !message) return JSON.stringify({ error: 'phone and message are required' })
        
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
        try {
          const channelId = String(toolInput.channel || '305') === '718'
            ? (process.env.TIMELINES_CHANNEL_718 || '+17183551444')
            : (process.env.TIMELINES_CHANNEL_305 || '+13057784861')
          const res = await fetch(`${baseUrl}/api/cockpit/whatsapp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, message, channelId }),
          })
          const data = await res.json()
          if (data.success) {
            return JSON.stringify({ success: true, message: `WhatsApp sent to ${phone} via ${data.provider || 'whatsapp'}`, phone })
          }
          return JSON.stringify({ error: data.error || 'Send failed' })
        } catch (err) {
          return JSON.stringify({ error: `WhatsApp send failed: ${(err as Error).message}` })
        }
      }

      // ── List Zoom meetings ────────────────────────────────────────────
      case 'list_zoom_meetings': {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
        try {
          const includePast = toolInput.include_past === true ? '&include_past=true' : ''
          const res = await fetch(`${baseUrl}/api/zoom/meetings?limit=10${includePast}`, {
            cache: 'no-store',
          })
          if (!res.ok) return JSON.stringify({ error: `Zoom API returned ${res.status}` })
          const data = await res.json()
          return JSON.stringify({
            count: data.meetings?.length || 0,
            meetings: (data.meetings || []).map((m: Record<string, unknown>) => ({
              id: m.id,
              topic: m.topic,
              start_time: m.start_time,
              duration: m.duration,
              join_url: m.join_url,
              status: m.status,
            })),
          })
        } catch (err) {
          return JSON.stringify({ error: `Zoom meetings fetch failed: ${(err as Error).message}` })
        }
      }

      // ── Read WhatsApp messages ────────────────────────────────────────
      case 'read_whatsapp_messages': {
        const threadId = String(toolInput.thread_id || '').trim()
        if (!threadId) return JSON.stringify({ error: 'thread_id is required' })
        const limit = Math.min(Number(toolInput.limit) || 20, 50)
        const { data, error } = await service
          .from('whatsapp_messages')
          .select('body, direction, from_name, sent_at, status, media_type')
          .eq('thread_id', threadId)
          .order('sent_at', { ascending: false })
          .limit(limit)
        if (error) return JSON.stringify({ error: error.message })
        const messages = (data ?? []).reverse().map((m: Record<string, unknown>) => ({
          body: m.body,
          direction: m.direction,
          from: m.from_name,
          time: m.sent_at,
          status: m.status,
          hasMedia: !!m.media_type,
        }))
        return JSON.stringify({ count: messages.length, messages })
      }

      // ── Create reminder ──────────────────────────────────────────────
      case 'create_reminder': {
        const title = String(toolInput.title || '').trim()
        if (!title) return JSON.stringify({ error: 'title is required' })
        const priority = Math.max(1, Math.min(5, Number(toolInput.priority) || 2))
        const dueAt = toolInput.due_at ? String(toolInput.due_at) : null
        const { data, error } = await service
          .from('bucket_items')
          .insert({
            title,
            priority,
            source_type: 'nora-reminder',
            status: 'open',
            ...(dueAt ? { due_date: dueAt } : {}),
          })
          .select('id')
          .single()
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({
          success: true,
          id: data?.id,
          message: `Reminder "${title}" created${dueAt ? ` for ${dueAt}` : ''}.`,
        })
      }

      // ── Draft email (no send) ─────────────────────────────────────────
      case 'draft_email': {
        return JSON.stringify({
          draft: true,
          to: String(toolInput.to || ''),
          subject: String(toolInput.subject || ''),
          body: String(toolInput.body || ''),
          message: 'Draft ready for review. Say "send it" to send, or suggest edits.',
        })
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
    // No Anthropic key — skip to Groq/OpenAI fallback
    console.warn('[nora/chat] ANTHROPIC_API_KEY not set, trying fallback providers')
    const groqKey = process.env.GROQ_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY
    const fallbackKey = groqKey || (openaiKey?.startsWith('sk-') ? openaiKey : null)
    
    if (!fallbackKey) {
      return NextResponse.json({ error: 'No AI provider configured (need ANTHROPIC_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY)' }, { status: 500 })
    }

    try {
      const isGroq = !!groqKey
      const endpoint = isGroq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fallbackKey}` },
        body: JSON.stringify({
          model: isGroq ? 'llama-3.1-8b-instant' : 'gpt-4o-mini',
          messages: [
            { role: 'system', content: NORA_SYSTEM },
            ...sanitizeHistory(body.history).map(t => ({ role: t.role, content: t.content })),
            { role: 'user', content: message },
          ],
        }),
      })
      if (res.ok) {
        const json = await res.json()
        const reply = json.choices?.[0]?.message?.content || ''
        return NextResponse.json({ reply, language: HEBREW_RE.test(reply) ? 'he' : 'en', provider: isGroq ? 'groq' : 'openai' })
      }
    } catch {}
    
    return NextResponse.json({ error: 'All fallback providers failed' }, { status: 500 })
  }

  const history = sanitizeHistory(body.history)
  const contextJson = serializeContext(body.context)

  // ── Multi-Agent Path (primary) ────────────────────────────────────────
  // Route through the Nora orchestrator which classifies intent, applies
  // guardrails, and delegates to specialist agents.
  try {
    const { processMessage, persistConversation } = await import('@/lib/agents/orchestrator')

    const liveContext = contextJson ? JSON.parse(contextJson) : undefined

    const agentResult = await processMessage({
      message,
      history: history.map(h => ({ role: h.role, content: h.content })),
      liveContext,
      sessionId: `chat-${Date.now()}`,
    })

    // Persist the conversation (best-effort, non-blocking)
    persistConversation(`chat-${Date.now()}`, message, agentResult).catch(() => {})

    return NextResponse.json({
      reply: agentResult.reply,
      language: agentResult.language,
      agentId: agentResult.agentId,
      toolTrace: agentResult.toolTrace.length > 0 ? agentResult.toolTrace : undefined,
      pendingApprovals: agentResult.pendingApprovals,
    })
  } catch (orchestratorErr) {
    console.error('[nora/chat] orchestrator failed, falling back to direct Claude:', (orchestratorErr as Error).message)
  }

  // ── Legacy Monolithic Path (fallback) ─────────────────────────────────
  // If the orchestrator fails (e.g., agent module error), fall back to
  // the original single-prompt Claude flow with tool-use loop.
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
    let response = await client.messages.create({
      model,
      max_tokens: 2048,
      system,
      messages,
      tools: NORA_TOOLS,
    })

    let rounds = 0
    while (response.stop_reason === 'tool_use' && rounds < MAX_TOOL_ROUNDS) {
      rounds++

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
      )

      if (!toolUseBlocks.length) break

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

      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })

      response = await client.messages.create({
        model,
        max_tokens: 2048,
        system,
        messages,
        tools: NORA_TOOLS,
      })
    }

    const reply = extractTextReply(response)

    const language: 'en' | 'he' = HEBREW_RE.test(reply) ? 'he' : 'en'
    if (reply) {
      const userLanguage: 'en' | 'he' = HEBREW_RE.test(message) ? 'he' : 'en'
      const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'
      await persistTurn(DEFAULT_ORG_ID, message, userLanguage, reply, language)
    }
    return NextResponse.json({ reply, language })
  } catch (err) {
    console.error('[nora/chat] Anthropic failed:', (err as Error).message)
    
    // ── Ultimate Fallback: Groq or OpenAI (no tool-use, plain chat) ──
    const groqKey = process.env.GROQ_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY
    const fallbackKey = groqKey || (openaiKey?.startsWith('sk-') ? openaiKey : null)
    const isGroq = !!groqKey
    
    if (fallbackKey) {
      try {
        const endpoint = isGroq
          ? 'https://api.groq.com/openai/v1/chat/completions'
          : 'https://api.openai.com/v1/chat/completions'
        const fallbackModel = isGroq ? 'llama-3.1-8b-instant' : 'gpt-4o-mini'
        
        const fallbackRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${fallbackKey}`,
          },
          body: JSON.stringify({
            model: fallbackModel,
            messages: [
              { role: 'system', content: system },
              ...history.map(t => ({ role: t.role, content: t.content })),
              { role: 'user', content: message },
            ],
          }),
        })

        if (fallbackRes.ok) {
          const json = await fallbackRes.json()
          const fallbackReply = json.choices?.[0]?.message?.content || ''
          const language: 'en' | 'he' = HEBREW_RE.test(fallbackReply) ? 'he' : 'en'
          return NextResponse.json({
            reply: fallbackReply,
            language,
            provider: isGroq ? 'groq' : 'openai',
          })
        }
      } catch (fallbackErr) {
        console.error('[nora/chat] Fallback also failed:', (fallbackErr as Error).message)
      }
    }

    return NextResponse.json(
      { error: 'all_providers_failed', message: (err as Error).message },
      { status: 500 }
    )
  }
}

