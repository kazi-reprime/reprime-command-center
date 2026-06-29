import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import AddAttendeeForm from './AddAttendeeForm'

interface Invitation {
  id: string
  contact_first_name: string | null
  contact_name: string | null
  contact_email: string | null
  status: 'sent' | 'confirmed' | 'expired' | 'cancelled'
  meeting_type: 'terminal' | 'meeting' | null
  confirmed_slot_iso: string | null
  zoom_join_url: string | null
  zoom_meeting_id: string | null
  zoom_passcode: string | null
  parent_invitation_id: string | null
  reschedule_count: number | null
}

async function loadInvitation(token: string): Promise<Invitation | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('invitations')
    .select(
      'id, contact_first_name, contact_name, contact_email, status, meeting_type, confirmed_slot_iso, zoom_join_url, zoom_meeting_id, zoom_passcode, parent_invitation_id, reschedule_count'
    )
    .eq('id', token)
    .maybeSingle()
  if (error || !data) return null
  return data as Invitation
}

function formatConfirmedSlot(iso: string | null): { dayLine: string; timeLine: string } {
  if (!iso) return { dayLine: '', timeLine: '' }
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
  return { dayLine: day, timeLine: `${time} Central` }
}

export const metadata: Metadata = {
  title: 'Confirmed — RePrime Terminal',
  description: 'Your introduction is set.',
}

export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const inv = await loadInvitation(token)

  if (!inv) {
    return <NotValidPage message="This invitation link is not valid." />
  }
  if (inv.status === 'cancelled') {
    return <NotValidPage message="This introduction has been cancelled." />
  }
  if (inv.status !== 'confirmed' || !inv.confirmed_slot_iso) {
    return (
      <NotValidPage message="This introduction has not been confirmed yet. Open the original invitation to pick a time." />
    )
  }

  const firstName =
    (inv.contact_first_name || inv.contact_name || 'there').trim().split(' ')[0] || 'there'
  const isMeeting = inv.meeting_type === 'meeting'
  const { dayLine, timeLine } = formatConfirmedSlot(inv.confirmed_slot_iso)
  const greetingLine = isMeeting ? 'Your meeting is set.' : 'Your introduction is set.'
  const confirmationLabel = isMeeting
    ? 'A confirmation from Gideon Gratsiani'
    : 'A confirmation from Gideon Gratsiani'
  const closingLine = isMeeting
    ? 'Looking forward to it.'
    : "Looking forward to showing you what I've been building."

  // Calendar links
  const eventTitle = isMeeting ? 'Meeting — Gideon Gratsiani' : 'Terminal Introduction — Gideon Gratsiani'
  const eventDescription = [
    `Zoom: ${inv.zoom_join_url ?? '(link will be provided)'}`,
    inv.zoom_meeting_id ? `Meeting ID: ${inv.zoom_meeting_id}` : null,
    inv.zoom_passcode ? `Passcode: ${inv.zoom_passcode}` : null,
  ]
    .filter(Boolean)
    .join('\n')
  const startDate = new Date(inv.confirmed_slot_iso)
  const endDate = new Date(startDate.getTime() + 30 * 60 * 1000) // 30 min default
  const fmtIcs = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const googleUrl =
    `https://calendar.google.com/calendar/r/eventedit?` +
    `text=${encodeURIComponent(eventTitle)}` +
    `&dates=${fmtIcs(startDate)}/${fmtIcs(endDate)}` +
    `&details=${encodeURIComponent(eventDescription)}` +
    (inv.zoom_join_url ? `&location=${encodeURIComponent(inv.zoom_join_url)}` : '')
  const icsUrl = `/api/invitations/${token}/calendar.ics`
  const rescheduleUrl = `/invite/${token}/calendar?reschedule=1`

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        {/* Header — TERMINAL spindle */}
        <div style={hdrStyle}>
          <Spindle />
          <div style={wordmarkStyle}>TERMINAL</div>
          <Spindle />
        </div>

        {/* Letter */}
        <div style={letterWrap}>
          <div style={letterContent}>
            <div style={letterLabel}>{confirmationLabel}</div>
            <div style={letterGreeting}>{firstName} —</div>
            <div style={letterBody}>{greetingLine}</div>
            <div style={letterTime}>
              {dayLine}
              <br />
              {timeLine}
            </div>
            <div style={letterClosing}>{closingLine}</div>
            <div style={letterSig}>— Gideon</div>
          </div>
        </div>

        {/* Add Attendee */}
        <div style={padBlock}>
          <div style={lblLg}>Add Attendee</div>
          <AddAttendeeForm parentToken={token} />
        </div>

        {/* Calendar */}
        <div style={{ ...padBlock, paddingTop: 18 }}>
          <div style={lblSm}>Add to your calendar</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <CalButton href={icsUrl} label="Apple" download />
            <CalButton href={googleUrl} label="Google" external />
            <CalButton href={icsUrl} label="Outlook" download />
          </div>
        </div>

        {/* Meeting details */}
        <div style={credsBlock}>
          <div style={credsLbl}>Meeting Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {inv.zoom_join_url && (
              <CredRow k="Zoom" v={inv.zoom_join_url} link />
            )}
            {inv.zoom_meeting_id && <CredRow k="Meeting ID" v={inv.zoom_meeting_id} />}
            {inv.zoom_passcode && <CredRow k="Passcode" v={inv.zoom_passcode} />}
            {!inv.zoom_join_url && (
              <div style={{ ...credValue, color: 'rgba(255,204,51,0.55)', fontStyle: 'italic' }}>
                Zoom link will be sent shortly.
              </div>
            )}
          </div>
        </div>

        {/* Reschedule */}
        <div style={rescheduleBlock}>
          <a href={rescheduleUrl} style={rescheduleLink}>
            Need a different time? Reschedule with one click →
          </a>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div style={footerName}>RePrime</div>
          <div style={footerSub}>This invitation was sent personally. Reply directly to Gideon.</div>
        </div>
      </div>
    </main>
  )
}

