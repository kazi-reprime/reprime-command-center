'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatPhoneDisplay } from '@/lib/timelines/parse'
import type { DashboardThread, Panel } from '@/lib/timelines/types'

async function blockThread(thread: DashboardThread): Promise<void> {
  const res = await fetch('/api/contacts/block', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ thread_id: thread.id, reason: 'spam_block_button' }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || data.error || `HTTP ${res.status}`)
  }
}

type Props = {
  panel: Panel
  selectedThreadId: string | null
  onSelect: (thread: DashboardThread) => void
  /** When true, investor-tagged threads are hidden from this panel (they live in the Investors panel) */
  hideInvestors?: boolean
}

type SortMode = 'recent' | 'unread'
type FilterMode = 'direct' | 'groups' | 'all'

const PANEL_THEME = {
  '718': {
    bg: 'var(--personal-bg)',
    surface: 'var(--personal-surface)',
    border: 'var(--personal-border)',
    text: 'var(--personal-text)',
    muted: 'var(--personal-muted)',
    accent: 'var(--personal-accent)',
    selected: 'var(--personal-warm)',
    inputBg: '#fff',
  },
  '305': {
    bg: 'var(--rp-navy)',
    surface: 'var(--rp-surface)',
    border: 'var(--rp-border)',
    text: 'var(--rp-white)',
    muted: 'var(--rp-gold-lite)',
    accent: 'var(--rp-gold)',
    selected: 'var(--rp-blue)',
    inputBg: 'var(--rp-surface)',
  },
} as const

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

function initials(name: string | null, phone: string): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/).slice(0, 2)
    return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '#'
  }
  return phone.replace(/\D/g, '').slice(-2) || '#'
}

