'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

interface FailedItem {
  id: string
  thread_id: string
  panel: string | null
  channel_type: string | null
  body: string | null
  status: string | null
  sent_at: string | null
}

interface FailedPayload {
  count: number
  since: string
  items: FailedItem[]
}

const NAVY = '#0E3470'
const GOLD = '#FFCC33'
const RED = '#ef4444'

const DISMISS_KEY = 'failed-banner-dismissed-ids-v1'

function loadDismissed(): Set<string> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(DISMISS_KEY) : null
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveDismissed(set: Set<string>) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(set)))
  } catch {}
}

export default function FailedDeliveryBanner() {
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed())
  const [expanded, setExpanded] = useState(false)

  const { data } = useQuery<FailedPayload>({
    queryKey: ['messages', 'failed-recent'],
    queryFn: async () => {
      const res = await fetch('/api/messages/failed-recent', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as FailedPayload
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const visible = (data?.items ?? []).filter((it) => !dismissed.has(it.id))
  if (visible.length === 0) return null

  const dismissAll = () => {
    const next = new Set(dismissed)
    visible.forEach((it) => next.add(it.id))
    setDismissed(next)
    saveDismissed(next)
  }

  return (
    <div
      style={{
        background: `linear-gradient(90deg, rgba(239, 68, 68, 0.30) 0%, ${NAVY} 50%)`,
        borderBottom: `1px solid ${RED}`,
        color: '#fff',
        fontFamily: 'inherit',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 16px' }}>
        <div style={{ fontSize: 16, flexShrink: 0 }}>⚠</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: '0.04em' }}>
            {visible.length} {visible.length === 1 ? 'message' : 'messages'} failed in the last 30 min
          </div>
          {!expanded && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {visible[0].body ? `"${visible[0].body.slice(0, 80)}"` : '(no body)'}
              {visible.length > 1 && <span style={{ color: GOLD }}> · +{visible.length - 1} more</span>}
            </div>
          )}
        </div>
        <button type="button" onClick={() => setExpanded((v) => !v)} style={btnSubtle}>
          {expanded ? 'Hide' : 'Details'}
        </button>
        <button type="button" onClick={dismissAll} style={btnSubtle} title="Dismiss all (will not return for these messages)">
          ✕
        </button>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid rgba(239, 68, 68, 0.4)`, padding: '8px 16px 12px', maxHeight: 240, overflowY: 'auto' }}>
          {visible.map((it) => (
            <div
              key={it.id}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'baseline',
                padding: '6px 0',
                borderBottom: `1px solid rgba(255,255,255,0.08)`,
                fontSize: 12,
              }}
            >
              <span style={{ color: RED, fontWeight: 700, minWidth: 88 }}>
                {it.status === 'QuotaExceeded' ? 'Quota' : 'Failed'}
              </span>
              <span style={{ color: GOLD, opacity: 0.8, minWidth: 36 }}>
                {it.panel || it.channel_type || '—'}
              </span>
              <span style={{ flex: 1, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {it.body ? it.body.slice(0, 140) : '(no body)'}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
                {it.sent_at ? new Date(it.sent_at).toLocaleTimeString() : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const btnSubtle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.25)',
  color: 'rgba(255,255,255,0.85)',
  padding: '4px 10px',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '0.06em',
  flexShrink: 0,
}
