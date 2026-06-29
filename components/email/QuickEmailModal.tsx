'use client'

import { useEffect, useState } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  /** Optional initial values — used when opened from a contact context. */
  initialTo?: string
  initialSubject?: string
  initialBody?: string
}

const NAVY = '#0E3470'
const GOLD = '#FFCC33'
const TEXT = '#F5EFD8'
const MUTED = '#8C8771'

export default function QuickEmailModal({ open, onClose, initialTo = '', initialSubject = '', initialBody = '' }: Props) {
  const [to, setTo] = useState(initialTo)
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(initialBody)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (open) {
      setTo(initialTo)
      setSubject(initialSubject)
      setBody(initialBody)
      setError(null)
      setSent(false)
    }
  }, [open, initialTo, initialSubject, initialBody])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), body: body.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`)
      setSent(true)
      setTimeout(() => { setSent(false); onClose() }, 1500)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(7, 16, 30, 0.78)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 9000,
        padding: '8vh 1rem 1rem',
      }}
    >
      <form
        onSubmit={send}
        style={{
          background: NAVY,
          border: `1px solid ${GOLD}55`,
          width: '100%',
          maxWidth: 640,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${GOLD}33`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: GOLD, fontSize: 14, fontWeight: 700, letterSpacing: '0.06em' }}>📧 New email</div>
          <button type="button" onClick={onClose} aria-label="Close" style={escapeBtn}>ESC</button>
        </div>

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>
          <Field
            label="To"
            placeholder="name@firm.com (separate multiple with commas)"
            value={to}
            onChange={setTo}
          />
          <Field
            label="Subject"
            placeholder=""
            value={subject}
            onChange={setSubject}
          />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Body</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder=""
              style={{
                background: 'rgba(255, 204, 51, 0.04)',
                color: TEXT,
                border: `1px solid ${GOLD}55`,
                padding: '10px 12px',
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                minHeight: 200,
              }}
              required
            />
          </label>
        </div>

        {(error || sent) && (
          <div style={{ padding: '8px 18px', borderTop: `1px solid ${GOLD}22`, fontSize: 12, color: error ? '#FF7474' : '#6ee7b7' }}>
            {error ? `✗ ${error}` : '✓ Sent.'}
          </div>
        )}

        <div style={{ padding: '12px 18px', borderTop: `1px solid ${GOLD}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: MUTED, letterSpacing: '0.04em' }}>
            Sends from <b style={{ color: GOLD }}>g@reprime-terminal.com</b>, Reply-To <b style={{ color: GOLD }}>g@reprime.com</b>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} disabled={sending} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={sending || !to.trim() || !subject.trim() || !body.trim()} style={sendBtn}>
              {sending ? 'Sending…' : 'Send →'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Field({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={labelStyle}>{label}</span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'rgba(255, 204, 51, 0.04)',
          color: TEXT,
          border: `1px solid ${GOLD}55`,
          padding: '8px 12px',
          fontSize: 14,
          fontFamily: 'inherit',
          outline: 'none',
        }}
        required
      />
    </label>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: GOLD,
}

const escapeBtn: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${GOLD}55`,
  color: GOLD,
  padding: '4px 10px',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '0.10em',
}

const cancelBtn: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${GOLD}55`,
  color: GOLD,
  padding: '8px 18px',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const sendBtn: React.CSSProperties = {
  background: GOLD,
  color: NAVY,
  border: 0,
  padding: '8px 18px',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
