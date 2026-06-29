import { Redis } from '@upstash/redis'
import { createServiceClient } from '@/lib/supabase/server'
import { patchMeeting } from '@/lib/zoom/client'
import { updateCalendarEvent, createCalendarEvent } from '@/lib/google/calendar'
import { sendEmail } from '@/lib/sendgrid/client'
import { triggerEvent } from '@/lib/pagerduty/events'
import {
  getChats,
  sendMessage,
  PANEL_ACCOUNT_MAP,
} from '@/lib/timelines/client'

export const dynamic = 'force-dynamic'

const FROM_EMAIL = 'g@reprime-terminal.com'
const REPLY_TO = 'g@reprime.com'
const PD_QUEUE_KEY = 'pagerduty:queue'

interface InvitationRow {
  id: string
  contact_pipedrive_id: number | null
  contact_first_name: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  status: string
  meeting_type: 'terminal' | 'meeting' | null
  confirmed_slot_iso: string | null
  zoom_meeting_id: string | null
  zoom_join_url: string | null
  zoom_passcode: string | null
  calendar_event_id: string | null
  reschedule_count: number | null
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function formatSlotDisplay(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  }).format(d) + ' Central'
}

function icsTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

function buildIcs(opts: {
  uid: string
  sequence: number
  startIso: string
  endIso: string
  summary: string
  description: string
  location: string
  organizerEmail: string
  organizerName: string
  attendeeEmail: string | null
  attendeeName: string | null
}): string {
  const dtstamp = icsTimestamp(new Date())
  const dtstart = icsTimestamp(new Date(opts.startIso))
  const dtend = icsTimestamp(new Date(opts.endIso))
  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RePrime Group//Terminal//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${opts.uid}@reprime.com`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escape(opts.summary)}`,
    `DESCRIPTION:${escape(opts.description)}`,
    `LOCATION:${escape(opts.location)}`,
    `ORGANIZER;CN=${escape(opts.organizerName)}:mailto:${opts.organizerEmail}`,
  ]
  if (opts.attendeeEmail) {
    const cn = opts.attendeeName ? `;CN=${escape(opts.attendeeName)}` : ''
    lines.push(`ATTENDEE${cn};RSVP=TRUE:mailto:${opts.attendeeEmail}`)
  }
  lines.push('STATUS:CONFIRMED', `SEQUENCE:${opts.sequence}`, 'END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

async function findChatIdForPhone(panel: '305' | '718', phone: string): Promise<number | null> {
  const target = (phone ?? '').replace(/\D/g, '')
  if (!target) return null
  for (let page = 1; page <= 5; page++) {
    const chats = await getChats(panel, page)
    if (chats.length === 0) return null
    const match = chats.find(
      (c) => !c.is_group && typeof c.phone === 'string' && c.phone.replace(/\D/g, '') === target
    )
    if (match) return match.id
  }
  return null
}

async function pageGideonCritical(summary: string, customDetails: Record<string, unknown>): Promise<void> {
  try {
    await triggerEvent({
      summary,
      source: 'invitations/reschedule',
      severity: 'critical',
      component: 'bookings',
      customDetails,
    })
  } catch (err) {
    console.error('[invitations.reschedule] PagerDuty alert itself failed', err)
  }
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function pageHtml(opts: { firstName: string; state: 'rescheduled' | 'partial' | 'invalid'; slotDisplay?: string; zoomUrl?: string; message?: string }): string {
  const { firstName, state, slotDisplay, zoomUrl, message } = opts
  const heading =
    state === 'rescheduled'
      ? `Moved, ${firstName}.`
      : state === 'partial'
        ? `${firstName} — saved with a hiccup.`
        : 'Could not reschedule.'
  const body =
    state === 'rescheduled' && slotDisplay
      ? `<p style="color:#FFCC33;font-size:1.05rem;line-height:1.7;margin:0 0 1.5rem;">New time: ${slotDisplay}.</p>
         <p style="color:#fff;font-size:1rem;line-height:1.7;margin:0 0 2rem;">Same Zoom link. An updated calendar invite is on its way.</p>
         ${zoomUrl ? `<table cellpadding="0" cellspacing="0" style="margin:0 0 2rem"><tr><td style="background:#FFCC33;border-radius:4px;">
           <a href="${zoomUrl}" style="display:inline-block;padding:0.85rem 2rem;color:#0E3470;text-decoration:none;font-weight:600;font-size:1rem;">Open Zoom</a>
         </td></tr></table>` : ''}`
      : state === 'partial' && slotDisplay
        ? `<p style="color:#FFCC33;font-size:1.05rem;line-height:1.7;margin:0 0 1.5rem;">New time: ${slotDisplay}.</p>
           <p style="color:#fff;font-size:1rem;line-height:1.7;margin:0 0 2rem;">${message || 'Saved your new time. Gideon will follow up directly with the updated link.'}</p>`
        : `<p style="color:#FFCC33;font-size:1rem;line-height:1.7;margin:0 0 2rem;">${message || 'If you think this is in error, reply to the original email.'}</p>`

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RePrime Group · Terminal</title></head>
<body style="margin:0;padding:0;background:#0E3470;color:#fff;font-family:'Poppins',Arial,sans-serif;">
  <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;">
    <div style="max-width:560px;width:100%;">
      <header style="border-bottom:1px solid rgba(14, 52, 112, 0.70);padding-bottom:1.5rem;display:flex;align-items:center;gap:1rem;margin-bottom:3rem;">
        <span style="color:#FFCC33;letter-spacing:0.1em;font-size:0.85rem;text-transform:uppercase;">RePrime Group · Terminal</span>
      </header>
      <h1 style="color:#FFCC33;font-size:1.85rem;font-weight:600;margin:0 0 1.5rem;">${heading}</h1>
      ${body}
      <p style="margin-top:3rem;color:#8A8680;font-size:0.85rem;border-top:1px solid rgba(14, 52, 112, 0.70);padding-top:1.5rem;">
        Gideon Gratsiani · Founder, RePrime Group
      </p>
    </div>
  </main>
</body></html>`
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  let slotIso: string | null = null
  let customDate: string | null = null
  let customTime: string | null = null
  let providedEmail: string | null = null
  let isHtmlSubmit = false
  try {
    const form = await request.formData()
    slotIso = (form.get('slot_iso') as string | null) ?? null
    customDate = (form.get('date') as string | null) ?? null
    customTime = (form.get('time') as string | null) ?? null
    providedEmail = (form.get('email') as string | null) ?? null
    isHtmlSubmit = true
  } catch {
    try {
      const body = (await request.json()) as { slot_iso?: string; date?: string; time?: string; email?: string }
      slotIso = body.slot_iso ?? null
      customDate = body.date ?? null
      customTime = body.time ?? null
      providedEmail = body.email ?? null
    } catch {
      return htmlResponse(pageHtml({ firstName: 'there', state: 'invalid', message: 'Missing slot.' }), 400)
    }
  }

  // Captain 2026-05-24: support custom date+time input (mirror /api/bookings/confirm).
  if (!slotIso && customDate && customTime) {
    const probe = new Date(`${customDate}T12:00:00Z`)
    const tz = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', timeZoneName: 'longOffset' })
      .formatToParts(probe).find(p => p.type === 'timeZoneName')?.value || 'GMT-05:00'
    const offset = (tz.match(/GMT([+-]\d{2}:\d{2})/)?.[1]) || '-05:00'
    slotIso = `${customDate}T${customTime}:00.000${offset}`
  }

  if (!slotIso || isNaN(new Date(slotIso).getTime())) {
    return htmlResponse(pageHtml({ firstName: 'there', state: 'invalid', message: 'Invalid slot.' }), 400)
  }

  const supabase = createServiceClient()
  const { data: invitation, error: lookupError } = await supabase
    .from('invitations')
    .select(
      'id, contact_pipedrive_id, contact_first_name, contact_name, contact_email, contact_phone, status, meeting_type, confirmed_slot_iso, zoom_meeting_id, zoom_join_url, zoom_passcode, calendar_event_id, reschedule_count'
    )
    .eq('id', token)
    .maybeSingle()

  if (lookupError || !invitation) {
    return htmlResponse(pageHtml({ firstName: 'there', state: 'invalid', message: 'Invitation not found.' }), 404)
  }

  const inv = invitation as InvitationRow
  const firstName = inv.contact_first_name || 'there'

  if (inv.status !== 'confirmed') {
    return htmlResponse(
      pageHtml({ firstName, state: 'invalid', message: 'No confirmed time to reschedule.' }),
      410
    )
  }

  // Captain 2026-05-24: capture recipient email at reschedule time when not on file.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const cleanedEmail = (providedEmail || '').trim().toLowerCase()
  const isValidEmail = cleanedEmail.length > 0 && EMAIL_RE.test(cleanedEmail)
  if (isValidEmail && !inv.contact_email) {
    try {
      const { error } = await supabase
        .from('invitations')
        .update({ contact_email: cleanedEmail })
        .eq('id', token)
      if (!error) {
        inv.contact_email = cleanedEmail
      }
    } catch (err) {
      console.warn('[invitations.reschedule] email capture failed', { token, err: (err as Error).message })
    }
  }

  const slotDisplay = formatSlotDisplay(slotIso)
  const isMeeting = inv.meeting_type === 'meeting'
  const summary = isMeeting ? `Meeting — ${firstName}` : `Terminal Introduction — ${firstName}`
  const start = new Date(slotIso)
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const newRescheduleCount = (inv.reschedule_count ?? 0) + 1

  const errors: Array<{ step: string; message: string }> = []

  // Step 1: Update invitation row first
  try {
    const { error } = await supabase
      .from('invitations')
      .update({
        confirmed_slot_iso: slotIso,
        reschedule_count: newRescheduleCount,
      })
      .eq('id', token)
    if (error) throw new Error(error.message)
  } catch (err) {
    errors.push({ step: '1_update_row', message: (err as Error).message })
    await pageGideonCritical(`Reschedule: failed to update invitation for ${firstName}`, {
      token,
      slotIso,
      err: (err as Error).message,
    })
  }

  // Step 2: Patch Zoom meeting (keeps same join URL)
  if (inv.zoom_meeting_id) {
    try {
      await patchMeeting(inv.zoom_meeting_id, {
        topic: summary,
        start_time: slotIso,
        duration: 30,
        timezone: 'America/Chicago',
      })
    } catch (err) {
      errors.push({ step: '2_zoom_patch', message: (err as Error).message })
      await pageGideonCritical(`Reschedule: Zoom patch failed for ${firstName}`, {
        token,
        zoom_id: inv.zoom_meeting_id,
        err: (err as Error).message,
      })
    }
  }

  // Step 3: Update calendar event (or create if missing)
  let calendarEventId = inv.calendar_event_id
  if (calendarEventId) {
    try {
      await updateCalendarEvent(calendarEventId, {
        summary,
        startTime: slotIso,
        endTime: end.toISOString(),
        attendees: inv.contact_email ? [inv.contact_email] : [],
        location: inv.zoom_join_url ?? undefined,
      })
    } catch (err) {
      errors.push({ step: '3_calendar_patch', message: (err as Error).message })
      await pageGideonCritical(`Reschedule: calendar patch failed for ${firstName}`, {
        token,
        event_id: calendarEventId,
        err: (err as Error).message,
      })
    }
  } else if (inv.zoom_join_url) {
    try {
      const newId = await createCalendarEvent({
        summary,
        description: isMeeting ? 'Meeting. 30 minutes.' : 'Terminal introduction call. 30 minutes.',
        startTime: slotIso,
        endTime: end.toISOString(),
        attendees: inv.contact_email ? [inv.contact_email] : [],
        zoomLink: inv.zoom_join_url,
        location: inv.zoom_join_url,
      })
      calendarEventId = newId ?? null
      if (calendarEventId) {
        await supabase
          .from('invitations')
          .update({ calendar_event_id: calendarEventId })
          .eq('id', token)
      }
    } catch (err) {
      errors.push({ step: '3_calendar_create', message: (err as Error).message })
    }
  }

  // Step 4: Send updated confirmation email + ICS (SEQUENCE = newRescheduleCount per RFC 5545)
  if (inv.contact_email && inv.zoom_join_url) {
    try {
      const ics = buildIcs({
        uid: token,
        sequence: newRescheduleCount,
        startIso: slotIso,
        endIso: end.toISOString(),
        summary,
        description: [
          `Zoom: ${inv.zoom_join_url}`,
          inv.zoom_meeting_id ? `Meeting ID: ${inv.zoom_meeting_id}` : null,
          inv.zoom_passcode ? `Passcode: ${inv.zoom_passcode}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
        location: inv.zoom_join_url,
        organizerEmail: FROM_EMAIL,
        organizerName: 'Gideon Gratsiani',
        attendeeEmail: inv.contact_email,
        attendeeName: inv.contact_name,
      })
      const icsBase64 = Buffer.from(ics, 'utf-8').toString('base64')

      const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FAFAF9;font-family:'Poppins',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:2rem 1rem;">
<table width="100%" style="max-width:600px;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
<tr><td style="background:#0E3470;padding:1.75rem 2rem;border-bottom:3px solid #FFCC33;">
<span style="color:#FFCC33;letter-spacing:0.1em;font-size:0.8rem;text-transform:uppercase;">RePrime Group · Time Updated</span>
</td></tr>
<tr><td style="padding:2.5rem 2rem;">
<p style="color:#1F1D1A;font-size:1.05rem;margin:0 0 1.25rem;">${firstName},</p>
<p style="color:#1F1D1A;font-size:1rem;margin:0 0 1.25rem;line-height:1.7;">New time: <strong>${slotDisplay}</strong>.</p>
<p style="color:#1F1D1A;font-size:1rem;margin:0 0 1.5rem;line-height:1.7;">Same Zoom link. Updated calendar invite is attached.</p>
<table cellpadding="0" cellspacing="0"><tr><td style="background:#FFCC33;border-radius:4px;">
<a href="${inv.zoom_join_url}" style="display:inline-block;padding:0.85rem 2rem;color:#0E3470;text-decoration:none;font-weight:600;font-size:1rem;">Join Zoom</a>
</td></tr></table>
<p style="color:#8A8680;font-size:0.85rem;margin:2.5rem 0 0;padding-top:1.5rem;border-top:1px solid #E5E2DB;">
Gideon Gratsiani<br>Founder, RePrime Group
</p></td></tr></table></td></tr></table></body></html>`
      const text = `${firstName},

New time: ${slotDisplay}.
Zoom: ${inv.zoom_join_url}

Updated calendar invite attached.

—
Gideon Gratsiani
Founder, RePrime Group`

      await sendEmail({
        to: inv.contact_email,
        from: FROM_EMAIL,
        replyTo: REPLY_TO,
        subject: `Updated — ${isMeeting ? 'Meeting' : 'Terminal Introduction'} · ${slotDisplay}`,
        html,
        text,
        attachments: [
          {
            content: icsBase64,
            filename: 'terminal-introduction.ics',
            type: 'text/calendar; method=REQUEST',
            disposition: 'attachment',
          },
        ],
      })
    } catch (err) {
      errors.push({ step: '4_email', message: (err as Error).message })
      await pageGideonCritical(`Reschedule: email failed for ${firstName}`, {
        token,
        email: inv.contact_email,
        err: (err as Error).message,
      })
    }
  }

  // Step 5: WhatsApp ping (panel 305)
  if (inv.contact_phone && inv.zoom_join_url) {
    try {
      const chatId = await findChatIdForPhone('305', inv.contact_phone)
      if (chatId) {
        const text = `${firstName} — moved to ${slotDisplay}.\n\nSame Zoom: ${inv.zoom_join_url}\n\n— Gideon`
        await sendMessage({
          phone: inv.contact_phone,
          text,
          whatsappAccountPhone: PANEL_ACCOUNT_MAP['305'],
        })
      } else {
        errors.push({ step: '5_whatsapp', message: 'no_existing_chat' })
      }
    } catch (err) {
      errors.push({ step: '5_whatsapp', message: (err as Error).message })
    }
  }

  // Step 6: Reschedule PagerDuty T-10/T-1 to new time
  try {
    const redis = getRedis()
    if (!redis) throw new Error('upstash_not_configured')
    const slotMs = start.getTime()
    const tMinus10Ms = slotMs - 10 * 60 * 1000
    const tMinus1Ms = slotMs - 1 * 60 * 1000

    // Drop any prior queued events for this token (rough but effective: only this token's members get re-added)
    // Note: this is a best-effort; existing entries with same dedupKey will resolve correctly on PD side.

    const tMinus10Member = JSON.stringify({
      summary: `${firstName} ${isMeeting ? 'meeting' : 'Terminal'} in 10 min — Zoom: ${inv.zoom_join_url ?? 'n/a'}`,
      severity: 'warning',
      customDetails: { contact: inv.contact_name, slot: slotDisplay, zoom: inv.zoom_join_url, token, rescheduled: true },
      dedupKey: `terminal:${token}:t-10`,
    })
    const tMinus1Member = JSON.stringify({
      summary: `${firstName} ${isMeeting ? 'meeting' : 'Terminal'} in 1 min`,
      severity: 'critical',
      customDetails: { contact: inv.contact_name, slot: slotDisplay, zoom: inv.zoom_join_url, token, rescheduled: true },
      dedupKey: `terminal:${token}:t-1`,
    })

    if (tMinus10Ms > Date.now()) {
      await redis.zadd(PD_QUEUE_KEY, { score: tMinus10Ms, member: tMinus10Member })
    }
    if (tMinus1Ms > Date.now()) {
      await redis.zadd(PD_QUEUE_KEY, { score: tMinus1Ms, member: tMinus1Member })
    }
  } catch (err) {
    errors.push({ step: '6_pagerduty', message: (err as Error).message })
  }

  if (errors.length > 0) {
    console.error('[invitations.reschedule] partial failures', { token, errors })
  }

  const success = errors.every((e) => e.step !== '2_zoom_patch')

  // Captain 2026-05-24: redirect form-submitters back to the confirmation page
  // (Screen 3) so the recipient sees the cream letter with the NEW time + Zoom
  // creds + calendar buttons, instead of a bespoke 'Moved' page that dead-ends.
  // JSON / API callers still get JSON.
  if (isHtmlSubmit) {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://project-7e87w.vercel.app').replace(/\/$/, '')
    const query = success ? 'rescheduled=ok' : 'rescheduled=partial'
    return new Response(null, {
      status: 303,
      headers: { Location: `${appUrl}/invite/${token}?${query}` },
    })
  }
  return htmlResponse(
    pageHtml({
      firstName,
      slotDisplay,
      zoomUrl: inv.zoom_join_url ?? undefined,
      state: success ? 'rescheduled' : 'partial',
      message: success
        ? undefined
        : 'New time saved. There was a hiccup updating the link — Gideon will follow up.',
    })
  )
}
