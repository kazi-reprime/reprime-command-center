import type { Metadata } from 'next'
import { Cinzel, EB_Garamond, Playfair_Display } from 'next/font/google'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getBusyTimes, slotOverlapsBusy } from '@/lib/google/calendar'

// Locked brand fonts per dashboard/_terminal-design-reference/brand/TerminalLogo.jsx
// and 01_Screen1_OG_Card.html. Loaded via next/font for self-hosting + zero CLS.
const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--rp-font-cinzel',
  display: 'swap',
})
const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400'],
  style: ['italic'],
  variable: '--rp-font-eb-garamond',
  display: 'swap',
})
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--rp-font-playfair',
  display: 'swap',
})

// Locked brand tokens — sourced from dashboard/lib/design-tokens.ts.
const NAVY = '#0E3470'
const GOLD = '#FFCC33'
const GOLD_RGB = '255, 204, 51'
const BRONZE_BOLD = '#5A3F18'
const BRONZE_SOFT = '#7A5A30'

const FONT_NAME = `var(--rp-font-playfair), 'Playfair Display', Georgia, serif`
const FONT_TERMINAL = `var(--rp-font-cinzel), Cinzel, 'Trajan Pro', Georgia, serif`
const FONT_BY = `var(--rp-font-eb-garamond), 'EB Garamond', Garamond, Georgia, serif`
const FONT_BODY = `'Poppins', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif`

interface SlotGroup {
  date: string
  label: string
  times: Array<{ iso: string; display: string }>
}

interface Invitation {
  contact_first_name: string | null
  contact_name: string | null
  contact_email: string | null
  proposed_slots: Array<{ iso: string; display: string }>
  status: 'sent' | 'confirmed' | 'expired' | 'cancelled'
  expires_at: string | null
  meeting_type: 'terminal' | 'meeting' | null
  view_count: number | null
  first_opened_at: string | null
  confirmed_slot_iso: string | null
  zoom_meeting_id: string | null
  zoom_join_url: string | null
  zoom_passcode: string | null
  calendar_event_id: string | null
}

async function loadInvitation(token: string): Promise<{ invitation: Invitation | null; reason: 'not_found' | 'expired' | 'cancelled' | null }> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('invitations')
    .select('contact_first_name, contact_name, contact_email, proposed_slots, status, expires_at, meeting_type, view_count, first_opened_at, confirmed_slot_iso, zoom_meeting_id, zoom_join_url, zoom_passcode, calendar_event_id')
    .eq('id', token)
    .maybeSingle()
  if (error || !data) return { invitation: null, reason: 'not_found' }
  const inv = data as Invitation
  if (inv.status === 'cancelled') return { invitation: inv, reason: 'cancelled' }
  if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) {
    return { invitation: inv, reason: 'expired' }
  }
  // Track this open — fire and move on (non-blocking).
  // NOTE: we deliberately do NOT group-nudge on open — WhatsApp/email preview
  // bots and Apple/Gmail prefetch hit this URL on their own, so an open ping
  // would cry wolf. Opens are counted here and shown per-person in the Track
  // tab; the group only buzzes for real human actions (video watch, booking).
  void supabase.from('invitations').update({
    view_count: (inv.view_count ?? 0) + 1,
    first_opened_at: inv.first_opened_at ?? new Date().toISOString(),
    last_opened_at: new Date().toISOString(),
  }).eq('id', token)
  return { invitation: inv, reason: null }
}

async function loadAvailableSlots(): Promise<SlotGroup[]> {
  try {
    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://project-7e87w.vercel.app'
    ).replace(/\/$/, '')
    const res = await fetch(`${baseUrl}/api/bookings/available-slots`, { cache: 'no-store' })
    if (!res.ok) return []
    const json = (await res.json()) as { slots?: SlotGroup[] }
    return json.slots ?? []
  } catch {
    return []
  }
}