function NotValidPage({ message }: { message: string }) {
  return (
    <main style={{ ...pageStyle, padding: '4rem 1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>
        <p
          style={{
            color: 'rgba(255, 204, 51, 0.6)',
            fontSize: '0.65rem',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            marginBottom: '1.5rem',
            fontFamily: 'Poppins, Arial, sans-serif',
          }}
        >
          RePrime Group
        </p>
        <p
          style={{
            color: '#FFCC33',
            fontSize: '1.1rem',
            letterSpacing: '0.04em',
            fontStyle: 'italic',
            fontFamily: 'Georgia, serif',
          }}
        >
          {message}
        </p>
      </div>
    </main>
  )
}

// ── Reusable inline components ─────────────────────────────────────────────────

function Spindle() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width="70%" height="7" viewBox="0 0 460 7" preserveAspectRatio="none">
        <defs>
          <linearGradient id="tl-spindle" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0E3470" />
            <stop offset="10%" stopColor="#FFCC33" />
            <stop offset="90%" stopColor="#FFCC33" />
            <stop offset="100%" stopColor="#0E3470" />
          </linearGradient>
        </defs>
        <path d="M0,3.5 Q230,0 460,3.5 Q230,7 0,3.5 Z" fill="url(#tl-spindle)" />
      </svg>
    </div>
  )
}

function CalButton({ href, label, external, download }: { href: string; label: string; external?: boolean; download?: boolean }) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      download={download ? `terminal-meeting.ics` : undefined}
      style={calBtnStyle}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFCC33" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 5px' }}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" />
      </svg>
      <div style={calLblStyle}>{label}</div>
    </a>
  )
}

