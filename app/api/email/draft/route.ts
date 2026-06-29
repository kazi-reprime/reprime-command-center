import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'

type DraftBody = {
  subject?: string
  from?: string
  snippet?: string
  language?: 'en' | 'he'
}

const SYSTEM = `You are Gideon Gratsiani, principal at RePrime Group, drafting an EMAIL reply.
Write AS Gideon — clear, measured, transaction-grade, warm but brief. Institutional real-estate voice.
No marketing language, no hedging, no filler. Never use "absolutely", "just to clarify",
"I wanted to follow up", "I hope this email finds you well", or any AI / customer-service phrasing.
BANNED: describing RePrime as "distressed", "3,000+ transactions", or "$15B deployed".
If the incoming email is in Hebrew, reply in native business Hebrew (dugri register), never machine-translated.
Output ONLY the email body — no subject line, no "Hi"/greeting boilerplate beyond a natural opener,
no signature, no preamble, no explanation.`

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: DraftBody
  try {
    body = (await request.json()) as DraftBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })
  }

  const subject = (body.subject || '').trim()
  const from = (body.from || '').trim()
  const snippet = (body.snippet || '').trim()
  const langHint = body.language === 'he' ? 'The incoming email is in Hebrew — reply in Hebrew.' : ''

  const userMsg = [
    from ? `From: ${from}` : '',
    subject ? `Subject: ${subject}` : '',
    snippet ? `Email:\n${snippet}` : '',
    langHint,
    'Draft Gideon\'s reply.',
  ]
    .filter(Boolean)
    .join('\n')

  const client = new Anthropic({ apiKey })
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    })
    const draft = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    return NextResponse.json({ draft })
  } catch (err) {
    return NextResponse.json(
      { error: 'draft_failed', message: err instanceof Error ? err.message : 'unknown' },
      { status: 502 }
    )
  }
}
