'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type ChannelOption = 'whatsapp_305' | 'whatsapp_718' | 'email'
type MeetingType = 'terminal' | 'meeting'

const PREFERRED_LABEL: Record<number, string> = {
  27: 'WhatsApp',
  28: 'Email',
  29: 'Phone',
  30: 'Zoom',
}

interface PipedriveSearchHit {
  id: number
  name: string
  emails: string[]
  phones: string[]
}

interface ContactPrefs {
  preferred_method: number | null
  default_channel: string
}

interface Invitation {
  id: string
  contact_first_name: string | null
  contact_name: string | null
  status: string
  confirmed_slot_iso: string | null
  zoom_join_url: string | null
  created_at: string | null
  expires_at: string | null
  meeting_type?: string | null
}

const NAVY = '#0E3470'
const NAVY_DEEP = '#0A2855'
const GOLD = '#FFCC33'
const GOLD_LIGHT = '#FFCC33'
const TEXT = '#fff'
const MUTED = '#8A8680'
const BORDER = 'rgba(14, 52, 112, 0.70)'

function formatSlotDisplay(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const fmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  })
  return `${fmt.format(d)} Central`
}

const MEETING_CONFIG = {
  terminal: {
    symbol: 'T',
    label: 'Terminal Introduction',
    tagline: 'RePrime Group · Terminal Introduction',
    previewEmail: (firstName: string) =>
      `${firstName},\n\nI'm hosting a Terminal Introduction — a deal sourcing system unlike anything that exists. Built to surface and close opportunities at a different level.\n\n30 minutes to show you what it is.\n\nPick a time: [booking link — inserted on send]\n\n—\nGideon Gratsiani\nFounder, RePrime Group`,
    previewWhatsApp: (firstName: string) =>
      `${firstName} — I'm hosting a Terminal Introduction.\n\nThe Terminal is a deal sourcing machine unlike anything that exists — built to source, qualify, and close at a different level. One of a kind.\n\n30 minutes to walk you through it. Pick a time:\n[booking link — inserted on send]\n— Gideon`,
    emailSubject: (firstName: string) => `Terminal Introduction — ${firstName}`,
  },
  meeting: {
    symbol: '·',
    label: 'General Meeting',
    tagline: 'RePrime Group · Meeting Request',
    previewEmail: (firstName: string) =>
      `${firstName},\n\nI'd value some time with you — thirty minutes, your schedule.\n\nPick what works and I'll be there:\n[booking link — inserted on send]\n\n—\nGideon Gratsiani\nFounder, RePrime Group`,
    previewWhatsApp: (firstName: string) =>
      `${firstName} — I'd value some time with you.\n\n30 minutes, your schedule. Pick what works:\n[booking link — inserted on send]\n— Gideon`,
    emailSubject: (firstName: string) => `Let's Connect — ${firstName}`,
  },
} as const

// Default channels: WhatsApp 305 + Email (most common combo)
const DEFAULT_CHANNELS: Set<ChannelOption> = new Set(['whatsapp_305', 'email'])

interface BookingsPanelProps {
  onClose?: () => void
  autofillPhone?: string | null
  autofillName?: string | null
}

