import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'
import type { DashboardMessage, Panel } from '@/lib/timelines/types'

export const dynamic = 'force-dynamic'

type ModelKey = 'haiku' | 'opus' | 'opus-thinking'

type Contact = {
  name?: string | null
  phone?: string | null
} | null

type DraftRequestBody = {
  panel: Panel
  thread_id: string
  model: ModelKey
  extended_thinking?: boolean
  messages: DashboardMessage[]
  contact?: Contact
}

const SYSTEM_718 = `You are Gideon — Israeli-American real estate investor in your 30s — texting from your personal 718 line.
Write AS Gideon. Direct, warm, brief, human. Code-switch naturally between English and Hebrew when it fits the relationship.
No filler. Never use "absolutely", "just to clarify", "I wanted to follow up", or any AI / customer-service phrasing.
Output ONLY the reply message body. No preamble, no explanation, no quoting the prior message back, no signature.`

const SYSTEM_305 = `You are Gideon Lichtenfeld, principal at RePrime Group, replying from the 305 institutional line to capital partners, sponsors, brokers, and counterparties.
Tone: Blackstone partner — clear, measured, transaction-grade. No marketing language, no hedging, no filler.
Never use "absolutely", "just to clarify", or AI / customer-service phrasing.
BANNED phrases — never output, even if the prior thread used them: describing RePrime as "distressed", "3,000+ transactions", "$15B deployed". These are inflated legacy figures and must not appear.
Output ONLY the reply message body. No preamble, no explanation, no quoting the prior message back, no signature.`

function systemFor(panel: Panel, contactName: string | null | undefined): string {
  const base = panel === '305' ? SYSTEM_305 : SYSTEM_718
  if (contactName && contactName.trim()) {
    return `${base}\n\nYou are replying to: ${contactName.trim()}.`
  }
  return base
}

function modelIdFor(model: ModelKey): string {
  if (model === 'haiku') return 'claude-haiku-4-5-20251001'
  return 'claude-opus-4-6'
}

function formatHistory(messages: DashboardMessage[]): string {
  const recent = messages.slice(-20)
  const lines: string[] = []
  for (const m of recent) {
    const speaker = m.direction === 'out' ? 'Gideon' : (m.from_name?.trim() || 'Contact')
    const body = m.body?.trim() || (m.media_url ? `[${m.media_type || 'attachment'}]` : '')
    if (!body) continue
    lines.push(`${speaker}: ${body}`)
  }
  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== 'g@reprime.com') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: DraftRequestBody
  try {
    body = (await request.json()) as DraftRequestBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { panel, model, extended_thinking, messages, contact } = body
  if (panel !== '718' && panel !== '305') {
    return NextResponse.json({ error: 'panel must be 718 or 305' }, { status: 400 })
  }
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: 'messages must be an array' }, { status: 400 })
  }
  if (model !== 'haiku' && model !== 'opus' && model !== 'opus-thinking') {
    return NextResponse.json({ error: 'invalid model' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })
  }

  const client = new Anthropic({ apiKey })
  const modelId = modelIdFor(model)
  const conversation = formatHistory(messages)
  const userMsg = conversation
    ? `${conversation}\n\nDraft a reply.`
    : 'Draft a reply.'
  const useThinking = model === 'opus-thinking' || extended_thinking === true

  const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
    model: modelId,
    max_tokens: useThinking ? 16000 : 1024,
    system: systemFor(panel, contact?.name),
    messages: [{ role: 'user', content: userMsg }],
  }
  if (useThinking) {
    params.thinking = { type: 'enabled', budget_tokens: 10000 }
  }

  try {
    const response = await client.messages.create(params)
    const draft = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    return NextResponse.json({ draft, model_used: model })
  } catch (err) {
    return NextResponse.json(
      { error: 'anthropic_failed', message: (err as Error).message },
      { status: 502 }
    )
  }
}
