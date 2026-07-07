/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server'

const REPLY_STYLES: Record<string, string> = {
  professional: 'Write a professional, business-appropriate reply. Formal tone, clear and concise.',
  friendly: 'Write a warm, friendly reply. Casual but respectful tone.',
  short: 'Write a very brief reply, 1-2 sentences maximum. Get to the point.',
  long: 'Write a detailed, comprehensive reply covering all points.',
  translate_he: 'Translate the reply context to Hebrew. Write the reply in Hebrew.',
  translate_en: 'Translate the reply context to English. Write the reply in English.',
  improve: 'Improve the draft reply. Fix grammar, tone, and clarity while keeping the original meaning.',
  rewrite: 'Completely rewrite the message in a better way. Same meaning, better wording.',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { context, draft, style, contactName } = body as {
      context?: string     // recent messages for context
      draft?: string       // user's draft to improve/rewrite
      style: string        // key from REPLY_STYLES
      contactName?: string
    }

    if (!style) {
      return NextResponse.json({ error: 'style is required' }, { status: 400 })
    }

    const stylePrompt = REPLY_STYLES[style] || REPLY_STYLES.professional
    const systemPrompt = `You are Nora, an AI assistant helping compose WhatsApp replies for Gideon Gratsiani at RePrime Group (commercial real estate).

${stylePrompt}

Rules:
- Reply as Gideon would (first person)
- Be natural — this is WhatsApp, not a formal letter
- Don't add greetings/signatures unless it's the first message
- If the context is in Hebrew, reply in Hebrew
- Keep the formatting simple (no markdown)
- Return ONLY the reply text, nothing else`

    const userPrompt = draft
      ? `Improve/rewrite this draft:\n"${draft}"\n\nConversation context:\n${context || '(no context)'}`
      : `Write a reply to ${contactName || 'this contact'}.\n\nRecent conversation:\n${context || '(no context)'}`

    // Try Anthropic first, then OpenAI
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY

    let reply = ''

    if (anthropicKey) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        reply = data.content?.[0]?.text || ''
      }
    }

    if (!reply && openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 500,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        reply = data.choices?.[0]?.message?.content || ''
      }
    }

    if (!reply) {
      return NextResponse.json({ error: 'AI providers unavailable' }, { status: 503 })
    }

    return NextResponse.json({ reply: reply.trim(), style })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
