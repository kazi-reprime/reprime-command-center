'use client'

import { useState } from 'react'

type ConciergeType = 'running_late' | 'couldnt_make_it'

type Channel = 'whatsapp_305' | 'whatsapp_718' | 'sms_phone_link' | 'google_voice_305'
type Lang = 'en' | 'he'

type AttendeeLike = string | { email?: string | null } | null | undefined

export interface ConciergeMeeting {
  id?: string
  title?: string | null
  time?: string | null
  startTime?: string | null
  attendees?: AttendeeLike[] | null
  attendee_name?: string | null
  thread_id?: string | null
  zoomLink?: string | null
}

interface Props {
  meeting: ConciergeMeeting
  onSent?: () => void
}

const CHANNELS: Array<{ id: Channel; label: string }> = [
  { id: 'whatsapp_305', label: 'WhatsApp 305' },
  { id: 'whatsapp_718', label: 'WhatsApp 718' },
  { id: 'sms_phone_link', label: 'SMS via Phone Link' },
  { id: 'google_voice_305', label: 'Google Voice 305' },
]

function pickAttendeeEmail(meeting: ConciergeMeeting): string | null {
  const list = meeting.attendees
  if (!list || list.length === 0) return null
  const first = list[0]
  if (!first) return null
  if (typeof first === 'string') return first
  return first.email || null
}

function digitsOnly(phone: string | null | undefined): string {
  return (phone || '').replace(/\D+/g, '')
}

