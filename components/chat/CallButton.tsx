'use client'
import type { Panel } from '@/lib/timelines/types'

type Props = {
  panel: Panel
  phone: string
  isGroup: boolean
  contactName?: string | null
}

function toE164(phone: string): string {
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return trimmed
  if (digits.length === 10) return `+1${digits}`
  return `+${digits}`
}

export default function CallButton({ panel, phone, isGroup, contactName }: Props) {
  if (isGroup) return null
  const e164 = toE164(phone)
  const display = contactName || phone

  const onClick = () => {
    if (panel === '305') {
      const url = `https://voice.google.com/u/0/calls?a=nc,${encodeURIComponent(e164)}`
      // Force popup window (not new tab). Chrome's heuristic:
      //   - `popup=1` is the recognized truthy form (NOT `popup=true`)
      //   - explicit width + height triggers popup behavior
      //   - `noopener`/`noreferrer` MUST NOT be in features string for
      //     Chrome to treat as popup; set opener=null after instead
      const w = 460
      const h = 720
      const left = Math.max(0, window.screenX + (window.outerWidth - w))
      const top = Math.max(0, window.screenY + 40)
      const features = `popup=1,width=${w},height=${h},left=${left},top=${top}`
      const popup = window.open(url, 'reprime-voice', features)
      if (popup) {
        try { popup.opener = null } catch { /* cross-origin — fine */ }
      } else {
        // Browser blocked the popup entirely — fall back to a new tab so
        // the call still happens.
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } else {
      // tel: URI — let the OS handle it via Continuity / Phone Link.
      // Use a hidden anchor + click to avoid navigating the dashboard tab.
      const a = document.createElement('a')
      a.href = `tel:${e164}`
      a.rel = 'noopener noreferrer'
      a.target = '_self'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const accent = panel === '305' ? 'var(--rp-gold)' : 'var(--personal-accent)'
  const accentText = panel === '305' ? 'var(--rp-navy)' : '#fff'
  const border = panel === '305' ? 'var(--rp-border)' : 'var(--personal-border)'
  const hint = panel === '305' ? 'Call via Google Voice' : 'Dial on iPhone'

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${hint} — ${display} (${e164})`}
      aria-label={`Call ${display}`}
      style={{
        background: accent,
        color: accentText,
        border: `1px solid ${border}`,
        borderRadius: 999,
        padding: '0.3rem 0.75rem',
        fontSize: '0.8rem',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'inherit',
      }}
    >
      <span aria-hidden>📞</span>
      <span>Call</span>
    </button>
  )
}
