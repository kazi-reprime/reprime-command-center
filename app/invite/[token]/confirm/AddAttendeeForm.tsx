'use client'

import { useState } from 'react'

type Props = {
  parentToken: string
}

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function AddAttendeeForm({ parentToken }: Props) {
  const [emails, setEmails] = useState<string[]>([''])
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function update(idx: number, value: string) {
    setEmails((prev) => prev.map((e, i) => (i === idx ? value : e)))
  }

  function addAnother() {
    setEmails((prev) => [...prev, ''])
  }

  function removeAt(idx: number) {
    setEmails((prev) => prev.filter((_, i) => i !== idx))
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = emails.map((s) => s.trim()).filter(Boolean)
    if (cleaned.length === 0) {
      setErrorMsg('Add at least one email.')
      setStatus('error')
      return
    }
    setStatus('sending')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/invitations/add-attendee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_token: parentToken, emails: cleaned }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string; sent?: number }
      if (!res.ok) {
        throw new Error(data.message || data.error || `HTTP ${res.status}`)
      }
      setStatus('sent')
      setEmails([''])
    } catch (err) {
      setErrorMsg((err as Error).message)
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div style={successStyle}>
        ✓ Invitation sent. They will receive their own booking link to join this meeting.
        <button
          type="button"
          onClick={() => { setStatus('idle'); setErrorMsg(null) }}
          style={addAnotherStyle}
        >
          + Add Another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={send}>
      {emails.map((value, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <input
            type="email"
            placeholder="name@firm.com"
            value={value}
            onChange={(e) => update(idx, e.target.value)}
            required={idx === 0}
            style={inputStyle}
            disabled={status === 'sending'}
          />
          {emails.length > 1 && (
            <button type="button" onClick={() => removeAt(idx)} style={removeBtnStyle} aria-label="Remove">
              ×
            </button>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 4px 0', gap: 12 }}>
        <button type="button" onClick={addAnother} style={addAnotherStyle} disabled={status === 'sending'}>
          + Add Another
        </button>
        <button type="submit" style={sendBtnStyle} disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send Invitation →'}
        </button>
      </div>

      {errorMsg && (
        <p style={{ marginTop: 12, fontSize: 12, color: '#FF7474', textAlign: 'center' }}>{errorMsg}</p>
      )}
    </form>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '14px 20px',
  border: '0.5px solid rgba(255, 204, 51, 0.35)',
  background: 'transparent',
  fontFamily: 'Playfair Display, Georgia, serif',
  fontSize: 17,
  color: '#FFCC33',
  fontWeight: 400,
  textAlign: 'center',
  outline: 'none',
  transition: 'border-color 0.15s, background 0.15s',
}

const removeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '0.5px solid rgba(255, 204, 51, 0.35)',
  color: '#FFCC33',
  width: 36,
  height: 36,
  cursor: 'pointer',
  fontSize: 16,
  fontFamily: 'inherit',
}

const addAnotherStyle: React.CSSProperties = {
  background: 'transparent',
  border: 0,
  color: 'rgba(255, 204, 51, 0.85)',
  fontFamily: 'Poppins, sans-serif',
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  fontWeight: 600,
  cursor: 'pointer',
  textIndent: '0.18em',
}

const sendBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 0,
  color: '#FFCC33',
  fontFamily: 'Poppins, sans-serif',
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  fontWeight: 600,
  cursor: 'pointer',
  textIndent: '0.18em',
}

const successStyle: React.CSSProperties = {
  padding: '14px 20px',
  border: '0.5px solid rgba(255, 204, 51, 0.45)',
  background: 'rgba(255, 204, 51, 0.05)',
  color: '#FFCC33',
  fontFamily: 'Playfair Display, Georgia, serif',
  fontSize: 14,
  fontStyle: 'italic',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  alignItems: 'center',
}
