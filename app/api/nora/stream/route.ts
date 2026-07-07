/**
 * Nora Streaming Chat — Server-Sent Events endpoint
 *
 * POST /api/nora/stream
 *
 * Streams Nora's response token-by-token using SSE, so the UI can
 * show real-time typing and tool execution progress.
 *
 * Event types:
 *   - data: { type: 'token', text: '...' }          — text token
 *   - data: { type: 'tool_start', name: '...' }     — tool execution started
 *   - data: { type: 'tool_end', name: '...', durationMs: N }  — tool done
 *   - data: { type: 'done', reply: '...', language: '...' }   — final result
 *   - data: { type: 'error', message: '...' }       — error
 */

import { type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  let body: { message?: string; history?: Array<{ role: string; content: string }>; context?: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) {
    return new Response(JSON.stringify({ error: 'message required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const HEBREW_RE = /[א-ת]/
  const NORA_SYSTEM = `You are Nora, Gideon Gratsiani's executive assistant at RePrime Group (institutional commercial real estate). You speak plainly, warmly, concise — like a sharp chief of staff, never corporate filler.

TEAM: Gideon Gratsiani (Co-Founder, Miami/NYC), Chaim Abrahams (Co-Founder, NYC), Steve Philipp (AVP Acquisitions & Tech), Colonel Yaron Sitbon (Israel Ops), Adir Yonasi (VP Investor Relations), Kazi Musharraf (AI Engineer).

YOUR IDENTITY: nora@reprime.com | +1 (917) 970-3154 | Keypad: 770770

DOMAIN: Cross-border CRE investments (US/Israel), 1031 exchanges, LP structuring, institutional acquisitions.

Style: warm, direct, concise. Hebrew/English bilingual. Never invent facts.`

  // Build messages
  const history = Array.isArray(body.history)
    ? body.history.slice(-20).filter(h =>
        h && typeof h === 'object' &&
        (h.role === 'user' || h.role === 'assistant') &&
        typeof h.content === 'string'
      )
    : []

  // Context injection
  let system = NORA_SYSTEM
  if (body.context) {
    try {
      const contextStr = JSON.stringify(body.context).slice(0, 8000)
      system += `\n\nLIVE CONTEXT:\n${contextStr}`
    } catch { /* skip bad context */ }
  }

  const COMPLEX_RE = /\b(analy[sz]e|compare|strategy|why|forecast|break\s?down|recommend|explain)/i
  const model = COMPLEX_RE.test(message) ? 'claude-sonnet-4-20250514' : 'claude-haiku-4-5-20251001'

  // Create a streaming response using SSE
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey })

        const anthropicMessages = [
          ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
          { role: 'user' as const, content: message },
        ]

        const anthropicStream = await client.messages.create({
          model,
          max_tokens: 2048,
          system,
          messages: anthropicMessages,
          stream: true,
        })

        let fullReply = ''

        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta') {
            const delta = event.delta as { type: string; text?: string }
            if (delta.type === 'text_delta' && delta.text) {
              fullReply += delta.text
              send({ type: 'token', text: delta.text })
            }
          }
        }

        const language = HEBREW_RE.test(fullReply) ? 'he' : 'en'
        send({ type: 'done', reply: fullReply, language })

      } catch (err) {
        send({ type: 'error', message: (err as Error).message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