function truncate(s: string | null, n: number): string {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export default function ChatList({ panel, selectedThreadId, onSelect, hideInvestors = false }: Props) {
  const theme = PANEL_THEME[panel]
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('recent')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [blockingId, setBlockingId] = useState<string | null>(null)
  const [confirmBlock, setConfirmBlock] = useState<DashboardThread | null>(null)

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['threads', panel],
    queryFn: async (): Promise<DashboardThread[]> => {
      const res = await fetch(`/api/whatsapp/threads?panel=${panel}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { threads: DashboardThread[] }
      return json.threads
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })

  const threads = useMemo<DashboardThread[]>(() => {
    let list = data || []
    // Remove investor-tagged contacts from 718/305 panels — they live in the Investors panel
    if (hideInvestors) {
      list = list.filter((t) => !t.is_investor)
    }
    if (filter === 'direct') {
      list = list.filter((t) => !t.is_group)
    } else if (filter === 'groups') {
      list = list.filter((t) => t.is_group)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          (t.contact_name || '').toLowerCase().includes(q) ||
          (t.phone || '').toLowerCase().includes(q)
      )
    }
    if (sort === 'unread') {
      list = [...list].sort((a, b) => {
        const ua = a.unread_count || 0
        const ub = b.unread_count || 0
        if (ub !== ua) return ub - ua
        const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
        const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
        return tb - ta
      })
    }
    return list
  }, [data, filter, search, sort, hideInvestors])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: theme.bg,
        color: theme.text,
        borderRight: `1px solid ${theme.border}`,
        minWidth: 280,
        maxWidth: 360,
      }}
    >
      <div style={{ padding: '0.75rem', borderBottom: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="text"
          placeholder="Search name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: theme.inputBg,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: 6,
            padding: '0.4rem 0.6rem',
            fontFamily: 'inherit',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            style={{
              background: theme.inputBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: 6,
              padding: '0.3rem 0.4rem',
              fontFamily: 'inherit',
              fontSize: 12,
            }}
          >
            <option value="recent">Last activity</option>
            <option value="unread">Unread first</option>
          </select>
          <div style={{ display: 'flex', gap: 2, marginLeft: 'auto', background: theme.surface, borderRadius: 999, padding: 2 }}>
            {(['direct', 'groups', 'all'] as FilterMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setFilter(m)}
                style={{
                  background: filter === m ? theme.accent : 'transparent',
                  color: filter === m ? (panel === '305' ? 'var(--rp-navy)' : '#fff') : theme.muted,
                  border: 'none',
                  borderRadius: 999,
                  padding: '0.2rem 0.6rem',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading && (
          <div style={{ padding: '1rem', color: theme.muted, fontSize: 13 }}>Loading threads…</div>
        )}
        {error && (
          <div style={{ padding: '1rem', color: '#FF7474', fontSize: 13 }}>
            Error loading threads.{' '}
            <button onClick={() => refetch()} style={{ background: 'none', border: 'none', color: theme.accent, cursor: 'pointer', textDecoration: 'underline' }}>
              Retry
            </button>
          </div>
        )}
        {!isLoading && threads.length === 0 && !error && (
          <div style={{ padding: '1rem', color: theme.muted, fontSize: 13 }}>
            No conversations.
            {hideInvestors && (
              <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.5 }}>
                Investor-tagged contacts appear in the <strong style={{ color: theme.accent }}>★ Investors</strong> panel on the right.
              </div>
            )}
          </div>
        )}
        {threads.map((t) => {
          const isSelected = t.id === selectedThreadId
          const formattedPhone = formatPhoneDisplay(t.phone)
          const nameIsDigits = !t.contact_name || /^\+?\d[\d\s\-()]*$/.test(t.contact_name.trim())
          const displayName = nameIsDigits ? (formattedPhone || t.phone) : t.contact_name!
          const showPhoneLine = !nameIsDigits && formattedPhone && formattedPhone !== displayName
          const hasUnread = t.unread_count > 0
          const isPriority = !!t.is_priority
          const leftBorder = hasUnread
            ? '3px solid #ef4444'
            : isPriority
            ? '3px solid #FFCC33'
            : '3px solid transparent'
          const rowBg = isSelected
            ? theme.selected
            : hasUnread
            ? 'rgba(239,68,68,0.07)'
            : isPriority
            ? 'rgba(255, 204, 51,0.06)'
            : 'transparent'
          return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(t)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(t) } }}
              className="rp-thread-row"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0.6rem 0.75rem',
                border: 'none',
                borderLeft: leftBorder,
                background: rowBg,
                color: theme.text,
                cursor: 'pointer',
                textAlign: 'left',
                borderBottom: `1px solid ${theme.border}`,
                fontFamily: 'inherit',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: hasUnread
                    ? '#ef4444'
                    : t.channel_type === 'whatsapp' && t.panel === '305'
                    ? '#F0B400' // WhatsApp 305 — warm amber (RePrime corporate, spam-prone)
                    : t.channel_type === 'whatsapp'
                    ? '#25D366' // WhatsApp 718 — brand green (personal)
                    : t.channel_type === 'imessage'
                    ? '#0A84FF' // Apple iMessage blue
                    : t.channel_type === 'sms'
                    ? '#FF9500' // Orange — SMS / plain text
                    : theme.accent,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: t.channel_type === 'sms' ? 11 : 12,
                  fontWeight: 800,
                  flexShrink: 0,
                  letterSpacing: '0.04em',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                }}
                title={
                  t.channel_type === 'whatsapp' && t.panel === '305'
                    ? 'WhatsApp 305 (RePrime)'
                    : t.channel_type === 'whatsapp'
                    ? 'WhatsApp 718 (personal)'
                    : t.channel_type === 'imessage'
                    ? 'iMessage (via cloud Mac)'
                    : t.channel_type === 'sms'
                    ? 'SMS / text message'
                    : t.channel_type
                }
              >
                {t.channel_type === 'whatsapp' && t.panel === '305'
                  ? '305'
                  : t.channel_type === 'whatsapp'
                  ? '718'
                  : t.channel_type === 'imessage'
                  ? 'iM'
                  : t.channel_type === 'sms'
                  ? 'SMS'
                  : initials(t.contact_name, t.phone)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontWeight: hasUnread ? 800 : 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: hasUnread ? '#fff' : theme.text }}>
                    {displayName}
                    {t.is_investor && (
                      <span style={{ marginLeft: 6, color: theme.accent, fontSize: 11 }}>★</span>
                    )}
                    {isPriority && !hasUnread && (
                      <span style={{ marginLeft: 5, fontSize: 11, color: '#FFCC33' }} title="AI-flagged: important">⚡</span>
                    )}
                    {isPriority && hasUnread && (
                      <span style={{ marginLeft: 5, fontSize: 11, color: '#fca5a5' }} title="AI-flagged: important">⚡</span>
                    )}
                  </span>
                  <span style={{ fontSize: 11, color: hasUnread ? '#fca5a5' : theme.muted, flexShrink: 0, fontWeight: hasUnread ? 600 : 400 }}>
                    {relativeTime(t.last_message_at)}
                  </span>
                </div>
                {showPhoneLine && (
                  <div style={{ fontSize: 11, color: theme.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formattedPhone}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: hasUnread ? 'rgba(255,255,255,0.7)' : theme.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: hasUnread ? 'italic' : 'normal' }}>
                    {truncate(t.last_message_preview, 40)}
                  </span>
                  {hasUnread && (
                    <span
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 7px',
                        flexShrink: 0,
                        boxShadow: '0 0 0 2px rgba(239,68,68,0.3)',
                      }}
                    >
                      {t.unread_count}
                    </span>
                  )}
                </div>
              </div>
              {/* Block button — appears on hover, click → confirm modal */}
              <button
                type="button"
                aria-label={`Block ${t.contact_name || t.phone}`}
                title="Block this contact across all channels"
                onClick={(e) => { e.stopPropagation(); setConfirmBlock(t) }}
                className="rp-thread-block-btn"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: 'rgba(239, 68, 68, 0.10)',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  color: '#FF7474',
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'none',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'inherit',
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                🚫
              </button>
            </div>
          )
        })}
      </div>
      {isFetching && !isLoading && (
        <div style={{ padding: '0.3rem 0.75rem', fontSize: 11, color: theme.muted, borderTop: `1px solid ${theme.border}` }}>
          Refreshing…
        </div>
      )}

      {/* Hover styles for the block button — hidden by default, shown on row hover */}
      <style jsx>{`
        :global(.rp-thread-row):hover :global(.rp-thread-block-btn) {
          display: flex !important;
        }
        :global(.rp-thread-block-btn):hover {
          background: rgba(239, 68, 68, 0.20) !important;
          border-color: #FF7474 !important;
        }
      `}</style>

      {/* Block confirmation modal */}
      {confirmBlock && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmBlock(null) }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7, 16, 30, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9000,
            padding: '1rem',
          }}
        >
          <div style={{
            background: '#0E3470',
            border: '1px solid rgba(255, 204, 51, 0.35)',
            padding: '24px 28px',
            maxWidth: 480,
            width: '100%',
            color: '#fff',
            fontFamily: 'inherit',
          }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#FFCC33', letterSpacing: '0.02em' }}>Block this contact?</h3>
            <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: '#F5EFD8' }}>
              <b style={{ color: '#FFCC33' }}>{confirmBlock.contact_name || confirmBlock.phone}</b> will be blocked
              <b> across every channel</b> — WhatsApp 305, WhatsApp 718, SMS, and email — for any matching Pipedrive
              contact ID, phone number, or email. They will not appear in any panel until you unblock.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button
                type="button"
                onClick={() => setConfirmBlock(null)}
                disabled={blockingId === confirmBlock.id}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 204, 51, 0.35)',
                  color: '#FFCC33',
                  padding: '8px 18px',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!confirmBlock) return
                  setBlockingId(confirmBlock.id)
                  try {
                    await blockThread(confirmBlock)
                    queryClient.invalidateQueries({ queryKey: ['threads', panel] })
                    queryClient.invalidateQueries({ queryKey: ['investor-chat-threads'] })
                    setConfirmBlock(null)
                  } catch (err) {
                    alert(`Block failed: ${(err as Error).message}`)
                  } finally {
                    setBlockingId(null)
                  }
                }}
                disabled={blockingId === confirmBlock.id}
                style={{
                  background: '#FF7474',
                  border: 0,
                  color: '#fff',
                  padding: '8px 18px',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  opacity: blockingId === confirmBlock.id ? 0.6 : 1,
                }}
              >
                {blockingId === confirmBlock.id ? 'Blocking…' : 'Block everywhere'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
