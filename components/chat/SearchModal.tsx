'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatPhoneDisplay } from '@/lib/timelines/parse'
import type { DashboardThread, Panel } from '@/lib/timelines/types'

type Props = {
  open: boolean
  onClose: () => void
  /** Called when user clicks a result. Caller decides how to navigate. */
  onSelect: (thread: DashboardThread) => void
  /** Optional initial query — used when opened from voice ("search bay valley"). */
  initialQuery?: string
}

const NAVY = '#0E3470'
const GOLD = '#FFCC33'
const TEXT = '#F5EFD8'
const MUTED = '#8C8771'

async function fetchPanel(panel: Panel): Promise<DashboardThread[]> {
  const res = await fetch(`/api/whatsapp/threads?panel=${panel}`, { cache: 'no-store' })
  if (!res.ok) return []
  const json = (await res.json()) as { threads: DashboardThread[] }
  return json.threads ?? []
}

async function fetchInvestors(): Promise<DashboardThread[]> {
  const res = await fetch('/api/whatsapp/investor-chat-threads', { cache: 'no-store' })
  if (!res.ok) return []
  const json = (await res.json()) as { threads: DashboardThread[] }
  return json.threads ?? []
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function avatarColor(t: DashboardThread): string {
  if (t.unread_count > 0) return '#ef4444'
  if (t.channel_type === 'whatsapp' && t.panel === '305') return '#F0B400'
  if (t.channel_type === 'whatsapp') return '#25D366'
  if (t.channel_type === 'imessage') return '#0A84FF'
  if (t.channel_type === 'sms') return '#FF9500'
  return GOLD
}

function avatarLabel(t: DashboardThread): string {
  if (t.channel_type === 'whatsapp' && t.panel === '305') return '305'
  if (t.channel_type === 'whatsapp') return '718'
  if (t.channel_type === 'imessage') return 'iM'
  if (t.channel_type === 'sms') return 'SMS'
  return ''
}

export default function SearchModal({ open, onClose, onSelect, initialQuery = '' }: Props) {
  const [q, setQ] = useState(initialQuery)

  useEffect(() => {
    if (open) setQ(initialQuery)
  }, [open, initialQuery])

  // Fetch all sources only when modal is open — saves bandwidth
  const { data: threads305 = [] } = useQuery({
    queryKey: ['threads', '305'],
    queryFn: () => fetchPanel('305'),
    enabled: open,
    staleTime: 30_000,
  })
  const { data: threads718 = [] } = useQuery({
    queryKey: ['threads', '718'],
    queryFn: () => fetchPanel('718'),
    enabled: open,
    staleTime: 30_000,
  })
  const { data: threadsInv = [] } = useQuery({
    queryKey: ['investor-chat-threads'],
    queryFn: fetchInvestors,
    enabled: open,
    staleTime: 30_000,
  })

  // Combine + dedupe by id
  const all = useMemo<DashboardThread[]>(() => {
    const seen = new Set<string>()
    const merged: DashboardThread[] = []
    for (const t of [...threads305, ...threads718, ...threadsInv]) {
      if (!seen.has(t.id)) {
        seen.add(t.id)
        merged.push(t)
      }
    }
    return merged
  }, [threads305, threads718, threadsInv])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) {
      return [...all]
        .sort((a, b) => {
          const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
          const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
          return tb - ta
        })
        .slice(0, 30)
    }
    const filtered = all.filter((t) => {
      const name = (t.contact_name || '').toLowerCase()
      const phone = (t.phone || '').toLowerCase()
      const preview = (t.last_message_preview || '').toLowerCase()
      return name.includes(term) || phone.includes(term) || preview.includes(term)
    })
    return filtered.slice(0, 50)
  }, [all, q])

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(7, 16, 30, 0.75)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 9000,
        padding: '8vh 1rem 1rem',
      }}
    >
      <div style={{
        background: NAVY,
        border: `1px solid ${GOLD}55`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        width: '100%',
        maxWidth: 720,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${GOLD}33`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <input
            autoFocus
            type="text"
            placeholder="Search by name, phone, or last message…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 0,
              color: TEXT,
              fontSize: 15,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: `1px solid ${GOLD}55`,
              color: GOLD,
              padding: '4px 10px',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '0.10em',
            }}
          >
            ESC
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {results.length === 0 && (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: MUTED, fontSize: 13 }}>
              {q.trim() ? 'No matches.' : 'Start typing to search across 305, 718, and Investors.'}
            </div>
          )}
          {results.map((t) => {
            const name = t.contact_name || formatPhoneDisplay(t.phone) || t.phone
            const phoneDisplay = formatPhoneDisplay(t.phone)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { onSelect(t); onClose() }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 18px',
                  border: 0,
                  background: 'transparent',
                  color: TEXT,
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderBottom: `1px solid ${GOLD}11`,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${GOLD}0A` }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: avatarColor(t),
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                  flexShrink: 0,
                }}>
                  {avatarLabel(t)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: t.unread_count > 0 ? '#fff' : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                      {t.is_investor && <span style={{ color: GOLD, marginLeft: 6 }}>★</span>}
                    </span>
                    <span style={{ fontSize: 11, color: MUTED, flexShrink: 0 }}>
                      {relativeTime(t.last_message_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {phoneDisplay && phoneDisplay !== name ? `${phoneDisplay} · ` : ''}
                    {t.last_message_preview || '(no preview)'}
                  </div>
                </div>
                <span style={{
                  fontSize: 9, letterSpacing: '0.10em', color: GOLD, opacity: 0.7,
                  border: `0.5px solid ${GOLD}55`, padding: '2px 6px',
                  flexShrink: 0,
                }}>
                  {t.is_investor ? 'INVEST' : t.panel}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ padding: '8px 18px', borderTop: `1px solid ${GOLD}22`, fontSize: 10, color: MUTED, letterSpacing: '0.06em', display: 'flex', justifyContent: 'space-between' }}>
          <span>{results.length} {results.length === 1 ? 'result' : 'results'}</span>
          <span>Click to open · ESC to close</span>
        </div>
      </div>
    </div>
  )
}