function CredRow({ k, v, link }: { k: string; v: string; link?: boolean }) {
  return (
    <div style={credRow}>
      <div style={credKey}>{k}</div>
      {link ? (
        <a href={v} target="_blank" rel="noopener noreferrer" style={credLink}>
          {v.replace(/^https?:\/\//, '')}
        </a>
      ) : (
        <div style={credValue}>{v}</div>
      )}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  background: '#DDD9D2',
  minHeight: '100vh',
  padding: '40px 20px',
  display: 'flex',
  justifyContent: 'center',
  fontFamily: 'Poppins, sans-serif',
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 560,
  background: '#0E3470',
  border: '1px solid rgba(255, 204, 51, 0.22)',
  borderRadius: 2,
  overflow: 'hidden',
}

const hdrStyle: React.CSSProperties = {
  background: '#0E3470',
  padding: '22px 48px 20px',
  textAlign: 'center',
  borderBottom: '1px solid rgba(255, 204, 51, 0.18)',
}

const wordmarkStyle: React.CSSProperties = {
  fontFamily: 'Playfair Display, Georgia, serif',
  fontSize: 26,
  letterSpacing: '0.30em',
  color: '#FFCC33',
  fontWeight: 600,
  margin: '11px 0',
  textIndent: '0.30em',
}

const letterWrap: React.CSSProperties = {
  padding: '30px 48px 22px',
  background: 'linear-gradient(180deg, #F8F0DA 0%, #EFE2C4 100%)',
  margin: '0 48px 22px',
  border: '1px solid rgba(255, 204, 51, 0.30)',
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.22)',
  marginTop: 30,
}

const letterContent: React.CSSProperties = {
  textAlign: 'center',
  padding: '12px 8px',
}

const letterLabel: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif',
  fontSize: 11,
  color: 'rgba(14, 52, 112, 0.55)',
  fontStyle: 'italic',
  marginBottom: 18,
  letterSpacing: '0.04em',
}

const letterGreeting: React.CSSProperties = {
  fontFamily: 'Playfair Display, Georgia, serif',
  fontSize: 26,
  color: '#0E3470',
  fontWeight: 600,
  fontStyle: 'italic',
  marginBottom: 14,
}

const letterBody: React.CSSProperties = {
  fontFamily: 'Playfair Display, Georgia, serif',
  fontSize: 15,
  color: '#0E3470',
  lineHeight: 1.7,
  fontStyle: 'italic',
  marginBottom: 4,
}

const letterTime: React.CSSProperties = {
  fontFamily: 'Playfair Display, Georgia, serif',
  fontSize: 26,
  color: '#0E3470',
  fontWeight: 600,
  margin: '14px 0',
  letterSpacing: '-0.01em',
  lineHeight: 1.15,
}

const letterClosing: React.CSSProperties = {
  fontFamily: 'Playfair Display, Georgia, serif',
  fontSize: 14,
  color: '#0E3470',
  lineHeight: 1.6,
  fontStyle: 'italic',
  marginTop: 4,
}

const letterSig: React.CSSProperties = {
  fontFamily: 'Playfair Display, Georgia, serif',
  fontSize: 16,
  color: '#0E3470',
  fontStyle: 'italic',
  fontWeight: 600,
  marginTop: 18,
}

const padBlock: React.CSSProperties = {
  padding: '6px 48px 14px',
  background: '#0E3470',
}

const lblLg: React.CSSProperties = {
  fontFamily: 'Playfair Display, Georgia, serif',
  fontSize: 28,
  color: '#FFCC33',
  fontWeight: 600,
  textAlign: 'center',
  marginBottom: 16,
  lineHeight: 1.1,
}

const lblSm: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif',
  fontSize: 11,
  letterSpacing: '0.24em',
  color: '#FFCC33',
  textTransform: 'uppercase',
  fontWeight: 600,
  textAlign: 'center',
  marginBottom: 12,
  textIndent: '0.24em',
}

const calBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px 10px',
  border: '0.5px solid rgba(255, 204, 51, 0.35)',
  textAlign: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
}

const calLblStyle: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif',
  fontSize: 9,
  letterSpacing: '0.18em',
  color: '#FFCC33',
  textTransform: 'uppercase',
  fontWeight: 600,
  textIndent: '0.18em',
}

const credsBlock: React.CSSProperties = {
  background: 'rgba(0,0,0,0.18)',
  borderTop: '0.5px solid rgba(255, 204, 51, 0.18)',
  borderBottom: '0.5px solid rgba(255, 204, 51, 0.18)',
  padding: '16px 48px',
  marginTop: 8,
}

const credsLbl: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif',
  fontSize: 9,
  letterSpacing: '0.24em',
  color: 'rgba(255, 204, 51, 0.55)',
  textTransform: 'uppercase',
  fontWeight: 600,
  textAlign: 'center',
  textIndent: '0.24em',
  marginBottom: 10,
}

const credRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  borderBottom: '0.5px dotted rgba(255, 204, 51, 0.15)',
  paddingBottom: 5,
}

const credKey: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif',
  fontSize: 9,
  letterSpacing: '0.20em',
  color: 'rgba(255, 204, 51, 0.55)',
  textTransform: 'uppercase',
  textIndent: '0.20em',
}

const credValue: React.CSSProperties = {
  fontFamily: 'Playfair Display, Georgia, serif',
  fontSize: 13,
  color: '#FFCC33',
  fontWeight: 400,
  letterSpacing: '0.02em',
}

const credLink: React.CSSProperties = {
  ...credValue,
  textDecoration: 'underline',
  textDecorationColor: 'rgba(255, 204, 51, 0.35)',
  textUnderlineOffset: 3,
}

const rescheduleBlock: React.CSSProperties = {
  padding: '16px 48px 22px',
  background: '#0E3470',
  textAlign: 'center',
}

const rescheduleLink: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif',
  fontSize: 10,
  color: 'rgba(255, 204, 51, 0.55)',
  letterSpacing: '0.10em',
  textDecoration: 'none',
}

const footerStyle: React.CSSProperties = {
  background: '#0E3470',
  padding: '22px 48px',
  borderTop: '1px solid rgba(255, 204, 51, 0.18)',
  textAlign: 'center',
}

const footerName: React.CSSProperties = {
  fontFamily: 'Playfair Display, Georgia, serif',
  fontSize: 16,
  color: '#FFCC33',
  fontWeight: 600,
  letterSpacing: '0.10em',
  textIndent: '0.10em',
}

const footerSub: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif',
  fontSize: 8,
  color: 'rgba(255, 204, 51, 0.55)',
  marginTop: 11,
  letterSpacing: '0.06em',
}
