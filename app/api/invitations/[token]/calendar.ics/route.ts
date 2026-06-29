import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface InvitationRow {
  id: string
  contact_first_name: string | null
  contact_name: string | null
  contact_email: string | null
  status: string
  meeting_type: 'terminal' | 'meeting' | null
  confirmed_slot_iso: string | null
  zoom_join_url: string | null
  zoom_meeting_id: string | null
  zoom_passcode: string | null
}

const escape = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')

function fmtIcs(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function buildIcs(opts: {
  uid: string
  title: string
  description: string
  location: string
  startUtc: Date
  endUtc: Date
  attendeeEmail: string | null
  attendeeName: string | null
}): string {
  const stamp = fmtIcs(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RePrime Group//Terminal Invitation//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escape(opts.uid)}@project-7e87w.vercel.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${fmtIcs(opts.startUtc)}`,
    `DTEND:${fmtIcs(opts.endUtc)}`,
    `SUMMARY:${escape(opts.title)}`,
    `DESCRIPTION:${escape(opts.description)}`,
    `LOCATION:${escape(opts.location)}`,
    'ORGANIZER;CN=Gideon Gratsiani:mailto:g@reprime-terminal.com',
  ]
  if (opts.attendeeEmail) {
    const cn = opts.attendeeName ? `;CN=${escape(opts.attendeeName)}` : ''
    lines.push(`ATTENDEE${cn};RSVP=TRUE:mailto:${opts.attendeeEmail}`)
  }
  lines.push('STATUS:CONFIRMED', 'SEQUENCE:0', 'END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
): Promise<Response> {
  const { token } = await context.params

  const service = createServiceClient()
  const { data, error } = await service
    .from('invitations')
    .select(
      'id, contact_first_name, contact_name, contact_email, status, meeting_type, confirmed_slot_iso, zoom_join_url, zoom_meeting_id, zoom_passcode'
    )
    .eq('id', token)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'invitation_not_found' }, { status: 404 })
  }
  const inv = data as InvitationRow

  if (inv.status !== 'confirmed' || !inv.confirmed_slot_iso) {
    return NextResponse.json(
      { error: 'not_confirmed', message: 'Invitation has no confirmed slot.' },
      { status: 409 }
    )
  }

  const start = new Date(inv.confirmed_slot_iso)
  const end = new Date(start.getTime() + 30 * 60 * 1000) // 30-min default
  const isMeeting = inv.meeting_type === 'meeting'
  const title = isMeeting
    ? 'Meeting — Gideon Gratsiani'
    : 'Terminal Introduction — Gideon Gratsiani'
  const description = [
    inv.zoom_join_url ? `Zoom: ${inv.zoom_join_url}` : null,
    inv.zoom_meeting_id ? `Meeting ID: ${inv.zoom_meeting_id}` : null,
    inv.zoom_passcode ? `Passcode: ${inv.zoom_passcode}` : null,
    '',
    isMeeting
      ? 'Looking forward to it.'
      : "Looking forward to showing you what I've been building.",
    '',
    '— Gideon',
  ]
    .filter((s) => s !== null)
    .join('\n')

  const ics = buildIcs({
    uid: inv.id,
    title,
    description,
    location: inv.zoom_join_url || 'Zoom',
    startUtc: start,
    endUtc: end,
    attendeeEmail: inv.contact_email,
    attendeeName: inv.contact_name,
  })

  const filename = isMeeting ? 'meeting.ics' : 'terminal-introduction.ics'
  return new Response(ics, {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}
