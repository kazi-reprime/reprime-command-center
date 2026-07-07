'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatPhoneDisplay } from '@/lib/timelines/parse'
import type { DashboardThread, Panel } from '@/lib/timelines/types'
import { useToast } from '@/lib/contexts/ToastContext'

/** Extract initials from a name, falling back to first char of phone */
function initials(name: string | null | undefined, phone?: string): string {
  if (name) {
    return name.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
  }
  return phone ? phone.slice(-2) : '??'
}

/** Format a timestamp as a relative time string (e.g., "2h", "3d") */
function relativeTime(ts: string | null | undefined): string {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return `${Math.floor(days / 7)}w`
}

/** Truncate a string to a max length, appending "…" if truncated */
function truncate(text: string | null | undefined, maxLen: number): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

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

export default function ChatList({ panel, selectedThreadId, onSelect, hideInvestors = false }: Props) {
  const queryClient = useQueryClient()
  const { addToast } = useToast()
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
        background: '#fff',
        color: 'var(--text-main)',
        minWidth: 280,
      }}
    >
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface-soft)' }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, opacity: 0.5 }}>🔍</span>
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: '#fff',
              color: 'var(--text-main)',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 10,
              padding: '8px 12px 8px 32px',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            style={{
              background: '#fff',
              color: 'var(--text-main)',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 8,
              padding: '6px 10px',
              fontFamily: 'inherit',
              fontSize: 11,
              fontWeight: 700,
              outline: 'none',
              boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
            }}
          >
            <option value="recent">Recent Activity</option>
            <option value="unread">Unread First</option>
          </select>
          <div style={{ display: 'flex', gap: 2, marginLeft: 'auto', background: 'rgba(0,0,0,0.04)', borderRadius: 10, padding: 2 }}>
            {(['direct', 'groups', 'all'] as FilterMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setFilter(m)}
                style={{
                  background: filter === m ? '#fff' : 'transparent',
                  color: filter === m ? 'var(--text-main)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '4px 10px',
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  boxShadow: filter === m ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 200ms',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
        {isLoading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>Syncing...</div>
        )}
        {error && (
          <div style={{ padding: '1rem', color: 'var(--status-error)', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
            Connection error.{' '}
            <button onClick={() => refetch()} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontWeight: 800, textDecoration: 'underline' }}>
              Retry
            </button>
          </div>
        )}
        {!isLoading && threads.length === 0 && !error && (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
            No conversations found.
          </div>
        )}
        {threads.map((t) => {
          const isSelected = t.id === selectedThreadId
          const formattedPhone = formatPhoneDisplay(t.phone)
          const nameIsDigits = !t.contact_name || /^\+?\d[\d\s\-()]*$/.test(t.contact_name.trim())
          const displayName = nameIsDigits ? (formattedPhone || t.phone) : t.contact_name!
          const hasUnread = t.unread_count > 0
          
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
                gap: 12,
                padding: '12px 16px',
                border: 'none',
                borderLeft: isSelected ? '4px solid var(--accent-blue)' : hasUnread ? '4px solid var(--status-error)' : '4px solid transparent',
                background: isSelected ? 'var(--surface-soft)' : 'transparent',
                color: 'var(--text-main)',
                cursor: 'pointer',
                textAlign: 'left',
                borderBottom: '1px solid rgba(0,0,0,0.03)',
                fontFamily: 'inherit',
                position: 'relative',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
              onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = 'transparent')}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  background: t.channel_type === 'whatsapp' ? '#25D366' : t.channel_type === 'imessage' ? '#0A84FF' : '#FF9500',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              >
                {initials(t.contact_name, t.phone)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontWeight: hasUnread ? 800 : 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                    {displayName}
                    {t.is_investor && (
                      <span style={{ marginLeft: 6, color: 'var(--accent-purple)', fontSize: 10 }}>★</span>
                    )}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, fontWeight: 600 }}>
                    {relativeTime(t.last_message_at)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {truncate(t.last_message_preview, 45)}
                  </span>
                  {hasUnread && (
                    <span
                      style={{
                        background: 'var(--status-error)',
                        color: '#fff',
                        borderRadius: 8,
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 6px',
                        flexShrink: 0,
                        boxShadow: '0 4px 10px rgba(239, 68, 68, 0.25)',
                      }}
                    >
                      {t.unread_count}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setConfirmBlock(t) }}
                className="rp-thread-block-btn"
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: 'var(--status-error)',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'none',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  transition: 'all 200ms',
                }}
              >
                🚫
              </button>
            </div>
          )
        })}
      </div>

      <style jsx>{`
        :global(.rp-thread-row):hover :global(.rp-thread-block-btn) {
          display: flex !important;
        }
        :global(.rp-thread-block-btn):hover {
          background: var(--status-error) !important;
          color: #fff !important;
        }
      `}</style>

      {confirmBlock && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmBlock(null) }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9000,
            padding: '1.5rem',
          }}
        >
          <div style={{
            background: '#fff',
            borderRadius: 24,
            padding: '2rem',
            maxWidth: 400,
            width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>Block Contact?</h3>
            <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)', fontWeight: 500 }}>
              This will block <strong style={{ color: 'var(--text-main)' }}>{confirmBlock.contact_name || confirmBlock.phone}</strong> across all channels.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => setConfirmBlock(null)}
                style={{
                  flex: 1, background: 'var(--surface-soft)', border: 'none', borderRadius: 12,
                  padding: '12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--text-main)',
                }}
              >Cancel</button>
              <button
                onClick={async () => {
                  setBlockingId(confirmBlock.id)
                  try {
                    await blockThread(confirmBlock)
                    queryClient.invalidateQueries({ queryKey: ['threads', panel] })
                    setConfirmBlock(null)
                  } catch (err) {
                    addToast(`Block failed: ${(err as Error).message}`, 'error')
                  } finally {
                    setBlockingId(null)
                  }
                }}
                style={{
                  flex: 1, background: 'var(--status-error)', border: 'none', borderRadius: 12,
                  padding: '12px', fontSize: 13, fontWeight: 800, cursor: 'pointer', color: '#fff',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
                }}
              >{blockingId ? 'Blocking...' : 'Block'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
