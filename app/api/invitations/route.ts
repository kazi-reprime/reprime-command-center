import { NextResponse, type NextRequest } from 'next/server'
import { after } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { lookupByName } from '@/lib/contact-directory/client'
import { sendEmail } from '@/lib/sendgrid/client'
import { appendOutreachRow } from '@/lib/google/sheets'
import {
  detectLocale,
  formatSlotForLocale,
  periodLabelForLocale,
  type Locale,
} from '@/lib/scheduling/pick-three-slots'

export const dynamic = 'force-dynamic'

type CreateBody = {
  contact_first_name?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  contact_pipedrive_id?: number | null
  proposed_slots?: Array<{ iso: string; display: string }>
  meeting_type?: 'terminal' | 'meeting' | null
  expires_in_days?: number
  // Captain 2026-05-24: opt-out for the parallel SendGrid invitation email.
  // Default = true. Set false if you only want WhatsApp (e.g. close friends
  // where an email feels too formal).
  send_email?: boolean
  // Captain 2026-05-26: explicit locale override. If omitted, auto-detected
  // from phone (+972 → 'il'). Forces the slot times + period labels to render
  // in Israel time (with "Israel" suffix) and resets the proposed_slots.display
  // strings on the DB row + email body.
  locale?: Locale
}

// Captain hotfix 2026-05-24: CORS allowed for cross-origin mints (Chrome
// extension running on web.whatsapp.com or any other tab needs to fetch
// this endpoint directly). Security gate is the X-Captain-Token header,
// not the origin — so `*` is acceptable here.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Captain-Token, Authorization',
  'Access-Control-Max-Age': '86400',
}

function corsJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: CORS_HEADERS,
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  // Captain hotfix 2026-05-20: switched from cookie-based g@reprime.com check
  // to X-Captain-Token header so the Chrome Extension can mint directly via
  // fetch() from any origin (no need to be on the dashboard tab with an
  // active Supabase session). Token lives in process.env.CAPTAIN_API_TOKEN.
  // Cookie auth still works as a fallback for the dashboard composer.
  const captainToken = request.headers.get('x-captain-token') || request.headers.get('X-Captain-Token')
  const expectedToken = process.env.CAPTAIN_API_TOKEN
  const tokenOk = captainToken && expectedToken && captainToken === expectedToken

  if (!tokenOk) {
    // Fall back to cookie auth (legacy path for the dashboard composer)
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || user.email !== 'g@reprime.com') {
      return corsJson(
        { error: 'unauthorized', message: 'Provide X-Captain-Token header or sign in as g@reprime.com' },
        { status: 401 }
      )
    }
  }

  let payload: CreateBody
  try {
    payload = (await request.json()) as CreateBody
  } catch {
    return corsJson({ error: 'invalid_json' }, { status: 400 })
  }

  const firstName = (payload.contact_first_name || '').trim() || null
  const fullName = (payload.contact_name || '').trim() || null

  if (!firstName && !fullName) {
    return corsJson(
      { error: 'name_required', message: 'contact_first_name or contact_name is required' },
      { status: 400 }
    )
  }

  const id = randomUUID()
  const expiresInDays = Math.max(1, Math.min(60, payload.expires_in_days ?? 14))
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()

  // Captain 2026-05-24: when no email is provided in the mint payload but we
  // have a name, try to auto-resolve from contact_directory (the 1500+ row
  // master from RePrime_Command_Center_Master.xlsx). If found, the recipient
  // never sees the email input on the booking page — confirmation email + ICS
  // attendee invite go to them automatically the moment they pick a slot.
  let resolvedEmail: string | null = payload.contact_email ?? null
  let emailSource: 'caller' | 'directory' | null = resolvedEmail ? 'caller' : null
  if (!resolvedEmail && (fullName || firstName)) {
    try {
      const hit = await lookupByName(fullName || firstName)
      if (hit?.primary_email) {
        resolvedEmail = hit.primary_email
        emailSource = 'directory'
      }
    } catch (err) {
      console.warn('[invitations.mint] contact-directory lookup failed', (err as Error).message)
    }
  }

  // Captain 2026-05-26: locale-aware display strings on proposed_slots.
  // For Israeli contacts ('il'), rewrite each slot.display to show Israel
  // wall-clock time (e.g. "Tuesday, May 26 · 4:00 PM Israel") instead of
  // Central. Stored on the DB row so /invite page + email + Pipedrive
  // activity all see the locale-correct text.
  const locale: Locale =
    payload.locale ?? detectLocale(payload.contact_phone ?? null, fullName || firstName)
  const localizedSlots = (payload.proposed_slots ?? []).map((s) => ({
    iso: s.iso,
    display: formatSlotForLocale(s.iso, locale),
  }))

  const row = {
    id,
    contact_first_name: firstName,
    contact_name: fullName,
    contact_email: resolvedEmail,
    contact_phone: payload.contact_phone ?? null,
    contact_pipedrive_id: payload.contact_pipedrive_id ?? null,
    proposed_slots: localizedSlots,
    meeting_type: payload.meeting_type ?? 'terminal',
    status: 'sent' as const,
    expires_at: expiresAt,
  }

  const service = createServiceClient()
  const { error: insertErr } = await service.from('invitations').insert(row)

  if (insertErr) {
    return corsJson(
      { error: 'db_insert_failed', message: insertErr.message },
      { status: 500 }
    )
  }

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || 'https://project-7e87w.vercel.app'
  ).replace(/\/$/, '')
  const invite_url = `${appUrl}/invite/${id}`

  // Captain hotfix 2026-05-24: pre-warm the OG image at Vercel's edge cache
  // immediately after mint, so WhatsApp's link-preview fetcher (which has
  // a tight ~2-5s timeout) gets the gold-card PNG instantly on first send
  // instead of timing out on the cold ~2-4s Satori render. Without this,
  // recipients sometimes see a small text-card preview instead of the big
  // Imperial Gold + Brand Navy card. Fire-and-forget via after() so the
  // mint response returns in <100ms.
  after(async () => {
    try {
      const ogUrl = `${appUrl}/invite/${id}/opengraph-image`
      const res = await fetch(ogUrl, { cache: 'no-store' })
      if (!res.ok) {
        console.warn('[invitations] OG pre-warm non-OK:', res.status, ogUrl)
      } else {
        // Consume the body so the edge cache fully populates
        await res.arrayBuffer()
        console.log('[invitations] OG pre-warmed:', id, 'bytes:', res.headers.get('content-length'))
      }
    } catch (err) {
      console.warn('[invitations] OG pre-warm failed:', (err as Error).message)
    }
  })

  // Captain 2026-05-24: parallel SendGrid invitation email at mint time.
  // Recipient gets WhatsApp (when Gideon sends) + email simultaneously. They
  // engage via whichever channel they prefer first. Both point at the same
  // magic link → same booking flow. Fires in background via after().
  // Skip if: send_email explicitly false, OR no email resolved, OR no slots.
  //
  // Email markup MIRRORS the locked design at
  //   dashboard/_terminal-design-reference/00_Email_Page.html
  // — Imperial Gold #FFCC33 + Brand Navy #0E3470 + Cinzel/Playfair/EB Garamond
  // — cream letter bubble with the personal note
  // — each proposed slot is its own clickable bordered button (Eslot pattern)
  // — "Different Time?" link routes to /invite/[token]/choose (Calendly grid)
  //
  // Adjustments from the static HTML for email-client safety:
  //   • SVG spindles → flat gold hairlines (Gmail/Outlook strip SVG)
  //   • SVG pointy-tip bubble → standard bordered <table> with cream gradient
  //   • Web-font @import retained (Gmail+Apple Mail honor it; Outlook falls
  //     back gracefully to Georgia / Arial — declared via font-family stack)
  const wantEmail = payload.send_email !== false
  const recipientFirst = firstName || (fullName ? fullName.split(' ')[0] : 'there')
  const recipientFull = fullName || firstName || 'there'
  if (wantEmail && resolvedEmail && (payload.proposed_slots?.length ?? 0) > 0) {
    after(async () => {
      try {
        // Captain 2026-05-26: use the locale-rewritten slots so the email
        // body shows "4:00 PM Israel" for IL contacts instead of "8:00 AM
        // Central" (the same instant in time, but the right wall-clock for
        // the recipient).
        const slots = localizedSlots

        // ── Helpers ──
        const periodLabel = (iso: string): string =>
          periodLabelForLocale(iso, locale)
        const dayLabel = (iso: string): string => {
          try {
            const tz = locale === 'il' ? 'Asia/Jerusalem' : 'America/Chicago'
            return new Intl.DateTimeFormat('en-US', {
              timeZone: tz,
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }).format(new Date(iso))
          } catch {
            return ''
          }
        }
        const escapeHtml = (s: string) =>
          s.replace(/[&<>"']/g, (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
          )

        // ── Slots label: "Suggested times — Tuesday, May 5" if all same day,
        // else generic "Suggested times" ──
        const firstDay = slots[0] ? dayLabel(slots[0].iso) : ''
        const allSameDay = slots.every((s) => dayLabel(s.iso) === firstDay)
        const slotsLabel = firstDay && allSameDay
          ? `Suggested times — ${firstDay}`
          : 'Suggested times'

        // ── Per-slot bordered button (Eslot pattern) ──
        const slotButtonsHtml = slots.slice(0, 5).map((s) => {
          const slotUrl = `${invite_url}?slot=${encodeURIComponent(s.iso)}`
          const period = periodLabel(s.iso)
          return `<a href="${slotUrl}" style="display:block;width:100%;padding:14px 20px;border:1px solid rgba(255,204,51,0.35);text-align:center;text-decoration:none;margin:0 0 8px;box-sizing:border-box;background:#0E3470;">
            <div style="font-family:'Poppins',Arial,sans-serif;font-size:11px;color:#FFCC33;letter-spacing:0.20em;text-transform:uppercase;font-weight:600;text-indent:0.20em;opacity:0.85;">${escapeHtml(period)}</div>
            <div style="font-family:'Playfair Display',Georgia,serif;font-size:22px;color:#FFCC33;font-weight:400;margin-top:4px;line-height:1.2;">${escapeHtml(s.display)}</div>
          </a>`
        }).join('')

        // Plain text fallback (Speechify + non-HTML clients)
        const slotPlainList = slots.slice(0, 5).map((s) => `• ${s.display}`).join('\n')
        const subject = `A private introduction from Gideon Gratsiani — ${recipientFirst}`
        const text = `${recipientFirst} —

I've been building something privately for two years, and you're one of the very first people I want to show it to. Thirty minutes, just us.

By Invitation Only · Private Membership

${slotsLabel}:
${slotPlainList}

Pick a time:
${invite_url}

Different time? ${appUrl}/invite/${id}/choose

Short walkthrough from the inside (4 minutes):
https://youtu.be/khHY1V2ttGU

— Gideon
Gideon Gratsiani, Founder
RePrime Group`

        // ── Cream letter body ──
        const personalNoteHtml = `${escapeHtml(recipientFirst)} — I've been building something privately for two years, and you're one of the very first people I want to show it to. Thirty minutes, just us.`

        // ── HTML email — mirrors the locked design ──
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(subject)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;1,400&display=swap');
body { margin:0; padding:0; }
a { text-decoration: none; }
</style>
</head>
<body style="margin:0;padding:0;background:#DDD9D2;font-family:'Poppins',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#DDD9D2;padding:40px 20px;">
<tr><td align="center">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#0E3470;border:1px solid rgba(255,204,51,0.22);border-radius:2px;">

  <!-- HEADER — TERMINAL wordmark between gold hairlines -->
  <tr><td style="padding:22px 48px 20px;text-align:center;border-bottom:1px solid rgba(255,204,51,0.18);">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="70%" style="margin:0 auto 11px;"><tr><td style="height:2px;background:#FFCC33;line-height:1px;font-size:0;">&nbsp;</td></tr></table>
    <div style="font-family:'Cinzel',Georgia,serif;font-size:26px;letter-spacing:0.145em;color:#FFCC33;font-weight:600;text-indent:0.145em;margin:11px 0;">TERMINAL</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="70%" style="margin:11px auto 0;"><tr><td style="height:2px;background:#FFCC33;line-height:1px;font-size:0;">&nbsp;</td></tr></table>
  </td></tr>

  <!-- HERO — Private Introduction + recipient name -->
  <tr><td style="padding:34px 48px 22px;text-align:center;">
    <div style="font-family:'Poppins',Arial,sans-serif;font-size:9px;letter-spacing:0.30em;color:#FFCC33;font-weight:600;text-transform:uppercase;text-indent:0.30em;margin-bottom:14px;opacity:0.85;">Private Introduction</div>
    <div style="font-family:'Playfair Display',Georgia,serif;font-size:56px;color:#FFCC33;font-weight:600;line-height:1.0;letter-spacing:-0.01em;">${escapeHtml(recipientFull)}</div>
  </td></tr>

  <!-- CREAM LETTER — the personal note (pointy-tip bubble in the design;
       email-safe version: standard bordered table with cream gradient) -->
  <tr><td style="padding:0 36px 26px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F4E8CC;border:1px solid rgba(255,204,51,0.30);border-radius:4px;">
      <tr><td style="padding:30px 28px;text-align:center;background:linear-gradient(180deg,#F8F0DA 0%,#EFE2C4 100%);">
        <div style="font-family:'Playfair Display',Georgia,serif;font-size:13px;color:#7A5A30;font-style:italic;margin-bottom:11px;">A personal note from <span style="font-weight:600;color:#5A3F18;">Gideon Gratsiani</span></div>
        <div style="font-family:'Playfair Display',Georgia,serif;font-size:15px;color:#0E3470;line-height:1.7;font-style:italic;">${personalNoteHtml}</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- MEMBERSHIP -->
  <tr><td style="padding:24px 48px;text-align:center;border-top:1px solid rgba(255,204,51,0.18);border-bottom:1px solid rgba(255,204,51,0.18);">
    <div style="font-family:'Playfair Display',Georgia,serif;font-size:28px;color:#FFCC33;font-weight:400;font-style:italic;">Private Membership</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:13px auto;"><tr><td style="width:5px;height:5px;background:#FFCC33;border-radius:50%;font-size:0;line-height:1px;">&nbsp;</td></tr></table>
    <div style="font-family:'Playfair Display',Georgia,serif;font-size:36px;color:#FFCC33;font-weight:400;font-style:italic;">By Invitation Only</div>
  </td></tr>

  <!-- SLOT BUTTONS — each is an Eslot link straight to /invite/[token]?slot= -->
  <tr><td style="padding:28px 48px 0;">
    <div style="font-family:'Poppins',Arial,sans-serif;font-size:11px;letter-spacing:0.24em;color:#FFCC33;text-transform:uppercase;font-weight:600;text-align:center;margin-bottom:16px;text-indent:0.24em;opacity:0.85;">${escapeHtml(slotsLabel)}</div>
    ${slotButtonsHtml}
    <a href="${appUrl}/invite/${id}/choose" style="display:block;width:100%;padding:14px 20px;border:1px solid rgba(255,204,51,0.35);text-align:center;text-decoration:none;margin:0;box-sizing:border-box;background:#0E3470;">
      <div style="font-family:'Poppins',Arial,sans-serif;font-size:11px;color:#FFCC33;letter-spacing:0.20em;text-transform:uppercase;font-weight:600;text-indent:0.20em;opacity:0.85;">Different Time?</div>
      <div style="font-family:'Playfair Display',Georgia,serif;font-size:28px;color:#FFCC33;font-weight:400;margin-top:4px;line-height:1.2;">Choose your own date and time →</div>
    </a>
  </td></tr>

  <!-- WALKTHROUGH VIDEO -->
  <tr><td style="padding:18px 48px 0;text-align:center;">
    <a href="https://youtu.be/khHY1V2ttGU" style="font-family:'Poppins',Arial,sans-serif;font-size:13px;color:#FFCC33;text-decoration:underline;letter-spacing:0.04em;">▶ Short walkthrough from the inside · 4 min</a>
  </td></tr>

  <!-- CONFIRM tagline -->
  <tr><td style="padding:18px 48px 26px;text-align:center;">
    <div style="font-family:'Poppins',Arial,sans-serif;font-size:10px;color:#FFCC33;line-height:1.85;letter-spacing:0.04em;opacity:0.7;">One click confirms · Zoom link follows immediately · Thirty minutes · No preparation needed</div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:22px 48px;border-top:1px solid rgba(255,204,51,0.18);text-align:center;">
    <div style="font-family:'Playfair Display',Georgia,serif;font-size:16px;color:#FFCC33;font-weight:600;letter-spacing:0.10em;text-indent:0.10em;">TERMINAL</div>
    <div style="font-family:'EB Garamond',Georgia,serif;font-style:italic;font-size:13px;color:#FFCC33;margin-top:4px;opacity:0.75;">by RePrime</div>
    <div style="font-family:'Poppins',Arial,sans-serif;font-size:8px;color:#FFCC33;margin-top:11px;letter-spacing:0.06em;opacity:0.55;">This invitation was sent personally. Reply directly to Gideon.</div>
  </td></tr>

</table>

</td></tr>
</table>
</body>
</html>`

        await sendEmail({
          to: resolvedEmail,
          from: process.env.SENDGRID_FROM_EMAIL || 'g@reprime-terminal.com',
          replyTo: 'g@reprime.com',
          subject,
          html,
          text,
        })
        console.log('[invitations] invitation email sent:', id, 'to:', resolvedEmail)
      } catch (err) {
        console.warn('[invitations] invitation email failed:', (err as Error).message)
      }
    })
  }

  // Captain 2026-05-25: append a row to the Terminal Outreach Tracker
  // spreadsheet (Sheet1!A:Q). This is the durable audit trail Gideon checks
  // when he wants to follow up — every mint shows up automatically with the
  // invite link, the resolved email, the slots that went out, and the
  // dispatch status. Fire-and-forget via after() so it doesn't block the
  // mint response. Failures are logged, not raised.
  const emailDispatchedFlag = Boolean(
    wantEmail && resolvedEmail && (payload.proposed_slots?.length ?? 0) > 0
  )
  after(async () => {
    try {
      // Build the message_draft as Gideon's standard personal note + URL,
      // matching what /compose's Copy Message button puts on the clipboard.
      const draftLine = `${recipientFirst} — this is Gideon. I've been building something privately and you're one of the very first people I want to show it to. Pick a time below — 30 minutes, just us.\n\n${invite_url}`
      await appendOutreachRow({
        first_name: firstName,
        full_name: fullName,
        phone: payload.contact_phone ?? null,
        panel: null,         // filled by future WhatsApp send webhook
        language: null,      // filled if we add language detection
        tier: null,          // filled if we add directory tier lookup
        observation: null,   // Gideon's free-form column
        invite_id: id,
        invite_url,
        proposed_slots: localizedSlots,
        message_draft: draftLine,
        contact_email: resolvedEmail,
        email_source: emailSource,
        email_dispatched: emailDispatchedFlag,
      })
    } catch (err) {
      console.warn('[invitations] sheet append failed:', (err as Error).message)
    }
  })

  return corsJson({
    id,
    invite_url,
    expires_at: expiresAt,
    contact_email: resolvedEmail,
    email_source: emailSource,  // 'caller' | 'directory' | null
    email_dispatched: emailDispatchedFlag,
  })
}
