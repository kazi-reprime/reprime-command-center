import { after } from 'next/server'
import { Redis } from '@upstash/redis'
import { createServiceClient } from '@/lib/supabase/server'
import { createMeeting } from '@/lib/zoom/client'
import { createCalendarEvent, getBusyTimes, slotOverlapsBusy } from '@/lib/google/calendar'
import { triggerEvent } from '@/lib/pagerduty/events'
import {
  getChats,
  sendMessage,
  PANEL_ACCOUNT_MAP,
} from '@/lib/timelines/client'
import { createActivity } from '@/lib/pipedrive/client'
import { notifyGroup } from '@/lib/center/notify'
import { emailLikelyWrongPerson } from '@/lib/center/email-name-check'

export const dynamic = 'force-dynamic'

const PD_QUEUE_KEY = 'pagerduty:queue'

// Dual-time confirmation string so the recipient sees their own clock and
// Gideon sees Central. Gideon 2026-06-18.
function formatSlotDisplay(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const dayFmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago',
  })
  const ilTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Jerusalem',
  }).format(d)
  const ctTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago',
  }).format(d)
  return `${dayFmt.format(d)} · ${ilTime} Israel · ${ctTime} Central`
}

interface Slot {
  iso: string
  display: string
}

interface InvitationRow {
  id: string
  contact_pipedrive_id: number | null
  contact_first_name: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  proposed_slots: Slot[]
  status: string
  expires_at: string | null
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function pageHtml(opts: {
  firstName: string
  slot?: Slot
  zoomUrl?: string
  state: 'confirmed' | 'invalid' | 'used' | 'expired' | 'partial'
  message?: string
}): string {
  const { firstName, slot, zoomUrl, state, message } = opts
  const heading =
    state === 'confirmed'
      ? `Locked in, ${firstName}.`
      : state === 'partial'
        ? `${firstName} — saved with a hiccup.`
        : state === 'used'
          ? 'This invitation has already been used.'
          : state === 'expired'
            ? 'This invitation has expired.'
            : 'This invitation link is not valid.'
  const body =
    state === 'confirmed' && slot && zoomUrl
      ? `<p style="color:#FFCC33;font-size:1.05rem;line-height:1.7;margin:0 0 1.5rem;">${slot.display}.</p>
         <p style="color:#fff;font-size:1rem;line-height:1.7;margin:0 0 2rem;">Zoom + calendar invite are on their way to your inbox. See you then.</p>
         <table cellpadding="0" cellspacing="0" style="margin:0 0 2rem"><tr><td style="background:#FFCC33;border-radius:4px;">
           <a href="${zoomUrl}" style="display:inline-block;padding:0.85rem 2rem;color:#0E3470;text-decoration:none;font-weight:600;font-size:1rem;">Open Zoom</a>
         </td></tr></table>`
      : state === 'partial' && slot
        ? `<p style="color:#FFCC33;font-size:1.05rem;line-height:1.7;margin:0 0 1.5rem;">${slot.display}.</p>
           <p style="color:#fff;font-size:1rem;line-height:1.7;margin:0 0 2rem;">${message || 'I saved your slot — Gideon will follow up directly with the Zoom link.'}</p>`
        : `<p style="color:#FFCC33;font-size:1rem;line-height:1.7;margin:0 0 2rem;">${message || 'If you think this is in error, reply to the original email and I\'ll sort it out.'}</p>`

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RePrime Group · Terminal</title></head>
<body style="margin:0;padding:0;background:#0E3470;color:#fff;font-family:'Poppins',Arial,sans-serif;">
  <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;">
    <div style="max-width:560px;width:100%;">
      <header style="border-bottom:1px solid rgba(14, 52, 112, 0.70);padding-bottom:1.5rem;display:flex;align-items:center;gap:1rem;margin-bottom:3rem;">
        <span style="color:#FFCC33;letter-spacing:0.1em;font-size:0.85rem;text-transform:uppercase;">RePrime Group · Terminal Introduction</span>
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

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

async function findChatIdForPhone(panel: '305' | '718', phone: string): Promise<number | null> {
  const target = (phone ?? '').replace(/\D/g, '')
  if (!target) return null
  for (let page = 1; page <= 5; page++) {
    const chats = await getChats(panel, page)
    if (chats.length === 0) return null
    // Some Timelines chats have null/undefined phone (groups, system entries) —
    // guard before .replace() so the iteration doesn't crash before reaching
    // the real match.
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
      source: 'bookings/confirm',
      severity: 'critical',
      component: 'bookings',
      customDetails,
    })
  } catch (err) {
    console.error('[bookings.confirm] PagerDuty failure-alert itself failed', err)
  }
}

