import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'
import { getTodayEvents } from '@/lib/google/calendar'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'

type ConciergeType =
  | 'running_late'
  | 'running_late_zoom'
  | 'running_late_office'
  | 'finished_early'
  | 'couldnt_make_it'
  | 'postpone'
  | 'move_earlier'

type Meeting = {
  title?: string | null
  time?: string | null
  attendee_name?: string | null
  zoom_link?: string | null
}

type Contact = {
  name?: string | null
  phone?: string | null
} | null

type Body = {
  type?: ConciergeType
  meeting?: Meeting
  contact?: Contact
  alternative_slots?: string[]
}

const CONCIERGE_TEMPLATES = {
  running_late: {
    en: 'Running a few minutes late — on my way. See you shortly.',
    en_zoom: 'Running a few minutes late — I\'ll be on in just a moment.',
    he: 'מגיע בעוד כמה דקות, אני בדרך. להתראות.',
    he_zoom: 'מגיע בעוד כמה דקות — אהיה בזום תוך רגע.',
  },
  running_late_zoom: {
    en: 'Running a few minutes late — I\'ll be on the Zoom call in just a moment. Apologies.',
    he: 'מגיע בעוד כמה דקות — אהיה בזום תוך רגע. מתנצל.',
  },
  running_late_office: {
    en: 'Running a few minutes late — on my way, be there shortly.',
    he: 'מגיע בעוד כמה דקות, אני בדרך, אוחר מעט.',
  },
  finished_early: {
    en: 'Wrapped up earlier than expected. Any chance you can join now?',
    en_zoom: 'Finished a few minutes early — if you\'re ready, we can jump on the Zoom now.',
    he: 'סיימתי מוקדם מהצפוי. תוכל להצטרף עכשיו?',
    he_zoom: 'סיימתי מוקדם — אם אתה מוכן, אנחנו יכולים להיכנס לזום עכשיו.',
  },
}

const AI_TYPE_PROMPTS: Partial<Record<ConciergeType, string>> = {
  postpone: 'Write a brief, professional message saying I need to push back our meeting and proposing alternative slots. Embed the slot list naturally. Direct, no excessive apology.',
  move_earlier: 'Write a brief, professional message saying I\'m free earlier than expected and would like to move our meeting sooner if they\'re available. Propose the available slots. Direct and friendly.',
  couldnt_make_it: 'Write a concise apology message saying I can\'t make our meeting and propose alternative slots naturally. Direct, no excessive apology.',
}

function isBusinessHour(d: Date): boolean {
  // Central Time approximation. Mon-Thu 9-17, Fri 9-14.
  const day = d.getDay()
  const hour = d.getHours()
  if (day === 0 || day === 6) return false
  if (day === 5) return hour >= 9 && hour < 14
  return hour >= 9 && hour < 17
}

function fmtSlot(d: Date): string {
  return (
    d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Chicago',
    }) + ' CT'
  )
}

async function computeSlots(): Promise<string[]> {
  let busy: Array<{ start: Date; end: Date }> = []
  try {
    const events = await getTodayEvents()
    busy = events
      .filter((e) => e.startTime && e.endTime)
      .map((e) => ({ start: new Date(e.startTime), end: new Date(e.endTime) }))
  } catch {
    busy = []
  }

  const slots: string[] = []
  const cursor = new Date()
  cursor.setMinutes(0, 0, 0)
  cursor.setHours(cursor.getHours() + 2)

  for (let i = 0; i < 240 && slots.length < 3; i++) {
    if (isBusinessHour(cursor)) {
      const slotEnd = new Date(cursor.getTime() + 60 * 60 * 1000)
      const conflicts = busy.some((b) => cursor < b.end && slotEnd > b.start)
      if (!conflicts) {
        slots.push(fmtSlot(cursor))
      }
    }
    cursor.setHours(cursor.getHours() + 1)
  }

  return slots
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { type, meeting, contact, alternative_slots } = body
  const VALID_TYPES: ConciergeType[] = [
    'running_late',
    'running_late_zoom',
    'running_late_office',
    'finished_early',
    'couldnt_make_it',
    'postpone',
    'move_earlier',
  ]
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
  }

  // Template-only types — return instantly, no AI needed
  if (type === 'running_late_zoom') {
    const tmpl = CONCIERGE_TEMPLATES.running_late_zoom
    return NextResponse.json({ en: tmpl.en, he: tmpl.he, slots: [] })
  }
  if (type === 'running_late_office') {
    const tmpl = CONCIERGE_TEMPLATES.running_late_office
    return NextResponse.json({ en: tmpl.en, he: tmpl.he, slots: [] })
  }
  if (type === 'running_late' || type === 'finished_early') {
    const isZoom = !!(meeting as Meeting)?.zoom_link
    const tmpl = CONCIERGE_TEMPLATES[type]
    return NextResponse.json({
      en: isZoom ? tmpl.en_zoom : tmpl.en,
      he: isZoom ? tmpl.he_zoom : tmpl.he,
      slots: [],
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })
  }

  const slots =
    Array.isArray(alternative_slots) && alternative_slots.length > 0
      ? alternative_slots.slice(0, 3)
      : await computeSlots()

  const m = (meeting || {}) as Meeting
  const lines: string[] = []
  if (m.title) lines.push(`Meeting: ${m.title}${m.time ? ` at ${m.time}` : ''}`)
  if (m.zoom_link) lines.push('Format: Zoom call (not in-person)')
  if (m.attendee_name) lines.push(`Attendee: ${m.attendee_name}`)
  if (contact?.name) lines.push(`Contact: ${contact.name}`)
  lines.push(
    slots.length > 0
      ? `Available slots:\n${slots.map((s) => `- ${s}`).join('\n')}`
      : 'No specific slots — propose this week generally.'
  )
  const userMsg = lines.join('\n')
  const taskPrompt = AI_TYPE_PROMPTS[type] ?? AI_TYPE_PROMPTS['couldnt_make_it']!

  const client = new Anthropic({ apiKey })

  let parsed: { en: string; he: string }
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You write brief WhatsApp messages in Gideon Gratsiani's voice (CRE principal, direct, no excessive apology). Task: ${taskPrompt} Output JSON only: {"en": "...", "he": "..."}.`,
      messages: [{ role: 'user', content: userMsg }],
    })
    const text = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    const stripped = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    const obj = JSON.parse(stripped) as { en?: unknown; he?: unknown }
    parsed = {
      en: typeof obj.en === 'string' ? obj.en : '',
      he: typeof obj.he === 'string' ? obj.he : '',
    }
  } catch (err) {
    return NextResponse.json(
      { error: 'anthropic_failed', message: (err as Error).message },
      { status: 502 }
    )
  }

  return NextResponse.json({ en: parsed.en, he: parsed.he, slots })
}
