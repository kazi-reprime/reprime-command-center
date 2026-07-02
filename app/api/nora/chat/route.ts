import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

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

const NORA_SYSTEM = `You are Nora, Gideon Gratsiani's executive assistant at RePrime Group (institutional commercial real estate). You speak plainly, warmly, concise — like a sharp chief of staff, never corporate filler. You know his business. You can read the live context provided (WhatsApp threads, Pipedrive deals, today's calendar, the morning brief) and answer specific questions grounded in it. If asked to draft a reply or take an action, draft it but note it needs his approval. Code-switch to Hebrew naturally when he does. Never invent facts not in the context — if you don't have the data, say so.`

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const OPUS_MODEL = 'claude-opus-4-6'
const COMPLEX_RE = /\b(analy[sz]e|compare|strategy|why|forecast|model|break\s?down|pros and cons|trade-?offs?|recommend)\b/i

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
  userMessage: string,
  userLanguage: 'en' | 'he',
  reply: string,
  replyLanguage: 'en' | 'he',
): Promise<void> {
  try {
    const service = createServiceClient()
    const { error } = await service.from('nora_chat_messages').insert([
      { role: 'user', content: userMessage, language: userLanguage },
      { role: 'assistant', content: reply, language: replyLanguage },
    ])
    if (error) {
      console.error('[nora/chat] persist failed', error.message)
    }
  } catch (err) {
    console.error('[nora/chat] persist threw', (err as Error).message)
  }
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
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages,
    })
    const reply = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    const language: 'en' | 'he' = HEBREW_RE.test(reply) ? 'he' : 'en'
    if (reply) {
      const userLanguage: 'en' | 'he' = HEBREW_RE.test(message) ? 'he' : 'en'
      await persistTurn(message, userLanguage, reply, language)
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
