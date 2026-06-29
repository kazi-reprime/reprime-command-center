import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/server'
import { centerAuthed } from '@/lib/center/auth'

export const dynamic = 'force-dynamic'

// Snooze a contact: set the next-touch date (+ note), drop them off the active
// board until then, and put a FREE (transparent) reminder on g@reprime.com's
// calendar — a note, not a busy block. POST { row, days?, date?, note?, calendar? }.
export async function POST(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: { row?: number; days?: number; date?: string; note?: string; calendar?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }
  if (!body.row) return NextResponse.json({ error: 'row_required' }, { status: 400 })

  const remindAt = body.date
    ? new Date(body.date + 'T13:00:00Z')
    : new Date(Date.now() + (body.days ?? 4) * 86400000)
  if (isNaN(remindAt.getTime())) return NextResponse.json({ error: 'bad_date' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: rows } = await supabase.from('roster').select('name, followup_note').eq('source_row', body.row).limit(1)
  const name = (rows && rows[0]?.name) || 'contact'

  const { error } = await supabase.from('roster')
    .update({ remind_at: remindAt.toISOString(), followup_note: body.note ?? null, snoozed_at: new Date().toISOString() })
    .eq('source_row', body.row)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Free calendar reminder (best-effort, never blocks the snooze)
  let calendar: string | null = null
  if (body.calendar !== false) {
    try {
      const auth = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET)
      auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
      const cal = google.calendar({ version: 'v3', auth })
      const ymd = remindAt.toISOString().slice(0, 10)
      const next = new Date(remindAt.getTime() + 86400000).toISOString().slice(0, 10)
      const ev = await cal.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: `Follow up — ${name}`,
          description: (body.note || 'Terminal follow-up') + '\n\n(Reminder from the Command Center — not a meeting.)',
          start: { date: ymd }, end: { date: next },
          transparency: 'transparent',
          reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 9 * 60 }] },
        },
      })
      calendar = ev.data.id ?? null
    } catch (e) { calendar = 'failed: ' + (e as Error).message.slice(0, 60) }
  }

  return NextResponse.json({ ok: true, remind_at: remindAt.toISOString(), calendar })
}