export async function POST(request: Request) {
  let token: string | null = null
  let slotIso: string | null = null
  let customDate: string | null = null  // YYYY-MM-DD from <input type="date">
  let customTime: string | null = null  // HH:MM from <input type="time">
  let providedEmail: string | null = null  // optional <input type="email" name="email">
  try {
    const form = await request.formData()
    token = (form.get('token') as string | null) ?? null
    slotIso = (form.get('slot_iso') as string | null) ?? null
    customDate = (form.get('date') as string | null) ?? null
    customTime = (form.get('time') as string | null) ?? null
    providedEmail = (form.get('email') as string | null) ?? null
  } catch {
    try {
      const body = (await request.json()) as { token?: string; slot_iso?: string; date?: string; time?: string; email?: string }
      token = body.token ?? null
      slotIso = body.slot_iso ?? null
      customDate = body.date ?? null
      customTime = body.time ?? null
      providedEmail = body.email ?? null
    } catch {
      return htmlResponse(pageHtml({ firstName: 'there', state: 'invalid', message: 'Missing token.' }), 400)
    }
  }

  // Captain 2026-05-24: support custom-time picker from /invite/[token]/choose.
  // If slot_iso wasn't sent but date + time were, construct the ISO in Central.
  // CDT (-05:00) March-November, CST (-06:00) November-March. Use Intl to detect.
  if (!slotIso && customDate && customTime) {
    const probe = new Date(`${customDate}T12:00:00Z`)
    const tz = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', timeZoneName: 'longOffset' })
      .formatToParts(probe).find(p => p.type === 'timeZoneName')?.value || 'GMT-05:00'
    const offset = (tz.match(/GMT([+-]\d{2}:\d{2})/)?.[1]) || '-05:00'
    slotIso = `${customDate}T${customTime}:00.000${offset}`
  }

  if (!token || !slotIso) {
    return htmlResponse(pageHtml({ firstName: 'there', state: 'invalid', message: 'Missing token or slot.' }), 400)
  }
  if (isNaN(new Date(slotIso).getTime())) {
    return htmlResponse(pageHtml({ firstName: 'there', state: 'invalid', message: 'Invalid slot.' }), 400)
  }

  const supabase = createServiceClient()
  const { data: invitation, error: lookupError } = await supabase
    .from('invitations')
    .select(
      'id, contact_pipedrive_id, contact_first_name, contact_name, contact_email, contact_phone, proposed_slots, status, expires_at'
    )
    .eq('id', token)
    .maybeSingle()

  if (lookupError || !invitation) {
    return htmlResponse(pageHtml({ firstName: 'there', state: 'invalid' }), 404)
  }
  const inv = invitation as InvitationRow
  const firstName = inv.contact_first_name || 'there'

  // GHOST-MEETING GUARD — if the audit flagged this contact_email as belonging
  // to a different person, refuse the booking and page Gideon. Prevents the
  // Ilit/Doron class of bug where the calendar invite lands in the wrong inbox.
  const { data: invFlag } = await supabase
    .from('invitations')
    .select('email_audit_flag')
    .eq('id', token)
    .maybeSingle()
  if ((invFlag as { email_audit_flag?: string } | null)?.email_audit_flag === 'high') {
    await pageGideonCritical(`Bookings BLOCKED: email audit flag HIGH for ${firstName}`, {
      token,
      contact_email: inv.contact_email,
      reason: 'email_audit_high — wrong-person address; secretary must verify',
    })
    return htmlResponse(pageHtml({ firstName, state: 'invalid', message: 'A team member will follow up directly within minutes to confirm.' }), 409)
  }

  if (inv.status !== 'sent') {
    return htmlResponse(pageHtml({ firstName, state: 'used' }), 410)
  }
  if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) {
    return htmlResponse(pageHtml({ firstName, state: 'expired' }), 410)
  }

  // Captain 2026-05-24: capture recipient email at confirm time when not on
  // file. If invitation has no contact_email but the recipient typed one into
  // the optional email input on the booking/picker page, persist it to the
  // invitation row so the downstream confirmation email + calendar invite
  // gets delivered to them.
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
      console.warn('[bookings.confirm] email capture failed', { token, err: (err as Error).message })
    }
  }

  const slot: Slot = {
    iso: slotIso,
    display: formatSlotDisplay(slotIso),
  }

  // ── SLOT LOCK — never double-book. Gideon 2026-06-18 ────────────────────────
  // Before confirming, reject the slot if it's already taken:
  //  (A) another invitation is already confirmed at this exact time, or
  //  (B) Gideon's calendar is otherwise busy then.
  // On a clash, send the recipient to the open-calendar picker with a
  // "just taken" notice — do NOT create a colliding meeting.
  {
    const slotStart = new Date(slot.iso)
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000)
    const slotMs = slotStart.getTime()
    let taken = false
    try {
      // Compare by INSTANT, not by text. A slot stored as "…-05:00" and the same
      // moment stored as "…Z" are different strings but the same time — exact
      // string matching missed that and double-booked. Page all confirmed rows
      // and flag any whose 30-min window overlaps this one.
      const confirmed: Array<{ id: string; confirmed_slot_iso: string | null }> = []
      for (let from = 0; from < 50000; from += 1000) {
        const { data } = await supabase.from('invitations').select('id, confirmed_slot_iso').eq('status', 'confirmed').neq('id', token).range(from, from + 999)
        const rows = (data || []) as Array<{ id: string; confirmed_slot_iso: string | null }>
        confirmed.push(...rows)
        if (rows.length < 1000) break
      }
      if (confirmed.some((r) => { const t = r.confirmed_slot_iso ? new Date(r.confirmed_slot_iso).getTime() : NaN; return !isNaN(t) && Math.abs(t - slotMs) < 30 * 60 * 1000 })) taken = true
    } catch { /* if the check fails, fall through to the freebusy check */ }
    if (!taken) {
      try {
        const busy = await getBusyTimes(
          new Date(slotStart.getTime() - 60_000).toISOString(),
          new Date(slotEnd.getTime() + 60_000).toISOString(),
        )
        if (slotOverlapsBusy(slot.iso, 30, busy)) taken = true
      } catch { /* freebusy unavailable — allow, the confirmed-row check above is primary */ }
    }
    if (taken) {
      const appUrlBase = (process.env.NEXT_PUBLIC_APP_URL || 'https://project-7e87w.vercel.app').replace(/\/$/, '')
      return new Response(null, { status: 303, headers: { Location: `${appUrlBase}/invite/${token}/choose?taken=1` } })
    }
  }

  const errors: Array<{ step: string; message: string }> = []
  let zoomMeetingId: string | null = null
  let zoomJoinUrl: string | null = null
  let calendarEventId: string | null = null

  // Step 1: mark invitation confirmed
  try {
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'confirmed', confirmed_slot_iso: slot.iso })
      .eq('id', token)
    if (error) throw new Error(error.message)
  } catch (err) {
    errors.push({ step: '1_status_update', message: (err as Error).message })
    await pageGideonCritical(`Bookings: failed to mark invitation confirmed for ${firstName}`, { token, slot, err: (err as Error).message })
  }

  // Step 2: create Zoom meeting
  try {
    const meeting = await createMeeting('me', {
      topic: `Terminal Introduction — ${firstName}`,
      start_time: slot.iso,
      duration: 30,
      timezone: 'America/Chicago',
    })
    zoomMeetingId = String(meeting.id)
    zoomJoinUrl = meeting.join_url
  } catch (err) {
    errors.push({ step: '2_zoom_create', message: (err as Error).message })
    await pageGideonCritical(`Bookings: Zoom meeting create failed for ${firstName}`, { token, slot, err: (err as Error).message })
  }

  // Captain hotfix 2026-05-19: if dynamic Zoom create failed, fall back to
  // STATIC_ZOOM_FALLBACK_URL (Gideon's personal scheduler/PMI link). This
  // keeps the booking flow whole — calendar invite, confirmation email,
  // WhatsApp + PagerDuty downstream all use the fallback URL, recipient
  // never sees a half-broken page.
  if (!zoomJoinUrl) {
    const staticFallback = process.env.STATIC_ZOOM_FALLBACK_URL
    if (staticFallback) {
      zoomJoinUrl = staticFallback
      zoomMeetingId = 'static'
      errors.push({ step: '2_zoom_static_fallback_used', message: 'Dynamic create failed; using STATIC_ZOOM_FALLBACK_URL' })
    }
  }

  // Captain hotfix 2026-05-20: persist Zoom URL inline (the recipient page
  // needs it on render), then push all OTHER side-effects (Calendar invite,
  // confirmation email, WhatsApp confirmation, PagerDuty schedule, Pipedrive
  // activity) to next/server `after()` so they run AFTER the 303 redirect
  // ships. Net: ~3-4s critical path → ~1-2s (Zoom create + Zoom persist).
  if (zoomMeetingId && zoomJoinUrl) {
    try {
      const { error } = await supabase
        .from('invitations')
        .update({ zoom_meeting_id: zoomMeetingId, zoom_join_url: zoomJoinUrl })
        .eq('id', token)
      if (error) throw new Error(error.message)
    } catch (err) {
      errors.push({ step: '3_persist_zoom', message: (err as Error).message })
      void pageGideonCritical(`Bookings: failed to persist Zoom IDs for ${firstName}`, { token, zoom_id: zoomMeetingId, err: (err as Error).message })
    }
  }

  // Build the background-work bundle. Runs via after() after the redirect ships.
  const backgroundTasks: Promise<void>[] = []

  // Task B — create Calendar event → then persist calendar id (Steps 4 + 5 chained)
  if (zoomJoinUrl) {
    backgroundTasks.push((async () => {
      try {
        const start = new Date(slot.iso)
        const end = new Date(start.getTime() + 30 * 60 * 1000)
        const eventId = await createCalendarEvent({
          summary: `Terminal Introduction — ${firstName}`,
          description: 'Terminal introduction call. 30 minutes.',
          startTime: slot.iso,
          endTime: end.toISOString(),
          // Gideon 2026-06-18: every booked Terminal meeting also lands on the
          // team's calendars. Recipient first, then the standing meeting team.
          // Gideon 2026-06-18: removed Chaim from auto-invites; Shirel + Steve only.
          attendees: [
            ...(inv.contact_email ? [inv.contact_email] : []),
            'shirel@reprime.com',
            'steve@reprime.com',
          ],
          zoomLink: zoomJoinUrl,
          location: zoomJoinUrl,
        })
        calendarEventId = eventId ?? null
      } catch (err) {
        errors.push({ step: '4_calendar_create', message: (err as Error).message })
        await pageGideonCritical(`Bookings: Calendar event create failed for ${firstName}`, { token, slot, err: (err as Error).message })
        return
      }
      if (calendarEventId) {
        try {
          const { error } = await supabase
            .from('invitations')
            .update({ calendar_event_id: calendarEventId })
            .eq('id', token)
          if (error) throw new Error(error.message)
        } catch (err) {
          errors.push({ step: '5_persist_calendar', message: (err as Error).message })
          await pageGideonCritical(`Bookings: failed to persist calendar event id for ${firstName}`, { token, err: (err as Error).message })
        }
      }
    })())
  }

  // Task C — confirmation email.
  // Gideon 2026-06-18: g@reprime-terminal.com is retired. The recipient's
  // confirmation now rides on the Google Calendar invite, which createCalendarEvent
  // sends from g@reprime.com (sendUpdates:'all') with the Zoom link in the
  // location + description and the time in the recipient's own timezone. No
  // SendGrid / terminal.com email is sent anymore.

  // Task D — WhatsApp confirmation (Step 7) — runs in background
  if (inv.contact_phone && zoomJoinUrl) {
    backgroundTasks.push((async () => {
      try {
        const chatId = await findChatIdForPhone('305', inv.contact_phone!)
        if (chatId) {
          const text = `${firstName} — confirmed: ${slot.display}.\n\nZoom: ${zoomJoinUrl}\n\nSee you then.\n— Gideon`
          await sendMessage({
            phone: inv.contact_phone!,
            text,
            whatsappAccountPhone: PANEL_ACCOUNT_MAP['305'],
          })
        } else {
          errors.push({ step: '7_whatsapp_confirmation', message: 'no_existing_chat' })
        }
      } catch (err) {
        errors.push({ step: '7_whatsapp_confirmation', message: (err as Error).message })
        await pageGideonCritical(`Bookings: WhatsApp confirmation failed for ${firstName}`, { token, phone: inv.contact_phone, err: (err as Error).message })
      }
    })())
  }

  // Task E — PagerDuty T-10 + T-1 schedule (Step 8) — runs in background
  backgroundTasks.push((async () => {
  try {
    const redis = getRedis()
    if (!redis) throw new Error('upstash_not_configured')
    const slotMs = new Date(slot.iso).getTime()
    const tMinus10Ms = slotMs - 10 * 60 * 1000
    const tMinus1Ms = slotMs - 1 * 60 * 1000

    const tMinus10Member = JSON.stringify({
      summary: `${firstName} Terminal in 10 min — Zoom: ${zoomJoinUrl ?? 'n/a'}`,
      severity: 'warning',
      customDetails: { contact: inv.contact_name, slot: slot.display, zoom: zoomJoinUrl, token },
      dedupKey: `terminal:${token}:t-10`,
    })
    const tMinus1Member = JSON.stringify({
      summary: `${firstName} Terminal in 1 min`,
      severity: 'critical',
      customDetails: { contact: inv.contact_name, slot: slot.display, zoom: zoomJoinUrl, token },
      dedupKey: `terminal:${token}:t-1`,
    })

    if (tMinus10Ms > Date.now()) {
      await redis.zadd(PD_QUEUE_KEY, { score: tMinus10Ms, member: tMinus10Member })
    }
    if (tMinus1Ms > Date.now()) {
      await redis.zadd(PD_QUEUE_KEY, { score: tMinus1Ms, member: tMinus1Member })
    }
  } catch (err) {
    errors.push({ step: '8_pagerduty_schedule', message: (err as Error).message })
    await pageGideonCritical(`Bookings: PagerDuty schedule failed for ${firstName}`, { token, err: (err as Error).message })
  }
  })())

  // Task F — Pipedrive activity (Step 9) — runs in background
  if (inv.contact_pipedrive_id) {
    backgroundTasks.push((async () => {
    try {
      const slotDate = new Date(slot.iso)
      const yyyy = slotDate.getFullYear()
      const mm = String(slotDate.getMonth() + 1).padStart(2, '0')
      const dd = String(slotDate.getDate()).padStart(2, '0')
      const hh = String(slotDate.getHours()).padStart(2, '0')
      const mn = String(slotDate.getMinutes()).padStart(2, '0')
      await createActivity({
        type: 'meeting',
        subject: 'Terminal Introduction',
        person_id: inv.contact_pipedrive_id!,
        due_date: `${yyyy}-${mm}-${dd}`,
        due_time: `${hh}:${mn}`,
        duration: '00:30',
        note: zoomJoinUrl
          ? `Confirmed via Terminal invitation.\nZoom: ${zoomJoinUrl}\nSlot: ${slot.display}`
          : `Confirmed via Terminal invitation.\nSlot: ${slot.display}`,
      })
    } catch (err) {
      errors.push({ step: '9_pipedrive_activity', message: (err as Error).message })
      await pageGideonCritical(`Bookings: Pipedrive activity failed for ${firstName}`, { token, err: (err as Error).message })
    }
    })())
  }

  // Task G — group nudge: someone just booked. The win, straight to the
  // "Terminal invitations" group.
  backgroundTasks.push(notifyGroup(`📅 ${inv.contact_name || firstName} just booked — ${slot.display}.`))

  // Task H — wrong-person email heads-up (ghost-meeting prevention). If the
  // address that booked doesn't look like THIS contact's own (e.g. "Nadav
  // Goldman" booked via pazit.goldman@…), the calendar invite + Zoom just landed
  // in someone else's inbox — the exact cause of "booked but nobody shows."
  // Flag it 'review' and ping the team so the real investor is reached on
  // WhatsApp before the call. Not a hard block — the booking still stands.
  if (inv.contact_email && emailLikelyWrongPerson(inv.contact_first_name, inv.contact_email)) {
    backgroundTasks.push((async () => {
      try {
        await supabase.from('invitations').update({ email_audit_flag: 'review' }).eq('id', token).is('email_audit_flag', null)
      } catch { /* flag best-effort */ }
      try {
        await notifyGroup(`⚠ ${inv.contact_name || firstName} booked ${slot.display} using ${inv.contact_email} — that doesn't look like ${firstName}'s own address. Confirm the invite reached ${firstName} (WhatsApp) so it isn't a no-show.`)
      } catch { /* nudge best-effort */ }
    })())
  }

  // Push all background work to next/server after(). These run AFTER the
  // 303 redirect ships to the recipient, so the page lands in ~1-2s instead
  // of waiting for Calendar + Email + WhatsApp + PagerDuty + Pipedrive (all
  // of which can take another 1-2s combined).
  after(async () => {
    await Promise.allSettled(backgroundTasks)
    if (errors.length > 0) {
      console.error('[bookings.confirm] post-response partial failures', { token, errors })
    }
  })

  // Captain hotfix 2026-05-20: instead of returning a bespoke "Locked in"
  // HTML page (which drifted from the locked Screen 3 design), 303-redirect
  // the recipient back to /invite/{token}. The invitation row now has
  // status='confirmed' + confirmed_slot_iso + zoom_join_url (or null if Zoom
  // failed), so page.tsx renders the locked Screen 3 confirmation surface
  // — cream letter bubble, meeting details, Add Attendee, calendar buttons,
  // reschedule link — exactly per _terminal-design-reference/03_Screen3_Confirmation.html.
  // Single source of truth for the confirmation surface lives in page.tsx.
  const appUrlBase = (
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://project-7e87w.vercel.app'
  ).replace(/\/$/, '')
  return new Response(null, {
    status: 303,
    headers: { Location: `${appUrlBase}/invite/${token}` },
  })
}
