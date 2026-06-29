import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { findPersonByEmail, findPersonByPhone, createActivity } from '@/lib/pipedrive/client'
import { normalizePhone } from '@/lib/timelines/normalize-phone'

// Required table (run once in Supabase SQL editor):
//   CREATE TABLE IF NOT EXISTS meeting_summaries (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     pipedrive_contact_id integer,
//     meeting_title text,
//     summary_text text,
//     action_items jsonb,
//     raw_email text,
//     received_at timestamptz DEFAULT now(),
//     zoom_meeting_id text
//   );

export const dynamic = 'force-dynamic'

const ZOOM_SENDER_DOMAINS = ['zoom.us', 'zoomgov.com']

function senderDomain(from: string): string | null {
  if (!from) return null
  const m = from.match(/<([^>]+)>/) ?? from.match(/([^\s<>]+@[^\s<>]+)/)
  if (!m) return null
  const at = m[1].split('@')[1]
  return at ? at.trim().toLowerCase() : null
}

function isZoomSender(from: string): boolean {
  const dom = senderDomain(from)
  if (!dom) return false
  return ZOOM_SENDER_DOMAINS.some((d) => dom === d || dom.endsWith('.' + d))
}

function extractEmails(text: string): string[] {
  if (!text) return []
  const re = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g
  const seen = new Set<string>()
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const e = m[0].toLowerCase()
    if (seen.has(e)) continue
    seen.add(e)
    if (e.endsWith('@zoom.us') || e.endsWith('@zoomgov.com') || e.endsWith('@reprime.com') || e.endsWith('@reprime-terminal.com')) {
      continue
    }
    out.push(e)
  }
  return out
}

function extractPhones(text: string): string[] {
  if (!text) return []
  const re = /(\+?\d[\d\s().\-]{7,}\d)/g
  const seen = new Set<string>()
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const n = normalizePhone(m[0])
    if (n && !seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  return out
}

interface ParsedSummary {
  meetingTitle: string
  summaryText: string
  actionItems: string[]
}

function parseSummary(subject: string, text: string): ParsedSummary {
  const meetingTitle = subject.replace(/^.*?Summary[:\-]\s*/i, '').trim() || subject.trim()
  const actionItems: string[] = []
  let summaryText = text || ''

  if (text) {
    const aiMatch = text.match(/\b(Action Items|Next Steps|Action items|Next steps)\b[:\-\n]+([\s\S]+?)(?:\n\n[A-Z][^\n]*[:\n]|$)/)
    if (aiMatch) {
      const block = aiMatch[2]
      const items = block
        .split(/\n+/)
        .map((line) => line.replace(/^[\s\-•\*\d.)]+/, '').trim())
        .filter((line) => line.length > 0)
      actionItems.push(...items)
    }
    const sumMatch = text.match(/\b(Summary|Meeting Summary|Overview)\b[:\-\n]+([\s\S]+?)(?:\n\n[A-Z][^\n]*[:\n]|$)/)
    if (sumMatch) {
      summaryText = sumMatch[2].trim()
    }
  }

  return { meetingTitle, summaryText, actionItems }
}

export async function POST(request: Request) {
  let from = ''
  let subject = ''
  let textBody = ''
  let htmlBody = ''
  let rawEmail = ''

  try {
    const form = await request.formData()
    from = (form.get('from') as string | null) ?? ''
    subject = (form.get('subject') as string | null) ?? ''
    textBody = (form.get('text') as string | null) ?? ''
    htmlBody = (form.get('html') as string | null) ?? ''
    rawEmail = (form.get('email') as string | null) ?? ''
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_multipart', message: (err as Error).message },
      { status: 400 }
    )
  }

  if (!isZoomSender(from)) {
    console.warn('[zoom.ai-companion-ingest] rejected non-zoom sender', { from })
    return NextResponse.json({ error: 'sender_not_zoom', from }, { status: 403 })
  }

  const sourceText = textBody || htmlBody.replace(/<[^>]+>/g, ' ')
  const emails = extractEmails(sourceText)
  const phones = extractPhones(sourceText)
  const { meetingTitle, summaryText, actionItems } = parseSummary(subject, sourceText)

  let pipedriveContactId: number | null = null
  for (const email of emails) {
    try {
      const person = await findPersonByEmail(email)
      if (person) {
        pipedriveContactId = person.id
        break
      }
    } catch (err) {
      console.error('[zoom.ai-companion-ingest] findPersonByEmail failed', { email, err: (err as Error).message })
    }
  }
  if (pipedriveContactId === null) {
    for (const phone of phones) {
      try {
        const person = await findPersonByPhone(phone)
        if (person) {
          pipedriveContactId = person.id
          break
        }
      } catch (err) {
        console.error('[zoom.ai-companion-ingest] findPersonByPhone failed', { phone, err: (err as Error).message })
      }
    }
  }

  const supabase = createServiceClient()
  const { data: inserted, error: insertError } = await supabase
    .from('meeting_summaries')
    .insert({
      pipedrive_contact_id: pipedriveContactId,
      meeting_title: meetingTitle,
      summary_text: summaryText,
      action_items: actionItems,
      raw_email: rawEmail || sourceText,
    })
    .select('id')
    .maybeSingle()

  if (insertError) {
    console.error('[zoom.ai-companion-ingest] supabase insert failed', insertError)
    return NextResponse.json(
      {
        error: 'meeting_summary_insert_failed',
        message: insertError.message,
        hint: 'If table is missing, create the meeting_summaries table per the SQL in this route file header.',
      },
      { status: 500 }
    )
  }

  if (pipedriveContactId !== null) {
    try {
      const noteParts = [summaryText.trim()]
      if (actionItems.length > 0) {
        noteParts.push('', 'Action Items:', ...actionItems.map((a) => `- ${a}`))
      }
      await createActivity({
        type: 'meeting',
        subject: meetingTitle,
        person_id: pipedriveContactId,
        note: noteParts.filter(Boolean).join('\n'),
        done: true,
      })
    } catch (err) {
      console.error('[zoom.ai-companion-ingest] createActivity failed', err)
    }
  }

  return NextResponse.json({
    ok: true,
    summary_id: inserted?.id ?? null,
    pipedrive_contact_id: pipedriveContactId,
    meeting_title: meetingTitle,
    matched_email: emails.find(() => pipedriveContactId !== null) ?? null,
    action_item_count: actionItems.length,
  })
}