export default function ConciergeButtons({ meeting, onSent }: Props) {
  const [open, setOpen] = useState<ConciergeType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [en, setEn] = useState('')
  const [he, setHe] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [phone, setPhone] = useState<string | null>(null)
  const [channel, setChannel] = useState<Channel>('whatsapp_305')
  const [lang, setLang] = useState<Lang>('en')
  const [sending, setSending] = useState(false)

  function reset() {
    setOpen(null)
    setLoading(false)
    setError(null)
    setEn('')
    setHe('')
    setSlots([])
    setPhone(null)
    setSending(false)
  }

  async function start(type: ConciergeType) {
    setOpen(type)
    setLoading(true)
    setError(null)
    setEn('')
    setHe('')
    setSlots([])
    setPhone(null)
    setLang('en')
    setChannel('whatsapp_305')

    const email = pickAttendeeEmail(meeting)

    let resolvedPhone: string | null = null
    let resolvedName: string | null = meeting.attendee_name || null
    try {
      if (email) {
        const res = await fetch(
          `/api/pipedrive/resolve?phone=${encodeURIComponent(email)}`
        )
        if (res.ok) {
          const data = await res.json()
          const person = data?.person
          if (person) {
            resolvedName = person.name || resolvedName
            const phones = Array.isArray(person.phone) ? person.phone : []
            const primary =
              phones.find((p: { primary?: boolean }) => p?.primary) || phones[0]
            if (primary?.value) resolvedPhone = String(primary.value)
          }
        }
      }
    } catch {
      // Pipedrive failure is non-fatal — Gideon can still send manually.
    }

    setPhone(resolvedPhone)

    try {
      const res = await fetch('/api/ai/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          meeting: {
            title: meeting.title,
            time: meeting.time || meeting.startTime,
            attendee_name: resolvedName,
            zoom_link: meeting.zoomLink ?? null,
          },
          contact: resolvedPhone || resolvedName
            ? { name: resolvedName, phone: resolvedPhone }
            : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'concierge_failed')
      setEn(data.en || '')
      setHe(data.he || '')
      setSlots(Array.isArray(data.slots) ? data.slots : [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    setSending(true)
    setError(null)
    const body = lang === 'en' ? en : he

    try {
      if (channel === 'whatsapp_305' || channel === 'whatsapp_718') {
        const panel = channel === 'whatsapp_305' ? '305' : '718'
        const threadId = meeting.thread_id || null

        if (threadId) {
          const res = await fetch('/api/whatsapp/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ panel, thread_id: threadId, body }),
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || 'whatsapp_send_failed')
          }
        } else {
          const digits = digitsOnly(phone)
          if (!digits) throw new Error('no_phone — open the thread to send')
          window.open(
            `https://wa.me/${digits}?text=${encodeURIComponent(body)}`,
            '_blank',
            'noopener,noreferrer'
          )
        }
      } else if (channel === 'sms_phone_link') {
        const digits = digitsOnly(phone)
        const target = digits || ''
        window.open(`sms:${target}?body=${encodeURIComponent(body)}`, '_blank')
      } else if (channel === 'google_voice_305') {
        window.open(
          `https://voice.google.com/u/0/messages?text=${encodeURIComponent(body)}`,
          '_blank',
          'noopener,noreferrer'
        )
      }

      onSent?.()
      reset()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const baseBtn: React.CSSProperties = {
    fontSize: 14,
    padding: '8px 18px',
    borderRadius: 6,
    border: '1px solid transparent',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'transparent',
    color: 'inherit',
    fontWeight: 600,
  }

  return (
    <>
      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <button
          type="button"
          aria-label="Running late"
          onClick={() => start('running_late')}
          style={{ ...baseBtn, borderColor: '#FFCC33', color: '#FFCC33' }}
        >
          🕐 Late
        </button>
        <button
          type="button"
          aria-label="Couldn&apos;t make it"
          onClick={() => start('couldnt_make_it')}
          style={{ ...baseBtn, borderColor: '#FF7474', color: '#FF7474' }}
        >
          ❌ Can&apos;t make it
        </button>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) reset()
          }}
        >
          <div
            style={{
              background: 'rgba(14, 52, 112, 0.85)',
              color: '#FFFFFF',
              border: '1px solid rgba(14, 52, 112, 0.70)',
              borderRadius: 10,
              padding: 20,
              width: 'min(900px, 95vw)',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 16, color: '#FFCC33' }}>
                {open === 'running_late' ? 'Running late' : "Couldn't make it"}
                {meeting.title ? ` — ${meeting.title}` : ''}
              </h2>
              <button
                type="button"
                onClick={reset}
                style={{
                  ...baseBtn,
                  borderColor: 'rgba(14, 52, 112, 0.70)',
                  color: '#FFFFFF',
                }}
              >
                Close
              </button>
            </div>

            {loading ? (
              <p style={{ color: '#FFCC33' }}>Generating…</p>
            ) : (
              <>
                {error ? (
                  <p style={{ color: '#FF7474', fontSize: 12 }}>Error: {error}</p>
                ) : null}

                {open === 'couldnt_make_it' && slots.length > 0 ? (
                  <div style={{ marginBottom: 12, fontSize: 12, color: '#FFCC33' }}>
                    Embedded slots:{' '}
                    {slots.map((s, i) => (
                      <span key={i} style={{ marginRight: 8 }}>
                        {s}
                        {i < slots.length - 1 ? ' ·' : ''}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#FFCC33' }}>English</span>
                    <textarea
                      value={en}
                      onChange={(e) => setEn(e.target.value)}
                      rows={6}
                      style={{
                        background: '#0E3470',
                        color: '#FFFFFF',
                        border: '1px solid rgba(14, 52, 112, 0.70)',
                        borderRadius: 6,
                        padding: 8,
                        fontSize: 13,
                        resize: 'vertical',
                      }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#FFCC33' }}>Hebrew</span>
                    <textarea
                      value={he}
                      onChange={(e) => setHe(e.target.value)}
                      rows={6}
                      dir="rtl"
                      style={{
                        background: '#0E3470',
                        color: '#FFFFFF',
                        border: '1px solid rgba(14, 52, 112, 0.70)',
                        borderRadius: 6,
                        padding: 8,
                        fontSize: 13,
                        resize: 'vertical',
                      }}
                    />
                  </label>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    marginBottom: 12,
                  }}
                >
                  <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                    Channel:
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as Channel)}
                      style={{
                        background: '#0E3470',
                        color: '#FFFFFF',
                        border: '1px solid rgba(14, 52, 112, 0.70)',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 12,
                      }}
                    >
                      {CHANNELS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                    Language:
                    <select
                      value={lang}
                      onChange={(e) => setLang(e.target.value as Lang)}
                      style={{
                        background: '#0E3470',
                        color: '#FFFFFF',
                        border: '1px solid rgba(14, 52, 112, 0.70)',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 12,
                      }}
                    >
                      <option value="en">English</option>
                      <option value="he">Hebrew</option>
                    </select>
                  </label>

                  <span style={{ fontSize: 11, color: '#FFCC33' }}>
                    {phone ? `→ ${phone}` : 'phone unresolved — Phone Link / Google Voice will prompt'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    onClick={reset}
                    style={{
                      ...baseBtn,
                      borderColor: 'rgba(14, 52, 112, 0.70)',
                      color: '#FFFFFF',
                      padding: '6px 14px',
                      fontSize: 12,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || (lang === 'en' ? !en.trim() : !he.trim())}
                    style={{
                      ...baseBtn,
                      background: '#FFCC33',
                      color: '#0E3470',
                      borderColor: '#FFCC33',
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: sending ? 'wait' : 'pointer',
                      opacity:
                        sending || (lang === 'en' ? !en.trim() : !he.trim()) ? 0.6 : 1,
                    }}
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