function groupProposedSlotsByDate(slots: Array<{ iso: string; display: string }>): SlotGroup[] {
  const TZ = 'America/Chicago'
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ,
  })
  const labelFmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ,
  })
  const byDate = new Map<string, SlotGroup>()
  for (const slot of slots) {
    const d = new Date(slot.iso)
    if (isNaN(d.getTime())) continue
    const dateStr = dateFmt.format(d)
    if (!byDate.has(dateStr)) {
      byDate.set(dateStr, { date: dateStr, label: labelFmt.format(d), times: [] })
    }
    byDate.get(dateStr)!.times.push(slot)
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

/** Render a Zoom URL into a short label (zoom.us/j/...) without the full path. */
function shortZoomUrl(url: string): string {
  try {
    const u = new URL(url)
    const segs = u.pathname.split('/').filter(Boolean)
    return `${u.hostname.replace(/^www\./, '')}/${segs[0] ?? ''}/…`
  } catch {
    return 'zoom.us/j/…'
  }
}

/** Format Zoom meeting ID into "###  ####  ####" groups. */
function formatMeetingId(id: string | null | undefined): string | null {
  if (!id) return null
  const digits = id.replace(/\D/g, '')
  if (digits.length < 9) return id
  // Common 10-11 digit Zoom IDs render as "###-####-####" or "###  ####  ####"
  if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`
  if (digits.length === 11) return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`
  return digits
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://project-7e87w.vercel.app').replace(/\/$/, '')

  const supabase = createServiceClient()
  const { data: inv } = await supabase
    .from('invitations')
    .select('contact_first_name, contact_name')
    .eq('id', token)
    .maybeSingle()

  const displayName = inv?.contact_name || inv?.contact_first_name || 'Guest'
  const title = `Terminal Introduction — ${displayName}`
  const description = 'Select a time. One click confirms.'
  // Prefer the pre-rendered STATIC card in Supabase storage (served from CDN,
  // instant) so WhatsApp's link-preview crawler never times out and the big navy
  // card renders. Fall back to the dynamic edge route if the static card hasn't
  // been warmed yet (older invites / un-warmed). See /api/center/warm-card.
  const dynamicImage = `${appUrl}/invite/${token}/opengraph-image`
  let imageUrl = dynamicImage
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (sbUrl) {
    const staticImage = `${sbUrl.replace(/\/$/, '')}/storage/v1/object/public/terminal-cards/${token}.png`
    try {
      const head = await fetch(staticImage, { method: 'HEAD', cache: 'no-store' })
      if (head.ok) imageUrl = staticImage
    } catch {
      /* keep dynamic fallback */
    }
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: 'Terminal Introduction — RePrime Group' }],
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, images: [imageUrl] },
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Reusable subcomponents
// ────────────────────────────────────────────────────────────────────────────

function GoldSpindle() {
  return (
    <div style={{ height: '7px', width: '70%', margin: '0 auto' }}>
      <svg viewBox="0 0 460 7" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="r-spindle" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"  stopColor={GOLD} stopOpacity={0} />
            <stop offset="6%"  stopColor={GOLD} stopOpacity={1} />
            <stop offset="94%" stopColor={GOLD} stopOpacity={1} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
          </linearGradient>
        </defs>
        <rect x="0" y="2.5" width="460" height="2" fill="url(#r-spindle)" />
      </svg>
    </div>
  )
}

function TerminalHeader() {
  return (
    <div style={{ padding: '22px 32px 18px', textAlign: 'center', borderBottom: `1px solid rgba(${GOLD_RGB}, 0.18)` }}>
      <GoldSpindle />
      <div style={{
        fontFamily: FONT_TERMINAL,
        fontSize: '26px',
        letterSpacing: '0.145em',
        textIndent: '0.145em',
        color: GOLD,
        fontWeight: 600,
        margin: '11px 0',
        textTransform: 'uppercase',
      }}>
        Terminal
      </div>
      <GoldSpindle />
    </div>
  )
}

function TerminalFooter() {
  return (
    <div style={{
      padding: '18px 32px',
      borderTop: `1px solid rgba(${GOLD_RGB}, 0.18)`,
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: FONT_NAME,
        fontSize: '14px',
        color: GOLD,
        fontWeight: 600,
        letterSpacing: '0.10em',
        textIndent: '0.10em',
      }}>
        TERMINAL
      </div>
      <div style={{
        fontFamily: FONT_BY,
        fontStyle: 'italic',
        fontSize: '11px',
        color: GOLD,
        marginTop: '3px',
        opacity: 0.75,
      }}>
        by RePrime
      </div>
      <div style={{
        fontFamily: FONT_BODY,
        fontSize: '8px',
        color: GOLD,
        marginTop: '10px',
        letterSpacing: '0.06em',
        opacity: 0.55,
      }}>
        This invitation was sent personally. Reply directly to Gideon.
      </div>
    </div>
  )
}

