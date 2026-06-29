import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/server'

// Gideon 2026-06-18 — open-calendar picker, rebuilt.
// Shows ONLY the available days (no month grid, no greyed-out dates), times
// first, soonest day at the top. Availability comes straight from
// /api/bookings/available-slots, which already applies: Gideon's Central
// window, the Israel 8 AM–10 PM cap, Shabbat/Yom-Tov closures, and a live
// freebusy filter — so every time shown is genuinely open.

interface Invitation {
  contact_first_name: string | null
  contact_name: string | null
  contact_email: string | null
  status: 'sent' | 'confirmed' | 'expired' | 'cancelled'
  expires_at: string | null
}

interface SlotGroup {
  date: string
  label: string
  times: Array<{ iso: string; display: string }>
}

async function loadInvitation(token: string): Promise<Invitation | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('invitations')
    .select('contact_first_name, contact_name, contact_email, status, expires_at')
    .eq('id', token)
    .maybeSingle()
  return (data as Invitation) ?? null
}

async function loadAvailableSlots(): Promise<SlotGroup[]> {
  try {
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://project-7e87w.vercel.app').replace(/\/$/, '')
    const res = await fetch(`${baseUrl}/api/bookings/available-slots`, { cache: 'no-store' })
    if (!res.ok) return []
    const json = (await res.json()) as { slots?: SlotGroup[] }
    return json.slots ?? []
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const inv = await loadInvitation(token)
  const displayName = inv?.contact_name || inv?.contact_first_name || 'Guest'
  return {
    title: `Pick a Time — ${displayName}`,
    description: 'Choose any open time that works.',
    robots: { index: false, follow: false },
  }
}

export default async function ChooseTimePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ taken?: string }>
}) {
  const { token } = await params
  const { taken: takenParam } = await searchParams
  const inv = await loadInvitation(token)

  if (!inv) return <NotValidPage message="This invitation link is not valid." />
  if (inv.status === 'cancelled') return <NotValidPage message="This introduction has been cancelled." />
  if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) {
    return <NotValidPage message="This invitation has expired." />
  }
  if (inv.status === 'confirmed') {
    return <NotValidPage message="Already confirmed. Open the original invitation to reschedule." />
  }

  const firstName =
    (inv.contact_first_name || inv.contact_name || 'there').trim().split(' ')[0] || 'there'

  const groups = await loadAvailableSlots()

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={hdrStyle}>
          <Spindle />
          <div style={wordmarkStyle}>TERMINAL</div>
          <Spindle />
        </div>

        <div style={letterWrap}>
          <div style={letterContent}>
            <div style={letterLabel}>A note from Gideon Gratsiani</div>
            <div style={letterGreeting}>{firstName} —</div>
            {takenParam ? (
              <div style={takenBanner}>
                That time was just taken by someone else — sorry about that. Pick any other time below; these are all open.
              </div>
            ) : null}
            <div style={letterBody}>Choose any open time below — soonest first. Every time shows in Israel and Central.</div>
          </div>
        </div>

        <div style={slotsWrap}>
          {groups.length === 0 ? (
            <div style={emptyStyle}>No open times in the next two weeks — please reply to Gideon directly and we&rsquo;ll find a time.</div>
          ) : (
            <form action="/api/bookings/confirm" method="POST">
              <input type="hidden" name="token" value={token} />
              {!inv.contact_email && (
                <div style={{ marginBottom: 18 }}>
                  <label style={emailLabel}>Your email (for the Zoom + calendar invite)</label>
                  <input type="email" name="email" placeholder="you@example.com" autoComplete="email" style={emailInput} />
                  <div style={emailHint}>Optional. We&rsquo;ll send the confirmation if you fill this in.</div>
                </div>
              )}
              {groups.map((g) => (
                <div key={g.date} style={{ marginBottom: 20 }}>
                  <div style={dayLabel}>{g.label}</div>
                  <div style={slotsGrid}>
                    {g.times.map((slot) => (
                      <button key={slot.iso} type="submit" name="slot_iso" value={slot.iso} style={slotBtn}>
                        {slot.display}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </form>
          )}
          <div style={footnote}>EACH TIME SHOWN IN ISRAEL &amp; CENTRAL · ONE CLICK CONFIRMS</div>
        </div>

        <div style={{ padding: '14px 48px 22px', textAlign: 'center', background: '#0E3470' }}>
          <a href={`/invite/${token}`} style={backLink}>← Back to suggested times</a>
        </div>

        <div style={footerStyle}>
          <div style={footerName}>TERMINAL</div>
          <div style={footerBy}>by RePrime</div>
          <div style={footerSub}>This invitation was sent personally. Reply directly to Gideon.</div>
        </div>
      </div>
    </main>
  )
}

function NotValidPage({ message }: { message: string }) {
  return (
    <main style={{ ...pageStyle, padding: '4rem 1.5rem', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>
        <p style={{ color: '#FFCC33', fontSize: '0.7rem', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '1.5rem', fontFamily: 'Poppins, Arial, sans-serif' }}>
          RePrime Group
        </p>
        <p style={{ color: '#FFCC33', fontSize: '1.1rem', letterSpacing: '0.04em', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
          {message}
        </p>
      </div>
    </main>
  )
}

function Spindle() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width="70%" height="7" viewBox="0 0 460 7" preserveAspectRatio="none">
        <defs>
          <linearGradient id="tl-spindle-choose" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0E3470" />
            <stop offset="10%" stopColor="#FFCC33" />
            <stop offset="90%" stopColor="#FFCC33" />
            <stop offset="100%" stopColor="#0E3470" />
          </linearGradient>
        </defs>
        <path d="M0,3.5 Q230,0 460,3.5 Q230,7 0,3.5 Z" fill="url(#tl-spindle-choose)" />
      </svg>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  background: '#DDD9D2', minHeight: '100vh', padding: '40px 20px',
  display: 'flex', justifyContent: 'center', fontFamily: 'Poppins, sans-serif',
}
const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: 560, background: '#0E3470',
  border: '1px solid rgba(255, 204, 51, 0.22)', borderRadius: 2, overflow: 'hidden',
}
const hdrStyle: React.CSSProperties = {
  background: '#0E3470', padding: '22px 48px 20px', textAlign: 'center',
  borderBottom: '1px solid rgba(255, 204, 51, 0.18)',
}
const wordmarkStyle: React.CSSProperties = {
  fontFamily: 'Playfair Display, Georgia, serif', fontSize: 26, letterSpacing: '0.30em',
  color: '#FFCC33', fontWeight: 600, margin: '11px 0', textIndent: '0.30em',
}
const letterWrap: React.CSSProperties = {
  padding: '24px 36px 18px', background: 'linear-gradient(180deg, #F8F0DA 0%, #EFE2C4 100%)',
  margin: '24px 36px 18px', border: '1px solid rgba(255, 204, 51, 0.30)', boxShadow: '0 4px 14px rgba(0, 0, 0, 0.22)',
}
const letterContent: React.CSSProperties = { textAlign: 'center', padding: '6px 4px' }
const letterLabel: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif', fontSize: 11, color: 'rgba(14, 52, 112, 0.55)',
  fontStyle: 'italic', marginBottom: 14, letterSpacing: '0.04em',
}
const letterGreeting: React.CSSProperties = {
  fontFamily: 'Playfair Display, Georgia, serif', fontSize: 24, color: '#0E3470',
  fontWeight: 600, fontStyle: 'italic', marginBottom: 8,
}
const letterBody: React.CSSProperties = {
  fontFamily: 'Playfair Display, Georgia, serif', fontSize: 16, color: '#0E3470', lineHeight: 1.5, fontStyle: 'italic',
}
// Readable notice — navy box, white text, gold edge (gold-on-cream was invisible).
const takenBanner: React.CSSProperties = {
  background: '#0E3470', border: '1.5px solid #FFCC33', borderRadius: 6,
  padding: '13px 18px', margin: '6px 0 14px', fontFamily: 'Poppins, sans-serif',
  fontSize: 14, color: '#FFFFFF', fontWeight: 500, lineHeight: 1.6, textAlign: 'center',
}
const slotsWrap: React.CSSProperties = {
  padding: '16px 36px 22px', background: '#0E3470', borderTop: '1px solid rgba(255, 204, 51, 0.18)',
}
const dayLabel: React.CSSProperties = {
  fontFamily: 'Playfair Display, Georgia, serif', fontSize: 18, color: '#FFCC33',
  fontWeight: 600, textAlign: 'center', margin: '4px 0 12px', fontStyle: 'italic',
}
const slotsGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
}
const slotBtn: React.CSSProperties = {
  width: '100%', padding: '12px 8px', background: 'rgba(255, 204, 51, 0.07)', color: '#FFCC33',
  border: '1px solid rgba(255, 204, 51, 0.45)', borderRadius: 2,
  fontFamily: 'Playfair Display, Georgia, serif', fontSize: 15, cursor: 'pointer', letterSpacing: '0.02em',
}
const footnote: React.CSSProperties = {
  fontSize: 11, color: 'rgba(255, 204, 51, 0.65)', textAlign: 'center', marginTop: 16,
  fontFamily: 'Poppins, sans-serif', letterSpacing: '0.10em',
}
const emptyStyle: React.CSSProperties = {
  color: '#FFCC33', textAlign: 'center', fontFamily: 'Playfair Display, Georgia, serif',
  fontSize: 16, fontStyle: 'italic', padding: '20px 0', lineHeight: 1.6,
}
const emailLabel: React.CSSProperties = {
  display: 'block', fontFamily: 'Poppins, sans-serif', fontSize: 11, letterSpacing: '0.18em',
  textIndent: '0.18em', color: '#FFCC33', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6, textAlign: 'center',
}
const emailInput: React.CSSProperties = {
  width: '100%', padding: '11px 14px', background: 'rgba(255, 204, 51, 0.05)',
  border: '0.5px solid rgba(255, 204, 51, 0.40)', borderRadius: 2, color: '#FFCC33',
  fontFamily: 'Playfair Display, Georgia, serif', fontSize: 14, marginBottom: 4, textAlign: 'center',
}
const emailHint: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif', fontSize: 10, color: 'rgba(255, 204, 51, 0.55)', textAlign: 'center', fontStyle: 'italic',
}
const backLink: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif', fontSize: 12, color: '#FFCC33', letterSpacing: '0.10em',
  textDecoration: 'none', textTransform: 'uppercase',
}
const footerStyle: React.CSSProperties = {
  background: '#0E3470', padding: '22px 48px', borderTop: '1px solid rgba(255, 204, 51, 0.18)', textAlign: 'center',
}
const footerName: React.CSSProperties = {
  fontFamily: 'Playfair Display, Georgia, serif', fontSize: 16, color: '#FFCC33',
  fontWeight: 600, letterSpacing: '0.10em', textIndent: '0.10em',
}
const footerBy: React.CSSProperties = {
  fontFamily: 'EB Garamond, Garamond, Georgia, serif', fontStyle: 'italic', fontSize: 12, color: '#FFCC33', marginTop: 3,
}
const footerSub: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif', fontSize: 9, color: '#FFCC33', marginTop: 11, letterSpacing: '0.06em',
}