export default function BookingsPanel({ onClose, autofillPhone, autofillName }: BookingsPanelProps) {
  const [view, setView] = useState<'compose' | 'status'>('compose')
  const [meetingType, setMeetingType] = useState<MeetingType>('terminal')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PipedriveSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [contact, setContact] = useState<PipedriveSearchHit | null>(null)

  const [personalMessage, setPersonalMessage] = useState('')
  const [channels, setChannels] = useState<Set<ChannelOption>>(new Set(DEFAULT_CHANNELS))
  const [channelHint, setChannelHint] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [toastIsError, setToastIsError] = useState(false)

  const [recent, setRecent] = useState<Invitation[]>([])
  const [loadingRecent, setLoadingRecent] = useState(false)

  const searchAbort = useRef<AbortController | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Auto-fill from active thread (phone lookup → Pipedrive) ──────────────────
  useEffect(() => {
    if (contact) return  // already have a contact, don't overwrite
    const term = autofillPhone?.replace(/\D+/g, '') || autofillName || ''
    if (!term) return
    let cancelled = false
    ;(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/pipedrive/search?q=${encodeURIComponent(term)}&limit=5`, { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const json = (await res.json()) as { results?: PipedriveSearchHit[] }
        if (cancelled) return
        const hits = json.results ?? []
        if (hits.length === 1) {
          setContact(hits[0])
        } else if (hits.length > 1) {
          setResults(hits)
          setQuery(autofillName || autofillPhone || '')
        }
      } catch { /* non-fatal */ } finally {
        if (!cancelled) setSearching(false)
      }
    })()
    return () => { cancelled = true }
  // Only run once on mount (or when autofill props change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autofillPhone, autofillName])

  // ── Contact search ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (contact) { setResults([]); return }
    if (query.trim().length < 2) { setResults([]); return }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      if (searchAbort.current) searchAbort.current.abort()
      const ac = new AbortController()
      searchAbort.current = ac
      setSearching(true)
      try {
        const res = await fetch(`/api/pipedrive/search?q=${encodeURIComponent(query.trim())}&limit=8`, {
          signal: ac.signal,
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`search_${res.status}`)
        const json = (await res.json()) as { results?: PipedriveSearchHit[] }
        setResults(json.results ?? [])
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error('[BookingsPanel] search failed', err)
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [query, contact])

  // ── Auto-select channel from Pipedrive preferences ────────────────────────────
  useEffect(() => {
    if (!contact) { setChannelHint(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/pipedrive/person?id=${contact.id}`, { cache: 'no-store' })
        if (!res.ok) return
        const json = (await res.json()) as ContactPrefs
        if (cancelled) return
        const pref = json.preferred_method ?? null
        if (pref !== null) {
          const label = PREFERRED_LABEL[pref] ?? `option ${pref}`
          setChannelHint(`Pipedrive preferred: ${label}`)
        }
        // Map Pipedrive preference to channel selection
        if (json.default_channel === 'whatsapp_718') {
          setChannels(new Set(['whatsapp_718', 'email']))
        } else if (json.default_channel === 'whatsapp_305') {
          setChannels(new Set(['whatsapp_305', 'email']))
        } else if (json.default_channel === 'email') {
          setChannels(new Set(['email']))
        }
        // 'all' → keep all three
      } catch (err) {
        console.error('[BookingsPanel] prefs fetch failed', err)
      }
    })()
    return () => { cancelled = true }
  }, [contact])

  // ── Status tab ────────────────────────────────────────────────────────────────
  const loadRecent = useCallback(async () => {
    setLoadingRecent(true)
    try {
      const res = await fetch('/api/bookings/list', { cache: 'no-store' })
      if (!res.ok) throw new Error(`list_${res.status}`)
      const json = (await res.json()) as { invitations?: Invitation[] }
      setRecent(json.invitations ?? [])
    } catch (err) {
      console.error('[BookingsPanel] loadRecent failed', err)
    } finally {
      setLoadingRecent(false)
    }
  }, [])

  useEffect(() => {
    if (view === 'status') void loadRecent()
  }, [view, loadRecent])

  // ── Channel toggle ────────────────────────────────────────────────────────────
  function toggleChannel(c: ChannelOption) {
    setChannels((prev) => {
      const next = new Set(prev)
      if (next.has(c)) {
        // Don't allow deselecting the last channel
        if (next.size <= 1) return prev
        next.delete(c)
      } else {
        next.add(c)
      }
      return next
    })
  }

  // ── Send ──────────────────────────────────────────────────────────────────────
  const cfg = MEETING_CONFIG[meetingType]
  const firstName = contact ? (contact.name.split(' ')[0] || contact.name) : null

  const previewEmail = useMemo(() => {
    if (!firstName) return null
    const body = personalMessage.trim()
      ? `${personalMessage.trim()}\n\n— — —\n\n${cfg.previewEmail(firstName)}`
      : cfg.previewEmail(firstName)
    return { subject: cfg.emailSubject(firstName), text: body }
  }, [firstName, cfg, personalMessage])

  const previewWhatsapp = useMemo(() => {
    if (!firstName) return null
    if (personalMessage.trim()) {
      return `${personalMessage.trim()}\n\nPick a time: [booking link — inserted on send]\n— Gideon`
    }
    return cfg.previewWhatsApp(firstName)
  }, [firstName, cfg, personalMessage])

  async function send() {
    if (!contact) { setToast('Pick a contact first.'); setToastIsError(true); return }
    if (channels.size === 0) { setToast('Select at least one channel.'); setToastIsError(true); return }
    setSending(true)
    setToast(null)
    try {
      const res = await fetch('/api/bookings/send-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: contact.id,
          channels: Array.from(channels),
          meeting_type: meetingType,
          personal_message: personalMessage.trim() || undefined,
        }),
      })
      const json = (await res.json()) as {
        invitation_id?: string
        invite_url?: string
        sent_channels?: string[]
        errors?: Array<{ channel: string; message: string }>
        error?: string
        message?: string
        sql?: string
        phone_e164?: string | null
        whatsapp_text?: string | null
      }
      if (!res.ok) {
        // Special handling for missing DB table
        if (json.error === 'invitation_insert_failed' && json.sql) {
          setToast(`DB table missing. Run the SQL shown below in Supabase SQL Editor.`)
          setToastIsError(true)
          setDbSetupSql(json.sql)
        } else {
          setToast(`Failed: ${json.error ?? 'unknown'}${json.message ? ` — ${json.message}` : ''}`)
          setToastIsError(true)
        }
        return
      }
      const sent = json.sent_channels ?? []
      const errs = json.errors ?? []

      // Captain hotfix 2026-05-20: detect cold-start (Timelines lacks an existing
      // chat for this phone). Surface a wa.me deep-link so Gideon can fire one
      // manual send from WhatsApp Web — which creates the chat and unblocks
      // future automated sends to this contact.
      const coldStartChannels = errs
        .filter((e) => e.message === 'no_existing_chat_with_this_phone_on_panel')
        .map((e) => e.channel)
      const isColdStart = coldStartChannels.length > 0 && json.phone_e164 && json.whatsapp_text
      if (isColdStart) {
        setColdStartFallback({
          phone: json.phone_e164!,
          text: json.whatsapp_text!,
          panels: coldStartChannels,
          inviteUrl: json.invite_url ?? '',
        })
      } else {
        setColdStartFallback(null)
      }

      if (sent.length > 0 && errs.length === 0) {
        setToast(`✓ Sent via ${sent.join(', ')}`)
        setToastIsError(false)
        setTimeout(() => onClose?.(), 1800)
      } else if (sent.length > 0) {
        setToast(`Sent via ${sent.join(', ')}. ${errs.length} channel(s) failed.`)
        setToastIsError(false)
      } else if (isColdStart) {
        setToast(`Cold contact — no WhatsApp chat exists yet. Use the manual send button below to create the chat. Email channel sends without this constraint.`)
        setToastIsError(false)
      } else {
        setToast(`No channels sent. ${errs.map((e) => `${e.channel}: ${e.message}`).join(' · ')}`)
        setToastIsError(true)
      }
    } catch (err) {
      setToast(`Failed: ${(err as Error).message}`)
      setToastIsError(true)
    } finally {
      setSending(false)
    }
  }

  const [coldStartFallback, setColdStartFallback] = useState<{
    phone: string
    text: string
    panels: string[]
    inviteUrl: string
  } | null>(null)

  function buildWaMeUrl(phoneE164: string, text: string): string {
    // wa.me expects digits-only (no leading +)
    const digits = phoneE164.replace(/\D/g, '')
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
  }

  function copyColdStartText() {
    if (!coldStartFallback) return
    void navigator.clipboard.writeText(coldStartFallback.text)
    setToast('✓ Message copied. Paste into WhatsApp Web after the chat opens.')
    setToastIsError(false)
  }

  const [dbSetupSql, setDbSetupSql] = useState<string | null>(null)
  const [sqlCopied, setSqlCopied] = useState(false)

  const SETUP_SQL = `CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY,
  contact_pipedrive_id integer,
  contact_first_name text,
  contact_name text,
  contact_email text,
  contact_phone text,
  proposed_slots jsonb DEFAULT '[]'::jsonb,
  meeting_type text DEFAULT 'terminal',
  status text DEFAULT 'sent',
  confirmed_slot_iso text,
  zoom_meeting_id text,
  zoom_join_url text,
  calendar_event_id text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '14 days')
);`

  function copySetupSql() {
    void navigator.clipboard.writeText(dbSetupSql ?? SETUP_SQL)
    setSqlCopied(true)
    setTimeout(() => setSqlCopied(false), 2000)
  }

  return (
    <div
      style={{
        background: NAVY_DEEP,
        color: TEXT,
        fontFamily: 'var(--rp-font-body)',
        border: `1px solid ${BORDER}`,
        borderRadius: '8px',
        padding: '1.5rem 1.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.2rem',
        minWidth: '600px',
        maxWidth: '820px',
        width: '100%',
      }}
    >
      {/* ── Header ── */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: GOLD_LIGHT, letterSpacing: '0.08em', fontSize: '0.88rem', textTransform: 'uppercase', fontWeight: 600 }}>
            {cfg.tagline}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={() => setView('compose')} style={tabBtn(view === 'compose')}>Compose</button>
          <button type="button" onClick={() => setView('status')} style={tabBtn(view === 'status')}>Status</button>
          {onClose && (
            <button type="button" onClick={onClose} style={{ ...tabBtn(false), border: 'none', background: 'transparent' }}>✕</button>
          )}
        </div>
      </header>

      {view === 'compose' && (
        <>
          {/* ── Meeting type ── */}
          <section>
            <label style={labelStyle}>Invitation Type</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
              <button type="button" onClick={() => setMeetingType('terminal')} style={typeBtn(meetingType === 'terminal')}>
                Terminal Introduction
              </button>
              <button type="button" onClick={() => setMeetingType('meeting')} style={typeBtn(meetingType === 'meeting')}>
                · General Meeting
              </button>
            </div>
          </section>

          {/* ── Contact ── */}
          <section>
            <label style={labelStyle}>Contact</label>
            {contact ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.75rem', border: `1px solid ${GOLD}`, borderRadius: '4px', marginTop: '0.4rem' }}>
                <div>
                  <div style={{ color: TEXT, fontSize: '0.95rem' }}>{contact.name}</div>
                  <div style={{ color: MUTED, fontSize: '0.8rem' }}>
                    {[contact.emails?.[0], contact.phones?.[0]].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <button type="button" onClick={() => { setContact(null); setQuery(''); setChannelHint(null); setChannels(new Set(DEFAULT_CHANNELS)); setPersonalMessage('') }} style={ghostBtn}>
                  Change
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative', marginTop: '0.4rem' }}>
                <input
                  type="text"
                  placeholder="Search Pipedrive contacts…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={inputStyle}
                />
                {results.length > 0 && (
                  <ul style={dropdownStyle}>
                    {results.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => { setContact(r); setQuery(''); setResults([]) }}
                          style={dropdownItem}
                        >
                          <div style={{ color: TEXT, fontSize: '0.9rem' }}>{r.name}</div>
                          <div style={{ color: MUTED, fontSize: '0.75rem' }}>
                            {[r.emails?.[0], r.phones?.[0]].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {searching && <div style={{ color: MUTED, fontSize: '0.75rem', marginTop: '0.25rem' }}>Searching…</div>}
              </div>
            )}
          </section>

          {/* ── Personal note ── */}
          <section>
            <label style={labelStyle}>
              Personal note
              <span style={{ color: MUTED, fontWeight: 400, letterSpacing: 0, textTransform: 'none', marginLeft: '0.4rem', fontSize: '0.72rem' }}>— optional, your own words</span>
            </label>
            <textarea
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              placeholder={
                contact
                  ? `Hey ${contact.name.split(' ')[0]}, great seeing you last week — looking forward to showing you this…`
                  : 'Hey Mindy, great seeing you last week — looking forward to showing you this…'
              }
              rows={3}
              style={{
                ...inputStyle,
                marginTop: '0.4rem',
                resize: 'vertical',
                lineHeight: 1.55,
                fontSize: '0.92rem',
                borderColor: personalMessage.trim() ? GOLD : BORDER,
              }}
            />
            {personalMessage.trim() ? (
              <div style={{ fontSize: '0.7rem', color: GOLD_LIGHT, marginTop: '0.25rem' }}>
                ✓ Your personal note will appear above the professional template in the email, and as the full WhatsApp message.
              </div>
            ) : (
              <div style={{ fontSize: '0.7rem', color: MUTED, marginTop: '0.25rem' }}>
                Leave blank to use the standard template. Fill in to lead with your own words.
              </div>
            )}
          </section>

          {/* ── Channel multi-select ── */}
          <section>
            <label style={labelStyle}>Send via</label>
            {channelHint && (
              <div style={{ color: GOLD_LIGHT, fontSize: '0.72rem', marginTop: '0.3rem', fontStyle: 'italic' }}>
                {channelHint}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
              {(
                [
                  ['whatsapp_305', 'WhatsApp 305'],
                  ['whatsapp_718', 'WhatsApp 718'],
                  ['email', 'Email'],
                ] as Array<[ChannelOption, string]>
              ).map(([val, label]) => {
                const active = channels.has(val)
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => toggleChannel(val)}
                    title={active && channels.size === 1 ? 'At least one channel required' : undefined}
                    style={{
                      padding: '0.45rem 0.85rem',
                      background: active ? GOLD : 'transparent',
                      color: active ? NAVY : TEXT,
                      border: `1px solid ${active ? GOLD : BORDER}`,
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{active ? '✓' : '+'}</span>
                    {label}
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.7rem', color: MUTED }}>
              {channels.size === 0
                ? 'Select at least one channel'
                : `Sending to: ${Array.from(channels).map(c => c === 'whatsapp_305' ? 'WhatsApp 305' : c === 'whatsapp_718' ? 'WhatsApp 718' : 'Email').join(' + ')}`
              }
            </div>
          </section>

          {/* ── Preview ── */}
          {contact && (
            <section style={{ display: 'grid', gridTemplateColumns: channels.has('email') && (channels.has('whatsapp_305') || channels.has('whatsapp_718')) ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
              {channels.has('email') && previewEmail && (
                <div style={previewBox}>
                  <div style={previewTitle}>📧 Email preview</div>
                  <div style={{ color: GOLD_LIGHT, fontSize: '0.78rem', marginBottom: '0.5rem' }}>
                    Subject: {previewEmail.subject}
                  </div>
                  <pre style={previewBody}>{previewEmail.text}</pre>
                </div>
              )}
              {(channels.has('whatsapp_305') || channels.has('whatsapp_718')) && previewWhatsapp && (
                <div style={previewBox}>
                  <div style={previewTitle}>
                    💬 WhatsApp preview {channels.has('whatsapp_305') && channels.has('whatsapp_718') ? '(305 + 718)' : channels.has('whatsapp_305') ? '(305)' : '(718)'}
                  </div>
                  <pre style={previewBody}>{previewWhatsapp}</pre>
                </div>
              )}
            </section>
          )}

          {/* ── DB setup SQL if table missing ── */}
          {dbSetupSql && (
            <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: 6, padding: '0.75rem', fontSize: '0.78rem' }}>
              <div style={{ color: '#ff7474', fontWeight: 600, marginBottom: '0.5rem' }}>
                ⚠ Run this once in Supabase SQL Editor (Dashboard → SQL Editor → New query):
              </div>
              <pre style={{ color: '#fca5a5', fontSize: '0.72rem', whiteSpace: 'pre-wrap', margin: '0 0 0.5rem' }}>
                {SETUP_SQL}
              </pre>
              <button
                type="button"
                onClick={copySetupSql}
                style={{ background: '#7f1d1d', border: '1px solid #ff7474', color: '#fff', borderRadius: 4, padding: '3px 10px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {sqlCopied ? '✓ Copied!' : 'Copy SQL'}
              </button>
            </div>
          )}

          {/* ── Cold-start manual WhatsApp fallback (Captain hotfix 2026-05-20) ── */}
          {coldStartFallback && (
            <div style={{ background: 'rgba(255, 204, 51, 0.06)', border: `1px solid ${GOLD}`, borderRadius: 6, padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <div style={{ color: GOLD, fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.04em' }}>
                ⚡ Cold contact — one-time manual send needed
              </div>
              <div style={{ color: GOLD_LIGHT, fontSize: '0.78rem', lineHeight: 1.55 }}>
                {coldStartFallback.panels.includes('whatsapp_305') && coldStartFallback.panels.includes('whatsapp_718')
                  ? 'No existing WhatsApp chats with this number on 305 or 718.'
                  : `No existing WhatsApp chat with this number on the ${coldStartFallback.panels[0]?.replace('whatsapp_', '') ?? ''} panel.`}{' '}
                Click below to open WhatsApp Web with the recipient + message pre-filled. Hit Send once — the chat will exist and future invitations will auto-send via the API.
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a
                  href={buildWaMeUrl(coldStartFallback.phone, coldStartFallback.text)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: GOLD,
                    color: NAVY_DEEP,
                    border: 'none',
                    borderRadius: 5,
                    padding: '0.5rem 0.95rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  Open WhatsApp Web with this message →
                </a>
                <button
                  type="button"
                  onClick={copyColdStartText}
                  style={{
                    background: 'transparent',
                    color: GOLD,
                    border: `1px solid ${GOLD}`,
                    borderRadius: 5,
                    padding: '0.5rem 0.85rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Copy text to clipboard
                </button>
                {coldStartFallback.inviteUrl && (
                  <button
                    type="button"
                    onClick={() => { void navigator.clipboard.writeText(coldStartFallback.inviteUrl); setToast('✓ Magic link copied.'); setToastIsError(false) }}
                    style={{
                      background: 'transparent',
                      color: GOLD_LIGHT,
                      border: `1px solid ${GOLD_LIGHT}`,
                      borderRadius: 5,
                      padding: '0.5rem 0.85rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    Copy magic link only
                  </button>
                )}
              </div>
              <div style={{ color: MUTED, fontSize: '0.72rem', lineHeight: 1.4 }}>
                Tip: if you'd rather use email for cold contacts going forward, untoggle WhatsApp 305/718 and select Email — SendGrid sends to any address without needing a prior chat.
              </div>
            </div>
          )}

          {/* ── Footer ── */}
          <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: toastIsError ? '#FF6F61' : GOLD_LIGHT, fontSize: '0.8rem', flex: 1 }}>
              {toast ?? ' '}
            </span>
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !contact || channels.size === 0}
              style={primaryBtn(sending || !contact || channels.size === 0)}
            >
              {sending ? 'Sending…' : 'Send Invitation'}
            </button>
          </footer>
        </>
      )}

      {view === 'status' && (
        <div>
          {loadingRecent && <div style={{ color: MUTED, fontSize: '0.85rem' }}>Loading…</div>}
          {!loadingRecent && recent.length === 0 && (
            <div style={{ color: MUTED, fontSize: '0.85rem' }}>No invitations yet.</div>
          )}
          {!loadingRecent && recent.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ color: MUTED, textAlign: 'left' }}>
                  <th style={th}>Contact</th>
                  <th style={th}>Type</th>
                  <th style={th}>Status</th>
                  <th style={th}>Slot</th>
                  <th style={th}>Sent</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={td}>{r.contact_name || r.contact_first_name || '—'}</td>
                    <td style={{ ...td, color: r.meeting_type === 'terminal' ? GOLD : GOLD_LIGHT, fontSize: '0.75rem' }}>
                      {r.meeting_type === 'terminal' ? 'Terminal' : r.meeting_type === 'meeting' ? 'Meeting' : '—'}
                    </td>
                    <td style={{ ...td, color: r.status === 'confirmed' ? '#22c55e' : r.status === 'expired' ? '#FF6F61' : GOLD_LIGHT }}>
                      {r.status}
                    </td>
                    <td style={td}>{r.confirmed_slot_iso ? formatSlotDisplay(r.confirmed_slot_iso) : '—'}</td>
                    <td style={td}>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  color: MUTED,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  background: NAVY,
  color: TEXT,
  border: `1px solid ${BORDER}`,
  borderRadius: '4px',
  fontFamily: 'inherit',
  fontSize: '0.9rem',
  boxSizing: 'border-box',
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  marginTop: '0.25rem',
  background: NAVY,
  border: `1px solid ${BORDER}`,
  borderRadius: '4px',
  listStyle: 'none',
  padding: 0,
  margin: '0.25rem 0 0 0',
  maxHeight: '240px',
  overflowY: 'auto',
  zIndex: 10,
}

const dropdownItem: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  background: 'transparent',
  border: 'none',
  borderBottom: `1px solid ${BORDER}`,
  cursor: 'pointer',
  color: TEXT,
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: '0.55rem 1.4rem',
    background: active ? GOLD : 'transparent',
    color: active ? NAVY : GOLD_LIGHT,
    border: `1px solid ${active ? GOLD : 'rgba(255, 204, 51,0.45)'}`,
    borderRadius: '5px',
    fontSize: '0.92rem',
    fontWeight: active ? 700 : 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    letterSpacing: '0.03em',
    transition: 'background 0.15s, color 0.15s',
  }
}

function typeBtn(active: boolean): React.CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: active ? GOLD : 'transparent',
    color: active ? NAVY : TEXT,
    border: `1px solid ${active ? GOLD : BORDER}`,
    borderRadius: '4px',
    fontSize: '0.88rem',
    fontWeight: active ? 600 : 400,
    fontFamily: 'inherit',
    cursor: 'pointer',
    letterSpacing: '0.02em',
  }
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.65rem 1.5rem',
    background: disabled ? '#5C5448' : GOLD,
    color: NAVY,
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.95rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
    flexShrink: 0,
  }
}

const ghostBtn: React.CSSProperties = {
  padding: '0.35rem 0.7rem',
  background: 'transparent',
  color: GOLD_LIGHT,
  border: `1px solid ${BORDER}`,
  borderRadius: '4px',
  fontSize: '0.75rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
}

const previewBox: React.CSSProperties = {
  background: NAVY,
  border: `1px solid ${BORDER}`,
  borderRadius: '4px',
  padding: '0.75rem',
  minWidth: 0,
}

const previewTitle: React.CSSProperties = {
  color: GOLD,
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '0.5rem',
}

const previewBody: React.CSSProperties = {
  color: TEXT,
  fontSize: '0.78rem',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  margin: 0,
  fontFamily: 'inherit',
}

const th: React.CSSProperties = {
  padding: '0.5rem 0.5rem',
  fontWeight: 500,
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const td: React.CSSProperties = {
  padding: '0.5rem 0.5rem',
  verticalAlign: 'top',
}