function PageShell({ children, fontClasses }: { children: React.ReactNode, fontClasses: string }) {
  return (
    <main className={fontClasses} style={{
      minHeight: '100vh',
      background: '#DDD9D2',
      padding: '24px 16px',
      display: 'flex',
      justifyContent: 'center',
      fontFamily: FONT_BODY,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 460,
        background: NAVY,
        border: `1px solid rgba(${GOLD_RGB}, 0.22)`,
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </main>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  // Captain 2026-05-24: `slot` arrives when recipient clicks a per-time link
  // inside the SendGrid invitation email. Page renders a focused "Confirm
  // this time" view instead of the multi-slot grid. NO auto-confirm — email
  // clients prefetch links, so confirmation always requires an explicit form
  // POST initiated by an actual human click.
  searchParams: Promise<{ attendee?: string; sent?: string; slot?: string }>
}) {
  const { token } = await params
  const sp = await searchParams
  const { invitation, reason } = await loadInvitation(token)

  const attendeeStatus = sp?.attendee
  const attendeeSent = sp?.sent ? parseInt(sp.sent, 10) : 0
  const preselectedSlotIso = sp?.slot ? decodeURIComponent(sp.slot) : null
  const attendeeBanner = attendeeStatus === 'ok' && attendeeSent > 0
    ? `✓ Invitation sent to ${attendeeSent} colleague${attendeeSent === 1 ? '' : 's'}. Check their inbox (and spam, just in case).`
    : attendeeStatus === 'partial'
      ? `Partial send — ${attendeeSent} reached, some failed. They should check spam first.`
      : attendeeStatus === 'missing'
        ? 'Add at least one email address.'
        : null

  const fontClasses = `${cinzel.variable} ${ebGaramond.variable} ${playfair.variable}`

  // ── Hard-failure states ────────────────────────────────────────────────────
  if (!invitation || reason) {
    const message =
      reason === 'cancelled' ? 'This invitation was cancelled.'
      : reason === 'expired' ? 'This invitation has expired.'
      : 'This invitation link is not valid.'
    return (
      <PageShell fontClasses={fontClasses}>
        <TerminalHeader />
        <div style={{ padding: '40px 32px 32px', textAlign: 'center' }}>
          <p style={{ color: GOLD, fontSize: '15px', letterSpacing: '0.02em', fontStyle: 'italic', fontFamily: FONT_NAME }}>
            {message}
          </p>
          <p style={{ color: `rgba(${GOLD_RGB}, 0.70)`, fontSize: '12px', marginTop: '14px', fontFamily: FONT_NAME, fontStyle: 'italic' }}>
            Reply to the original message and I&apos;ll sort it out.
          </p>
        </div>
        <TerminalFooter />
      </PageShell>
    )
  }

  const displayName = invitation.contact_name || invitation.contact_first_name || 'Guest'
  const firstName = invitation.contact_first_name || displayName.split(' ')[0] || 'there'
  const isTerminal = invitation.meeting_type !== 'meeting'

  // ── CONFIRMED state → Screen 3 (cream letter + meeting details) ───────────
  if (invitation.status === 'confirmed' && invitation.confirmed_slot_iso) {
    const slotDate = new Date(invitation.confirmed_slot_iso)
    const TZ = 'America/Chicago'
    const dayLine = new Intl.DateTimeFormat('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ,
    }).format(slotDate)
    // Gideon 2026-06-18: show both clocks — recipient's Israel time + Gideon's Central.
    const ilTimeC = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Jerusalem',
    }).format(slotDate)
    const ctTimeC = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: TZ,
    }).format(slotDate)
    const timeLine = `${ilTimeC} Israel · ${ctTimeC} Central`

    const zoomUrl = invitation.zoom_join_url
    const meetingIdFormatted = formatMeetingId(invitation.zoom_meeting_id)
    const zoomShort = zoomUrl ? shortZoomUrl(zoomUrl) : null

    // Captain 2026-05-24: Add-to-calendar links. Apple + Outlook get the ICS
    // download endpoint (universal calendar import format). Google gets a
    // deep-link to Google Calendar's event-create page with details prefilled.
    // (Previous hrefs pointed at /invite/[token]/calendar?provider=X, which
    // now lands on the reschedule picker — that was the dead-end loop.)
    const icsDownloadUrl = `/api/invitations/${token}/calendar.ics`
    const eventTitle = isTerminal ? `Terminal Introduction — Gideon Gratsiani` : `Meeting — Gideon Gratsiani`
    const eventStart = slotDate
    const eventEnd = new Date(slotDate.getTime() + 30 * 60 * 1000)
    const ics = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const eventDescription = [
      zoomUrl ? `Join Zoom: ${zoomUrl}` : null,
      invitation.zoom_meeting_id ? `Meeting ID: ${invitation.zoom_meeting_id}` : null,
      invitation.zoom_passcode ? `Passcode: ${invitation.zoom_passcode}` : null,
    ].filter(Boolean).join('\n')
    const googleCalUrl =
      `https://calendar.google.com/calendar/r/eventedit?` +
      `text=${encodeURIComponent(eventTitle)}` +
      `&dates=${ics(eventStart)}/${ics(eventEnd)}` +
      `&details=${encodeURIComponent(eventDescription)}` +
      (zoomUrl ? `&location=${encodeURIComponent(zoomUrl)}` : '')

    return (
      <PageShell fontClasses={fontClasses}>
        <TerminalHeader />

        {/* Attendee-send confirmation banner — surfaces ?attendee=ok&sent=N from the
            add-attendee 303 redirect so the recipient sees clear feedback. */}
        {attendeeBanner && (
          <div style={{
            margin: '14px 18px 0',
            padding: '12px 16px',
            background: attendeeStatus === 'ok' ? `rgba(34, 197, 94, 0.12)` : `rgba(${GOLD_RGB}, 0.12)`,
            border: `1px solid ${attendeeStatus === 'ok' ? 'rgba(34, 197, 94, 0.65)' : `rgba(${GOLD_RGB}, 0.50)`}`,
            borderRadius: 4,
            color: attendeeStatus === 'ok' ? '#86efac' : GOLD,
            fontFamily: FONT_BODY,
            fontSize: '14px',
            lineHeight: 1.5,
            textAlign: 'center',
          }}>
            {attendeeBanner}
          </div>
        )}

        {/* CREAM LETTER BUBBLE */}
        <div style={{ padding: '18px 12px 14px' }}>
          <div style={{ position: 'relative' }}>
            <svg viewBox="0 0 480 580" width="100%" style={{ display: 'block', filter: 'drop-shadow(0 4px 14px rgba(0, 0, 0, 0.22))' }}>
              <defs>
                <linearGradient id="bubble-bg" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#F8F0DA" />
                  <stop offset="100%" stopColor="#EFE2C4" />
                </linearGradient>
              </defs>
              <path
                d="M 18,28 L 215,28 C 222,28 234,2 240,1 C 246,2 258,28 265,28 L 462,28 Q 480,28 480,46 L 480,562 Q 480,580 462,580 L 18,580 Q 0,580 0,562 L 0,46 Q 0,28 18,28 Z"
                fill="url(#bubble-bg)"
                stroke={`rgba(${GOLD_RGB}, 0.30)`}
                strokeWidth="1"
              />
            </svg>
            <div style={{
              position: 'absolute',
              top: '6%',
              left: '6%',
              right: '6%',
              bottom: '4%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: FONT_NAME,
                fontSize: '17px',
                color: BRONZE_SOFT,
                fontStyle: 'italic',
                marginBottom: '16px',
                lineHeight: 1.4,
              }}>
                A confirmation from <span style={{ fontWeight: 600, color: BRONZE_BOLD }}>Gideon Gratsiani</span>
              </div>
              <div style={{
                fontFamily: FONT_NAME,
                fontSize: '30px',
                color: BRONZE_BOLD,
                fontWeight: 600,
                fontStyle: 'italic',
                marginBottom: '12px',
              }}>
                {firstName} —
              </div>
              <div style={{
                fontFamily: FONT_NAME,
                fontSize: '21px',
                color: NAVY,
                lineHeight: 1.55,
                fontStyle: 'italic',
              }}>
                Your {isTerminal ? 'introduction' : 'meeting'} is set.
              </div>
              <div style={{
                fontFamily: FONT_NAME,
                fontSize: '28px',
                color: NAVY,
                fontWeight: 600,
                margin: '16px 0 4px',
                letterSpacing: '-0.01em',
                lineHeight: 1.15,
              }}>
                {dayLine}
              </div>
              <div style={{
                fontFamily: FONT_NAME,
                fontSize: '28px',
                color: NAVY,
                fontWeight: 600,
                lineHeight: 1.15,
                letterSpacing: '-0.01em',
              }}>
                {timeLine}
              </div>
              <div style={{
                fontFamily: FONT_NAME,
                fontSize: '19px',
                color: NAVY,
                lineHeight: 1.5,
                fontStyle: 'italic',
                marginTop: '18px',
              }}>
                Looking forward to showing you what I&apos;ve been building.
              </div>
              <div style={{
                fontFamily: FONT_NAME,
                fontSize: '22px',
                color: BRONZE_BOLD,
                fontStyle: 'italic',
                fontWeight: 600,
                marginTop: '14px',
              }}>
                — Gideon
              </div>
            </div>
          </div>
        </div>

        {/* ADD ATTENDEE — form posts to existing /api/invitations/add-attendee */}
        <div style={{ padding: '8px 28px 18px' }}>
          <div style={{
            fontFamily: FONT_NAME,
            fontSize: '24px',
            color: GOLD,
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: '8px',
          }}>
            Add Attendee
          </div>
          <div style={{
            fontFamily: FONT_BODY,
            fontSize: '14px',
            color: `rgba(${GOLD_RGB}, 0.72)`,
            textAlign: 'center',
            marginBottom: '16px',
            lineHeight: 1.5,
            fontWeight: 400,
          }}>
            Bringing a colleague? Add their email below. For more than one, separate with commas.
          </div>
          <form action={`/api/invitations/add-attendee`} method="POST">
            <input type="hidden" name="token" value={token} />
            <input
              name="emails"
              type="text"
              required
              placeholder="name@firm.com, another@firm.com"
              style={{
                width: '100%',
                background: `rgba(${GOLD_RGB}, 0.06)`,
                border: `1px solid rgba(${GOLD_RGB}, 0.40)`,
                padding: '14px 16px',
                color: GOLD,
                fontFamily: FONT_NAME,
                fontSize: '17px',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
              <button type="submit" style={{
                fontFamily: FONT_BODY,
                fontSize: '15px',
                color: NAVY,
                fontWeight: 700,
                background: GOLD,
                border: 'none',
                padding: '10px 22px',
                borderRadius: '4px',
                cursor: 'pointer',
                letterSpacing: '0.02em',
              }}>
                Send Invitation →
              </button>
            </div>
          </form>
        </div>

        {/* CALENDAR ADD */}
        <div style={{ padding: '0 32px 18px' }}>
          <div style={{
            fontFamily: FONT_BODY,
            fontSize: '14px',
            letterSpacing: '0.24em',
            textIndent: '0.24em',
            color: GOLD,
            textTransform: 'uppercase',
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: '14px',
            opacity: 0.80,
          }}>
            Add to your calendar
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
            <a href={icsDownloadUrl} download="terminal-introduction.ics" style={calBtnStyle}>Apple</a>
            <a href={googleCalUrl} target="_blank" rel="noopener noreferrer" style={calBtnStyle}>Google</a>
            <a href={icsDownloadUrl} download="terminal-introduction.ics" style={calBtnStyle}>Outlook</a>
          </div>
        </div>

        {/* MEETING DETAILS */}
        {zoomUrl && (
          <div style={{ padding: '0 32px 18px' }}>
            <div style={{
              fontFamily: FONT_BODY,
              fontSize: '9px',
              letterSpacing: '0.24em',
              textIndent: '0.24em',
              color: GOLD,
              textTransform: 'uppercase',
              fontWeight: 600,
              textAlign: 'center',
              marginBottom: '11px',
              opacity: 0.7,
            }}>
              Meeting Details
            </div>
            <div style={{ borderTop: `0.5px solid rgba(${GOLD_RGB}, 0.18)`, paddingTop: '8px' }}>
              <MdRow keyText="Zoom" valText={zoomShort ?? 'zoom.us/j/…'} href={zoomUrl} />
              {meetingIdFormatted && <MdRow keyText="Meeting ID" valText={meetingIdFormatted} />}
              {invitation.zoom_passcode && <MdRow keyText="Passcode" valText={invitation.zoom_passcode} />}
            </div>
          </div>
        )}

        {/* JOIN ZOOM (big tap target) */}
        {zoomUrl && (
          <div style={{ padding: '0 32px 22px', textAlign: 'center' }}>
            <a
              href={zoomUrl}
              style={{
                display: 'inline-block',
                padding: '0.95rem 2rem',
                background: GOLD,
                color: NAVY,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
                fontFamily: FONT_BODY,
                letterSpacing: '0.02em',
                borderRadius: '2px',
              }}
            >
              Join Zoom
            </a>
          </div>
        )}

        {/* RESCHEDULE */}
        <div style={{ padding: '0 32px 22px', textAlign: 'center' }}>
          <a
            href={`/invite/${token}/calendar?reschedule=1`}
            style={{
              fontFamily: FONT_NAME,
              fontStyle: 'italic',
              fontSize: '17px',
              color: GOLD,
              lineHeight: 1.55,
              textDecoration: 'none',
              opacity: 0.90,
            }}
          >
            Need a different time?<br />
            Reschedule with one click →
          </a>
        </div>

        <TerminalFooter />
      </PageShell>
    )
  }

  // ── SENT state + ?slot=<iso> → focused single-slot confirm view ────────────
  // Captain 2026-05-24: when the recipient clicks a per-time button inside
  // the SendGrid invitation email (e.g. ".../invite/[token]?slot=2026-05-26T09:00:00-05:00"),
  // we land here with preselectedSlotIso. If it matches one of the proposed
  // slots, render a focused "Confirm this time" screen — single big gold
  // button, no other slots, no decision overhead. One click confirms exactly
  // as the email promised. We do NOT auto-confirm on page load because email
  // clients (Gmail, Outlook, iOS Mail) routinely prefetch URLs and would
  // accidentally book the slot before the recipient even opened the email.
  const matchedPreselect =
    preselectedSlotIso &&
    invitation.proposed_slots?.find((s) => s.iso === preselectedSlotIso)

  if (matchedPreselect) {
    // Gideon 2026-06-18: never present "Confirm this time" on a slot that's
    // already been taken since the email/WhatsApp went out. Re-check first;
    // if it's gone, send them straight to the open calendar with the notice.
    // (redirect() throws internally, so it must run OUTSIDE the try/catch.)
    let preselectTaken = false
    try {
      const s = new Date(matchedPreselect.iso)
      const busy = await getBusyTimes(
        new Date(s.getTime() - 60_000).toISOString(),
        new Date(s.getTime() + 31 * 60_000).toISOString(),
      )
      preselectTaken = slotOverlapsBusy(matchedPreselect.iso, 30, busy)
    } catch { /* freebusy unavailable — fall through and let the confirm step guard */ }
    if (preselectTaken) redirect(`/invite/${token}/choose?taken=1`)

    const slotDate = new Date(matchedPreselect.iso)
    const TZ = 'America/Chicago'
    const dayLine = new Intl.DateTimeFormat('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ,
    }).format(slotDate)
    // Gideon 2026-06-18: show both clocks — recipient's Israel time + Gideon's Central.
    const ilTimeC = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Jerusalem',
    }).format(slotDate)
    const ctTimeC = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: TZ,
    }).format(slotDate)
    const timeLine = `${ilTimeC} Israel · ${ctTimeC} Central`

    return (
      <PageShell fontClasses={fontClasses}>
        <TerminalHeader />

        {/* Hero — recipient name */}
        <div style={{ padding: '26px 32px 12px', textAlign: 'center' }}>
          <div style={{
            fontFamily: FONT_BODY,
            fontSize: '11px',
            letterSpacing: '0.30em',
            textIndent: '0.30em',
            color: GOLD,
            fontWeight: 600,
            textTransform: 'uppercase',
            marginBottom: '14px',
          }}>
            Private Introduction
          </div>
          <h1 style={{
            fontFamily: FONT_NAME,
            fontSize: 'clamp(2.4rem, 9vw, 3.25rem)',
            color: GOLD,
            fontWeight: 600,
            lineHeight: 1.0,
            letterSpacing: '-0.01em',
            margin: 0,
          }}>
            {displayName}
          </h1>
        </div>

        {/* Confirm-this-time summary */}
        <div style={{ padding: '24px 32px 18px', textAlign: 'center' }}>
          <div style={{
            fontFamily: FONT_BODY,
            fontSize: '11px',
            letterSpacing: '0.24em',
            textIndent: '0.24em',
            color: GOLD,
            fontWeight: 600,
            textTransform: 'uppercase',
            opacity: 0.85,
            marginBottom: '10px',
          }}>
            Your selected time
          </div>
          <div style={{
            fontFamily: FONT_NAME,
            fontSize: '28px',
            color: GOLD,
            fontWeight: 600,
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
          }}>
            {dayLine}
          </div>
          <div style={{
            fontFamily: FONT_NAME,
            fontSize: '24px',
            color: GOLD,
            fontWeight: 400,
            lineHeight: 1.2,
            marginTop: '4px',
            fontStyle: 'italic',
          }}>
            {timeLine}
          </div>
        </div>

        {/* Confirm form — single big gold button */}
        <div style={{ padding: '6px 32px 18px' }}>
          <form action="/api/bookings/confirm" method="POST">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="slot_iso" value={matchedPreselect.iso} />
            {!invitation.contact_email && (
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontFamily: FONT_BODY,
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  textIndent: '0.18em',
                  color: GOLD,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                  textAlign: 'center',
                }}>
                  Your email (for Zoom + calendar invite)
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: `rgba(${GOLD_RGB}, 0.04)`,
                    border: `0.5px solid rgba(${GOLD_RGB}, 0.40)`,
                    borderRadius: 2,
                    color: GOLD,
                    fontFamily: FONT_NAME,
                    fontSize: 14,
                    marginBottom: 4,
                    textAlign: 'center',
                  }}
                />
              </div>
            )}
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '18px 16px',
                background: GOLD,
                color: NAVY,
                border: 'none',
                borderRadius: '2px',
                fontFamily: FONT_NAME,
                fontSize: '20px',
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.02em',
              }}
            >
              Confirm this time →
            </button>
          </form>
          <a
            href={`/invite/${token}`}
            style={{
              display: 'block',
              marginTop: '14px',
              fontFamily: FONT_NAME,
              fontStyle: 'italic',
              fontSize: '14px',
              color: GOLD,
              textAlign: 'center',
              textDecoration: 'underline',
              opacity: 0.75,
            }}
          >
            See other suggested times →
          </a>
          <a
            href={`/invite/${token}/choose`}
            style={{
              display: 'block',
              marginTop: '8px',
              fontFamily: FONT_NAME,
              fontStyle: 'italic',
              fontSize: '14px',
              color: GOLD,
              textAlign: 'center',
              textDecoration: 'underline',
              opacity: 0.75,
            }}
          >
            Or pick a different date and time →
          </a>
        </div>

        <TerminalFooter />
      </PageShell>
    )
  }

  // ── SENT state → Screen 2 (booking) ────────────────────────────────────────
  // Captain hotfix 2026-05-19: prefer per-invite proposed_slots if present
  // (bypasses Google Calendar OAuth dependency). Cross-checks freebusy so we
  // never offer recipients a slot Gideon is already booked in.
  // Captain 2026-05-24: ALWAYS aim to show 3 slots. If proposed_slots filter
  // down to <3 non-conflicting, supplement from Google Calendar freebusy so
  // the recipient never sees a single-slot dead-end.
  const TARGET_SLOT_COUNT = 3
  let slotGroups: SlotGroup[]
  let nonConflictingProposed: Array<{ iso: string; display: string }> = []
  if (invitation.proposed_slots && invitation.proposed_slots.length > 0) {
    const slots = invitation.proposed_slots
    const isoTimes = slots.map(s => new Date(s.iso).getTime()).filter(t => !isNaN(t))
    if (isoTimes.length > 0) {
      const windowStart = new Date(Math.min(...isoTimes) - 30 * 60 * 1000).toISOString()
      const windowEnd = new Date(Math.max(...isoTimes) + 60 * 60 * 1000).toISOString()
      const busy = await getBusyTimes(windowStart, windowEnd)
      nonConflictingProposed = slots.filter(s => !slotOverlapsBusy(s.iso, 30, busy))
    } else {
      nonConflictingProposed = slots
    }
  }

  if (nonConflictingProposed.length >= TARGET_SLOT_COUNT) {
    slotGroups = groupProposedSlotsByDate(nonConflictingProposed.slice(0, TARGET_SLOT_COUNT))
  } else {
    // Need to backfill from Google Calendar freebusy
    const calendarGroups = await loadAvailableSlots()
    if (nonConflictingProposed.length === 0) {
      slotGroups = calendarGroups
    } else {
      // Merge: keep the proposed ones that survived + fill from calendar to 3
      const merged = [...nonConflictingProposed]
      const proposedIsos = new Set(merged.map(s => s.iso))
      outer: for (const grp of calendarGroups) {
        for (const t of grp.times) {
          if (!proposedIsos.has(t.iso)) {
            merged.push(t)
            if (merged.length >= TARGET_SLOT_COUNT) break outer
          }
        }
      }
      slotGroups = groupProposedSlotsByDate(merged)
    }
  }

  return (
    <PageShell fontClasses={fontClasses}>
      <TerminalHeader />

      {/* Hero — recipient name in Playfair Display.
          Captain 2026-05-24: bumped sizing + full gold (no opacity dim) per
          Gideon — uniform Imperial Gold across the whole card. */}
      <div style={{ padding: '26px 32px 18px', textAlign: 'center' }}>
        <div style={{
          fontFamily: FONT_BODY,
          fontSize: '11px',
          letterSpacing: '0.30em',
          textIndent: '0.30em',
          color: GOLD,
          fontWeight: 600,
          textTransform: 'uppercase',
          marginBottom: '14px',
        }}>
          Private Introduction
        </div>
        <h1 style={{
          fontFamily: FONT_NAME,
          fontSize: 'clamp(2.4rem, 9vw, 3.25rem)',
          color: GOLD,
          fontWeight: 600,
          lineHeight: 1.0,
          letterSpacing: '-0.01em',
          margin: 0,
        }}>
          {displayName}
        </h1>
      </div>

      {/* Private Membership · By Invitation Only — full gold, no dim */}
      <div style={{ padding: '0 32px 18px', textAlign: 'center' }}>
        <div style={{
          fontFamily: FONT_BODY,
          fontSize: '12px',
          letterSpacing: '0.24em',
          textIndent: '0.24em',
          color: GOLD,
          fontWeight: 600,
          textTransform: 'uppercase',
          marginBottom: '6px',
        }}>
          Private Membership
        </div>
        <div style={{
          fontFamily: FONT_BODY,
          fontSize: '12px',
          letterSpacing: '0.24em',
          textIndent: '0.24em',
          color: GOLD,
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          By Invitation Only
        </div>
      </div>

      {/* Time slots */}
      <div style={{ padding: '6px 32px 24px' }}>
        {slotGroups.length === 0 ? (
          <p style={{
            color: `rgba(${GOLD_RGB}, 0.55)`,
            fontSize: '14px',
            letterSpacing: '0.02em',
            lineHeight: 1.8,
            fontStyle: 'italic',
            fontFamily: FONT_NAME,
            textAlign: 'center',
          }}>
            Please reach out directly to schedule.
          </p>
        ) : (
          <>
            <div style={{
              fontFamily: FONT_BODY,
              fontSize: '12px',
              letterSpacing: '0.24em',
              textIndent: '0.24em',
              color: GOLD,
              fontWeight: 600,
              textTransform: 'uppercase',
              textAlign: 'center',
              marginBottom: '16px',
            }}>
              Select a time
            </div>
            {/* Captain 2026-05-24: single form wraps email input + all slot
                buttons. Each slot is a submit button with name="slot_iso" so
                the recipient's email (if typed) is captured in the same POST
                that confirms the slot. If invitation already has contact_email
                on file, skip the input entirely. */}
            <form action="/api/bookings/confirm" method="POST">
              <input type="hidden" name="token" value={token} />
              {!invitation.contact_email && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{
                    display: 'block',
                    fontFamily: FONT_BODY,
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textIndent: '0.18em',
                    color: GOLD,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    marginBottom: 6,
                    textAlign: 'center',
                  }}>
                    Your email (for Zoom + calendar invite)
                  </label>
                  <input
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: `rgba(${GOLD_RGB}, 0.04)`,
                      border: `0.5px solid rgba(${GOLD_RGB}, 0.40)`,
                      borderRadius: 2,
                      color: GOLD,
                      fontFamily: FONT_NAME,
                      fontSize: 14,
                      marginBottom: 4,
                      textAlign: 'center',
                    }}
                  />
                  <div style={{
                    fontFamily: FONT_BODY,
                    fontSize: 10,
                    color: `rgba(${GOLD_RGB}, 0.55)`,
                    textAlign: 'center',
                    fontStyle: 'italic',
                  }}>
                    Optional. We&rsquo;ll send the confirmation + calendar invite if you fill this in.
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {slotGroups.map((group) => (
                  <div key={group.date}>
                    <p style={{
                      color: GOLD,
                      fontSize: '12px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.20em',
                      textIndent: '0.20em',
                      margin: '0 0 8px',
                      fontFamily: FONT_BODY,
                    }}>
                      {group.label}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {group.times.map((slot) => (
                        <button
                          key={slot.iso}
                          type="submit"
                          name="slot_iso"
                          value={slot.iso}
                          style={{
                            width: '100%',
                            padding: '14px 16px',
                            background: `rgba(${GOLD_RGB}, 0.04)`,
                            color: GOLD,
                            border: `0.5px solid rgba(${GOLD_RGB}, 0.35)`,
                            borderRadius: '2px',
                            fontSize: '15px',
                            fontFamily: FONT_NAME,
                            cursor: 'pointer',
                            textAlign: 'center',
                            letterSpacing: '0.01em',
                            lineHeight: 1.4,
                            transition: 'background 0.15s ease, border-color 0.15s ease',
                          }}
                        >
                          {slot.display}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </form>

            {/* Captain 2026-05-24: "Different Time? Choose your own →" per
                locked Screen 2 spec. Now wired to the real picker page at
                /invite/[token]/choose — recipient lands on a date+time input
                form, picks anything, gets the same Zoom+Calendar confirm
                flow as the suggested slots. Secondary wa.me link below for
                a direct chat fallback. */}
            <a
              href={`/invite/${token}/choose`}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 16px',
                marginTop: '14px',
                background: 'transparent',
                color: GOLD,
                border: `0.5px solid rgba(${GOLD_RGB}, 0.45)`,
                borderRadius: '2px',
                fontFamily: FONT_NAME,
                textAlign: 'center',
                textDecoration: 'none',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
            >
              <div style={{
                fontFamily: FONT_BODY,
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.20em',
                textIndent: '0.20em',
                textTransform: 'uppercase',
                marginBottom: '4px',
                color: GOLD,
              }}>
                Different Time?
              </div>
              <div style={{
                fontSize: '17px',
                fontWeight: 400,
                color: GOLD,
              }}>
                Pick your own →
              </div>
            </a>

            {/* Secondary fallback — message Gideon directly via WhatsApp */}
            <a
              href={`https://wa.me/13057784861?text=${encodeURIComponent(
                `Hi Gideon — ${firstName} here. Got your Terminal invitation. Can we coordinate a time directly?\n\n(Invite ref: ${token.slice(0, 8)})`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 16px',
                marginTop: '10px',
                background: 'transparent',
                color: GOLD,
                border: 'none',
                fontFamily: FONT_BODY,
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.10em',
                textAlign: 'center',
                textDecoration: 'underline',
                opacity: 0.75,
              }}
            >
              Or message Gideon directly on WhatsApp →
            </a>
          </>
        )}
      </div>

      <TerminalFooter />
    </PageShell>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Inline subcomponent styles
// ────────────────────────────────────────────────────────────────────────────

const calBtnStyle: React.CSSProperties = {
  border: `0.5px solid rgba(${GOLD_RGB}, 0.40)`,
  padding: '14px 8px',
  textAlign: 'center',
  fontFamily: FONT_BODY,
  fontSize: '14px',
  color: GOLD,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  fontWeight: 600,
  textIndent: '0.10em',
  background: 'transparent',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'block',
}

function MdRow({ keyText, valText, href }: { keyText: string; valText: string; href?: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 0',
      borderBottom: `0.5px dashed rgba(${GOLD_RGB}, 0.14)`,
    }}>
      <span style={{ fontFamily: FONT_BODY, fontSize: '16px', color: GOLD, letterSpacing: '0.04em', opacity: 0.70 }}>{keyText}</span>
      {href ? (
        <a href={href} style={{ fontFamily: FONT_BODY, fontSize: '16px', color: GOLD, fontWeight: 500, textDecoration: 'none' }}>{valText}</a>
      ) : (
        <span style={{ fontFamily: FONT_BODY, fontSize: '16px', color: GOLD, fontWeight: 500 }}>{valText}</span>
      )}
    </div>
  )
}
