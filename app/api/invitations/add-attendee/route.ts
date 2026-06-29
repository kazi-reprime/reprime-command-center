import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/sendgrid/client'

export const dynamic = 'force-dynamic'

type Body = {
  parent_token?: string
  emails?: string[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://project-7e87w.vercel.app').replace(/\/$/, '')
}

function formatSlot(iso: string | null): string {
  if (!iso) return '(time pending)'
  const d = new Date(iso)
  const day = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Chicago',
  })
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  })
  return `${day} · ${time} Central`
}

function buildAttendeeEmail(opts: {
  inviteUrl: string
  hostFirstName: string
  primaryGuestName: string | null
  slotDisplay: string
  zoomJoinUrl: string | null
  zoomMeetingId: string | null
  zoomPasscode: string | null
}): { subject: string; html: string; text: string } {
  const { inviteUrl, hostFirstName, primaryGuestName, slotDisplay, zoomJoinUrl, zoomMeetingId, zoomPasscode } =
    opts
  const guestStr = primaryGuestName ? ` and ${primaryGuestName}` : ''
  const subject = `You're invited — ${hostFirstName}${guestStr} on ${slotDisplay}`
  const text =
    `${hostFirstName} added you to a meeting${primaryGuestName ? ` with ${primaryGuestName}` : ''}.\n\n` +
    `When: ${slotDisplay}\n` +
    (zoomJoinUrl ? `Where: ${zoomJoinUrl}\n` : '') +
    (zoomMeetingId ? `Meeting ID: ${zoomMeetingId}\n` : '') +
    (zoomPasscode ? `Passcode: ${zoomPasscode}\n` : '') +
    `\nYour personal link to manage this invitation: ${inviteUrl}\n` +
    `\n— ${hostFirstName}`

  // Minimal HTML — same locked design palette (Imperial Gold + Brand Navy + cream).
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="background:#DDD9D2;margin:0;padding:40px 20px;font-family:Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:560px;background:#0E3470;border:1px solid rgba(255,204,51,0.22);">
    <tr><td style="padding:22px 48px 20px;text-align:center;border-bottom:1px solid rgba(255,204,51,0.18);">
      <span style="color:#FFCC33;letter-spacing:0.30em;font-size:26px;font-weight:600;font-family:Georgia,serif;">TERMINAL</span>
    </td></tr>
    <tr><td style="padding:30px 48px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#F4EEE0;padding:30px 28px;">
        <tr><td style="text-align:center;font-family:Georgia,serif;color:#0E3470;">
          <p style="margin:0 0 18px;font-size:11px;font-style:italic;color:rgba(14,52,112,0.55);">A confirmation from Gideon Gratsiani</p>
          <h1 style="margin:0 0 14px;font-size:22px;font-style:italic;font-weight:600;">You're added to a meeting${primaryGuestName ? ` with ${primaryGuestName}` : ''}.</h1>
          <p style="margin:14px 0;font-size:22px;font-weight:600;line-height:1.15;">${slotDisplay}</p>
          <p style="margin:18px 0 4px;font-size:14px;font-style:italic;line-height:1.6;">Looking forward to it.</p>
          <p style="margin:18px 0 0;font-size:16px;font-weight:600;font-style:italic;">— Gideon</p>
        </td></tr>
      </table>
    </td></tr>
    ${zoomJoinUrl ? `<tr><td style="padding:18px 48px;background:rgba(0,0,0,0.18);border-top:0.5px solid rgba(255,204,51,0.18);border-bottom:0.5px solid rgba(255,204,51,0.18);">
      <p style="margin:0 0 10px;text-align:center;font-size:9px;letter-spacing:0.24em;color:rgba(255,204,51,0.55);text-transform:uppercase;font-family:Arial,sans-serif;">Meeting Details</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-family:Georgia,serif;font-size:13px;color:#FFCC33;">
        <tr><td style="padding:5px 0;color:rgba(255,204,51,0.55);font-size:9px;letter-spacing:0.20em;text-transform:uppercase;font-family:Arial,sans-serif;">Zoom</td>
            <td style="text-align:right;padding:5px 0;"><a href="${zoomJoinUrl}" style="color:#FFCC33;text-decoration:underline;">${zoomJoinUrl.replace(/^https?:\/\//, '')}</a></td></tr>
        ${zoomMeetingId ? `<tr><td style="padding:5px 0;color:rgba(255,204,51,0.55);font-size:9px;letter-spacing:0.20em;text-transform:uppercase;font-family:Arial,sans-serif;">Meeting ID</td><td style="text-align:right;padding:5px 0;color:#FFCC33;">${zoomMeetingId}</td></tr>` : ''}
        ${zoomPasscode ? `<tr><td style="padding:5px 0;color:rgba(255,204,51,0.55);font-size:9px;letter-spacing:0.20em;text-transform:uppercase;font-family:Arial,sans-serif;">Passcode</td><td style="text-align:right;padding:5px 0;color:#FFCC33;">${zoomPasscode}</td></tr>` : ''}
      </table>
    </td></tr>` : ''}
    <tr><td style="padding:22px 48px;text-align:center;border-top:1px solid rgba(255,204,51,0.18);">
      <a href="${inviteUrl}" style="display:inline-block;color:#FFCC33;font-size:11px;letter-spacing:0.18em;text-decoration:none;text-transform:uppercase;font-family:Arial,sans-serif;border:0.5px solid rgba(255,204,51,0.45);padding:10px 18px;">Open invitation →</a>
      <p style="margin:18px 0 0;font-family:Georgia,serif;font-size:16px;color:#FFCC33;font-weight:600;letter-spacing:0.10em;">RePrime</p>
      <p style="margin:11px 0 0;font-size:8px;color:rgba(255,204,51,0.55);letter-spacing:0.06em;font-family:Arial,sans-serif;">This invitation was sent personally. Reply directly to Gideon.</p>
    </td></tr>
  </table>
</body></html>`

  return { subject, html, text }
}

export async function POST(request: NextRequest) {
  // Captain hotfix 2026-05-20: accept BOTH JSON AND form-data. Screen 3's
  // Add Attendee field is a plain HTML form (server-component-friendly) and
  // posts `token` + `email`. Programmatic callers still send JSON with
  // `parent_token` + `emails[]`. After processing, form-data POSTs get a
  // 303 redirect back to /invite/{parent} so the recipient lands on the
  // updated Screen 3 (now with the additional attendee surfaced).
  const contentType = request.headers.get('content-type') || ''
  const isFormData = contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')
  let body: Body
  let isHtmlSubmit = false
  if (isFormData) {
    try {
      const form = await request.formData()
      const token = form.get('token') ?? form.get('parent_token')
      const singleEmail = form.get('email') as string | null
      const emailsStr = form.get('emails') as string | null
      const emailsArr = emailsStr ? emailsStr.split(/[,\s]+/).filter(Boolean) : (singleEmail ? [singleEmail] : [])
      body = { parent_token: typeof token === 'string' ? token : undefined, emails: emailsArr }
      isHtmlSubmit = true
    } catch {
      return NextResponse.json({ error: 'invalid_form' }, { status: 400 })
    }
  } else {
    try {
      body = (await request.json()) as Body
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
  }

  const parentToken = body.parent_token
  if (!parentToken || typeof parentToken !== 'string') {
    if (isHtmlSubmit) return new Response(null, { status: 303, headers: { Location: `${appUrl()}/` } })
    return NextResponse.json({ error: 'parent_token_required' }, { status: 400 })
  }

  const rawEmails = Array.isArray(body.emails) ? body.emails : []
  const emails = Array.from(
    new Set(rawEmails.map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : '')).filter(Boolean))
  )
  if (emails.length === 0) {
    if (isHtmlSubmit) return new Response(null, { status: 303, headers: { Location: `${appUrl()}/invite/${parentToken}?attendee=missing` } })
    return NextResponse.json({ error: 'emails_required' }, { status: 400 })
  }
  const invalid = emails.filter((e) => !EMAIL_RE.test(e))
  if (invalid.length > 0) {
    return NextResponse.json({ error: 'invalid_email', message: `Bad email: ${invalid.join(', ')}` }, { status: 400 })
  }

  const service = createServiceClient()

  // Load parent — must be confirmed
  const { data: parent, error: parentErr } = await service
    .from('invitations')
    .select(
      'id, contact_first_name, contact_name, status, meeting_type, confirmed_slot_iso, zoom_join_url, zoom_meeting_id, zoom_passcode, calendar_event_id, parent_invitation_id, expires_at'
    )
    .eq('id', parentToken)
    .maybeSingle()

  if (parentErr || !parent) {
    return NextResponse.json({ error: 'parent_not_found' }, { status: 404 })
  }
  if (parent.status !== 'confirmed' || !parent.confirmed_slot_iso) {
    return NextResponse.json(
      { error: 'parent_not_confirmed', message: 'The original invitation has not been confirmed yet.' },
      { status: 409 }
    )
  }

  // Walk to the root in case the user added attendees via a child invitation
  const rootId: string = parent.parent_invitation_id || parent.id

  const slotDisplay = formatSlot(parent.confirmed_slot_iso)
  const hostFirstName = 'Gideon'
  const primaryGuestName = (parent.contact_name || parent.contact_first_name || '').trim() || null

  // Create one child invitation per email + dispatch
  const sentChannels: string[] = []
  const errors: { email: string; message: string }[] = []

  for (const email of emails) {
    const childId = randomUUID()
    const childRow = {
      id: childId,
      contact_email: email,
      meeting_type: parent.meeting_type ?? 'terminal',
      status: 'confirmed' as const,
      confirmed_slot_iso: parent.confirmed_slot_iso,
      zoom_join_url: parent.zoom_join_url,
      zoom_meeting_id: parent.zoom_meeting_id,
      zoom_passcode: parent.zoom_passcode,
      calendar_event_id: parent.calendar_event_id,
      parent_invitation_id: rootId,
      expires_at: parent.expires_at,
    }
    const { error: insertErr } = await service.from('invitations').insert(childRow)
    if (insertErr) {
      errors.push({ email, message: `db: ${insertErr.message}` })
      continue
    }

    const inviteUrl = `${appUrl()}/invite/${childId}/confirm`
    const { subject, html, text } = buildAttendeeEmail({
      inviteUrl,
      hostFirstName,
      primaryGuestName,
      slotDisplay,
      zoomJoinUrl: parent.zoom_join_url,
      zoomMeetingId: parent.zoom_meeting_id,
      zoomPasscode: parent.zoom_passcode,
    })

    try {
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'g@reprime-terminal.com'
      await sendEmail({ to: email, from: fromEmail, replyTo: 'g@reprime.com', subject, html, text })
      sentChannels.push(email)
    } catch (err) {
      errors.push({ email, message: `email: ${(err as Error).message}` })
    }
  }

  // Form-submitters get 303 back to /invite/{parent} so the browser lands
  // on Screen 3 cleanly. API callers still get JSON.
  if (isHtmlSubmit) {
    const status = errors.length === 0 ? 'ok' : 'partial'
    return new Response(null, {
      status: 303,
      headers: { Location: `${appUrl()}/invite/${parentToken}?attendee=${status}&sent=${sentChannels.length}` },
    })
  }
  return NextResponse.json({
    ok: errors.length === 0,
    sent: sentChannels.length,
    sent_to: sentChannels,
    errors,
  })
}
