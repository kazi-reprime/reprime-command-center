'use client'

import { useEffect, useState } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  /** Optional initial number — used when opened from a contact context. */
  initialPhone?: string
  initialName?: string
}

const NAVY = '#0E3470'
const GOLD = '#FFCC33'
const TEXT = '#F5EFD8'
const MUTED = '#8C8771'

interface ResolvedContact {
  name: string | null
  company: string | null
  source: string
}

function normalize(input: string): string {
  // Strip everything except digits and a leading +
  const trimmed = input.trim()
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/\D/g, '')
  }
  const digits = trimmed.replace(/\D/g, '')
  // 10-digit US number → assume +1
  if (digits.length === 10) return '+1' + digits
  // 11-digit starting with 1 → +1...
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits
  return digits ? '+' + digits : ''
}

function isValid(e164: string): boolean {
  return /^\+\d{8,15}$/.test(e164)
}

function displayPhone(e164: string): string {
  // +1XXXXXXXXXX → +1 (XXX) XXX-XXXX
  if (e164.startsWith('+1') && e164.length === 12) {
    return `+1 (${e164.slice(2, 5)}) ${e164.slice(5, 8)}-${e164.slice(8)}`
  }
  return e164
}

export default function QuickCallModal({ open, onClose, initialPhone = '', initialName = '' }: Props) {
  const [phone, setPhone] = useState(initialPhone)
  const [resolved, setResolved] = useState<ResolvedContact | null>(initialName ? { name: initialName, company: null, source: 'caller' } : null)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    if (open) {
      setPhone(initialPhone)
      setResolved(initialName ? { name: initialName, company: null, source: 'caller' } : null)
    }
  }, [open, initialPhone, initialName])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Reverse-lookup as user types (debounced)
  useEffect(() => {
    if (!open) return
    const e164 = normalize(phone)
    if (!isValid(e164)) {
      setResolved(null)
      return
    }
    const timer = setTimeout(async () => {
      setResolving(true)
      try {
        const res = await fetch(`/api/pipedrive/resolve?phone=${encodeURIComponent(e164)}`)
        if (res.ok) {
          const data = await res.json()
          if (data?.person?.name) {
            setResolved({
              name: data.person.name,
              company: data.person.org_name ?? null,
              source: 'pipedrive',
            })
            return
          }
        }
        setResolved(null)
      } catch {
        setResolved(null)
      } finally {
        setResolving(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [phone, open])

  function dial() {
    const e164 = normalize(phone)
    if (!isValid(e164)) return
    // tel: opens the system handler — Quo registers as the default on Mac
    window.location.href = `tel:${e164}`
  }

  if (!open) return null

  const e164 = normalize(phone)
  const valid = isValid(e164)

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
      <div
        style={{
          background: NAVY,
          border: `1px solid ${GOLD}55`,
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${GOLD}33`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: GOLD, fontSize: 14, fontWeight: 700, letterSpacing: '0.06em' }}>📞 Quick Call</div>
          <button type="button" onClick={onClose} aria-label="Close" style={escapeBtn}>ESC</button>
        </div>

        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Phone number</span>
            <input
              autoFocus
              type="tel"
              placeholder="+1 (305) 555-1234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && valid) dial() }}
              style={{
                background: 'rgba(255, 204, 51, 0.04)',
                color: TEXT,
                border: `1px solid ${GOLD}55`,
                padding: '12px 14px',
                fontSize: 18,
                fontFamily: 'inherit',
                outline: 'none',
                letterSpacing: '0.04em',
              }}
            />
          </label>

          {/* Caller-ID preview */}
          <div style={{ minHeight: 36, fontSize: 13 }}>
            {resolving && <span style={{ color: MUTED }}>Looking up…</span>}
            {!resolving && resolved && (
              <div style={{ color: TEXT }}>
                <span style={{ color: GOLD, fontWeight: 700 }}>{resolved.name}</span>
                {resolved.company && <span style={{ color: MUTED }}> · {resolved.company}</span>}
                <span style={{ color: MUTED, fontSize: 10, marginLeft: 8, letterSpacing: '0.06em' }}>
                  ({resolved.source === 'pipedrive' ? 'Pipedrive' : 'caller'})
                </span>
              </div>
            )}
            {!resolving && !resolved && valid && (
              <span style={{ color: MUTED }}>Unknown — not in Pipedrive.</span>
            )}
          </div>

          <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5, letterSpacing: '0.02em' }}>
            Opens your system phone handler. On this Mac that&rsquo;s Quo (305) — set in System Settings → Phone.
            {valid && <span> Will dial <b style={{ color: GOLD }}>{displayPhone(e164)}</b>.</span>}
          </div>
        </div>

        <div style={{ padding: '12px 18px', borderTop: `1px solid ${GOLD}22`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
          <button
            type="button"
            onClick={dial}
            disabled={!valid}
            style={{ ...callBtn, opacity: valid ? 1 : 0.4, cursor: valid ? 'pointer' : 'not-allowed' }}
          >
            Call →
          </button>
        </div>
      </div>
    </div>
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

const callBtn: React.CSSProperties = {
  background: GOLD,
  color: NAVY,
  border: 0,
  padding: '8px 22px',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  fontFamily: 'inherit',
}
