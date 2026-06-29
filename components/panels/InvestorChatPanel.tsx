'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatPhoneDisplay } from '@/lib/timelines/parse'
import MessageView from '@/components/chat/MessageView'
import ReplyBox from '@/components/chat/ReplyBox'
import InvestorProfile, { profileFromThread } from '@/components/panels/InvestorProfile'
import type { DashboardMessage, DashboardThread } from '@/lib/timelines/types'

// ── Theme ────────────────────────────────────────────────────────────────────
const NAVY   = '#0E3470'
const SURFACE = 'rgba(14, 52, 112, 0.85)'
const GOLD   = '#FFCC33'
const GOLD_LITE = '#FFCC33'
const BORDER = 'rgba(255, 204, 51,0.25)'
const TEXT   = '#F5EFD8'
const MUTED  = '#8C8771'
const SELECTED_BG = 'rgba(255, 204, 51,0.12)'

// ── Helpers ──────────────────────────────────────────────────────────────────
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

// ── Component ────────────────────────────────────────────────────────────────
type TierFilter = 'all' | 'A' | 'B' | 'C' | 'D'
type RoleFilter = 'both' | 'principal' | 'connector'

export default function InvestorChatPanel() {
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createClient(), [])
  const [selected, setSelected] = useState<DashboardThread | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('both')
  const prevSelectedId = useRef<string | null>(null)

  // ── Thread list ────────────────────────────────────────────────────────────
  const { data: threadsData, isLoading, error, refetch } = useQuery({
    queryKey: ['investor-chat-threads'],
    queryFn: async (): Promise<DashboardThread[]> => {
      const res = await fetch('/api/whatsapp/investor-chat-threads', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { threads: DashboardThread[] }
      return json.threads
    },
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })

  // ── Messages for selected thread ───────────────────────────────────────────
  const { data: messages } = useQuery({
    queryKey: ['messages', selected?.id],
    enabled: !!selected,
    queryFn: async (): Promise<DashboardMessage[]> => {
      if (!selected) return []
      const res = await fetch(`/api/whatsapp/messages?thread_id=${selected.id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { messages: DashboardMessage[] }
      return json.messages
    },
    refetchOnWindowFocus: false,
  })

  // ── Realtime: new messages ─────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('investor-chat:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        (payload: any) => {
          if (payload.new?.thread_id) {
            queryClient.invalidateQueries({ queryKey: ['messages', payload.new.thread_id] })
          }
          queryClient.invalidateQueries({ queryKey: ['investor-chat-threads'] })
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'thread_tags' },
        () => { queryClient.invalidateQueries({ queryKey: ['investor-chat-threads'] }) }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, queryClient])

  // Keep selected thread in sync when list refreshes
  useEffect(() => {
    if (!selected || !threadsData) return
    const fresh = threadsData.find((t) => t.id === selected.id)
    if (fresh && fresh !== selected) setSelected(fresh)
  }, [threadsData, selected])

  // Allow other parts of the dashboard (Search, Briefing) to open an investor
  // thread by dispatching a window event with { detail: { threadId } }.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ threadId?: string }>
      const id = ce.detail?.threadId
      if (!id || !threadsData) return
      const match = threadsData.find((t) => t.id === id)
      if (match) setSelected(match)
    }
    window.addEventListener('open-investor-thread', handler as EventListener)
    return () => window.removeEventListener('open-investor-thread', handler as EventListener)
  }, [threadsData])

  // Optimistic message append
  const onOptimistic = useCallback(
    (m: DashboardMessage) => {
      if (!selected) return
      queryClient.setQueryData<DashboardMessage[]>(['messages', selected.id], (prev) => [
        ...(prev || []),
        m,
      ])
    },
    [queryClient, selected]
  )

  const onStatus = useCallback(
    (tempId: string, status: 'ok' | 'fail', real?: DashboardMessage) => {
      if (!selected) return
      queryClient.setQueryData<DashboardMessage[]>(['messages', selected.id], (prev) => {
        if (!prev) return prev
        if (status === 'ok' && real) return prev.map((m) => (m.id === tempId ? real : m))
        return prev.map((m) => (m.id === tempId ? { ...m, status: 'Failed' } : m))
      })
      if (status === 'ok') {
        queryClient.invalidateQueries({ queryKey: ['investor-chat-threads'] })
      }
    },
    [queryClient, selected]
  )

  // Per-tier counts (computed across all data, not the filtered subset, so
  // chip labels stay stable as the user toggles filters)
  const counts = useMemo(() => {
    const all = threadsData || []
    const matchRole = (t: DashboardThread) =>
      roleFilter === 'both' || t.investor_role === roleFilter
    return {
      total: all.filter(matchRole).length,
      A: all.filter((t) => t.investor_tier === 'A' && matchRole(t)).length,
      B: all.filter((t) => t.investor_tier === 'B' && matchRole(t)).length,
      C: all.filter((t) => t.investor_tier === 'C' && matchRole(t)).length,
      D: all.filter((t) => t.investor_tier === 'D' && matchRole(t)).length,
      untiered: all.filter((t) => !t.investor_tier && matchRole(t)).length,
    }
  }, [threadsData, roleFilter])

  // Filtered thread list (search + tier + role)
  const threads = useMemo<DashboardThread[]>(() => {
    let list = threadsData || []
    if (tierFilter !== 'all') {
      list = list.filter((t) => t.investor_tier === tierFilter)
    }
    if (roleFilter !== 'both') {
      list = list.filter((t) => t.investor_role === roleFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          (t.contact_name || '').toLowerCase().includes(q) ||
          (t.phone || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [threadsData, search, tierFilter, roleFilter])

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: NAVY,
        color: TEXT,
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: `2px solid ${GOLD}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <h1 style={{ color: GOLD, fontWeight: 700, fontSize: '1.1rem', margin: 0, letterSpacing: '0.03em' }}>
          ★ Investors
        </h1>
        <span
          style={{
            background: GOLD,
            color: NAVY,
            borderRadius: 999,
            padding: '1px 8px',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {threads.length}
        </span>
        <span style={{ fontSize: 11, color: MUTED, marginLeft: 4 }}>718 + 305 combined</span>
      </div>

      {/* ── Body: list + conversation ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Thread list */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 280,
            flexShrink: 0,
            borderRight: `1px solid ${BORDER}`,
            minHeight: 0,
          }}
        >
          {/* Tier filter chips */}
          <div style={{ padding: '0.6rem 0.75rem 0.4rem', borderBottom: `1px solid ${BORDER}`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(['all', 'A', 'B', 'C', 'D'] as TierFilter[]).map((tier) => {
                const active = tierFilter === tier
                const count = tier === 'all' ? counts.total : counts[tier]
                const label = tier === 'all' ? 'All' : tier
                return (
                  <button
                    key={tier}
                    onClick={() => setTierFilter(tier)}
                    style={{
                      background: active ? GOLD : 'transparent',
                      color: active ? NAVY : GOLD,
                      border: `1px solid ${active ? GOLD : BORDER}`,
                      borderRadius: 14,
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    title={`${label} tier — ${count} investor${count === 1 ? '' : 's'}${roleFilter !== 'both' ? ` (${roleFilter}s only)` : ''}`}
                  >
                    <span>{label}</span>
                    <span style={{
                      background: active ? 'rgba(14,52,112,0.15)' : 'rgba(255,204,51,0.18)',
                      color: active ? NAVY : GOLD,
                      borderRadius: 8,
                      padding: '0 6px',
                      fontSize: 10,
                      fontWeight: 800,
                      minWidth: 16,
                      textAlign: 'center',
                    }}>{count}</span>
                  </button>
                )
              })}
            </div>
            {/* Role toggle */}
            <div style={{ display: 'flex', gap: 4, background: SURFACE, borderRadius: 999, padding: 2, alignSelf: 'flex-start' }}>
              {(['both', 'principal', 'connector'] as RoleFilter[]).map((role) => {
                const active = roleFilter === role
                return (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role)}
                    style={{
                      background: active ? GOLD : 'transparent',
                      color: active ? NAVY : MUTED,
                      border: 'none',
                      borderRadius: 999,
                      padding: '3px 10px',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textTransform: 'uppercase',
                    }}
                  >
                    {role === 'both' ? 'Both' : role === 'principal' ? 'Principal' : 'Connector'}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: '0.6rem 0.75rem', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
            <input
              type="text"
              placeholder="Search investor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                background: SURFACE,
                color: TEXT,
                border: `1px solid ${BORDER}`,
                borderRadius: 6,
                padding: '0.4rem 0.6rem',
                fontFamily: 'inherit',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Thread rows */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {isLoading && (
              <div style={{ padding: '1rem', color: MUTED, fontSize: 13 }}>Loading investors…</div>
            )}
            {error && (
              <div style={{ padding: '1rem', color: '#FF7474', fontSize: 13 }}>
                Error.{' '}
                <button
                  onClick={() => refetch()}
                  style={{ background: 'none', border: 'none', color: GOLD, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}
                >
                  Retry
                </button>
              </div>
            )}
            {!isLoading && !error && threads.length === 0 && (
              <div style={{ padding: '1rem', color: MUTED, fontSize: 13 }}>
                No investor-tagged contacts yet.
                <br />
                <span style={{ fontSize: 11 }}>Tag a contact with &ldquo;investor&rdquo; from the main panels to add them here.</span>
              </div>
            )}
            {threads.map((t) => {
              const isSelected = t.id === selected?.id
              const hasUnread = t.unread_count > 0
              const isPriority = !!t.is_priority
              const formattedPhone = formatPhoneDisplay(t.phone)
              const nameIsDigits = !t.contact_name || /^\+?\d[\d\s\-()]*$/.test(t.contact_name.trim())
              const displayName = nameIsDigits ? (formattedPhone || t.phone) : t.contact_name!
              const leftBorder = isSelected
                ? `3px solid ${GOLD}`
                : hasUnread
                ? '3px solid #ef4444'
                : isPriority
                ? `3px solid ${GOLD}`
                : '3px solid transparent'
              const rowBg = isSelected
                ? SELECTED_BG
                : hasUnread
                ? 'rgba(239,68,68,0.07)'
                : isPriority
                ? 'rgba(255, 204, 51,0.06)'
                : 'transparent'
              return (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '0.6rem 0.75rem',
                    border: 'none',
                    background: rowBg,
                    color: TEXT,
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderBottom: `1px solid ${BORDER}`,
                    borderLeft: leftBorder,
                    fontFamily: 'inherit',
                  }}
                >
                  {/* Avatar — channel-colored circle with line label so 305 vs 718 are distinct */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: isSelected
                        ? GOLD
                        : hasUnread
                        ? '#ef4444'
                        : t.channel_type === 'whatsapp' && t.panel === '305'
                        ? '#F0B400' // WhatsApp 305 — amber (RePrime, spam-prone)
                        : t.channel_type === 'whatsapp'
                        ? '#25D366' // WhatsApp 718 — green (personal)
                        : t.channel_type === 'imessage'
                        ? '#0A84FF'
                        : t.channel_type === 'sms'
                        ? '#FF9500'
                        : 'rgba(255, 204, 51, 0.2)',
                      color: isSelected ? NAVY : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: t.channel_type === 'sms' ? 11 : 12,
                      fontWeight: 800,
                      flexShrink: 0,
                      letterSpacing: '0.04em',
                      border: `1px solid ${hasUnread ? 'rgba(239,68,68,0.5)' : BORDER}`,
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontWeight: hasUnread ? 800 : 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isSelected ? GOLD_LITE : hasUnread ? '#fff' : TEXT }}>
                        {displayName}
                        {isPriority && (
                          <span style={{ marginLeft: 5, fontSize: 11, color: hasUnread ? '#fca5a5' : GOLD }} title="AI-flagged: important">⚡</span>
                        )}
                      </span>
                      <span style={{ fontSize: 10, color: hasUnread ? '#fca5a5' : MUTED, flexShrink: 0, fontWeight: hasUnread ? 600 : 400 }}>
                        {relativeTime(t.last_message_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: hasUnread ? 'rgba(255,255,255,0.7)' : MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: hasUnread ? 'italic' : 'normal' }}>
                        {truncate(t.last_message_preview, 36)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {/* Panel badge */}
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: t.panel === '718' ? 'rgba(99,102,241,0.25)' : 'rgba(255, 204, 51,0.2)',
                            color: t.panel === '718' ? '#a5b4fc' : GOLD_LITE,
                            border: `1px solid ${t.panel === '718' ? 'rgba(99,102,241,0.35)' : BORDER}`,
                            letterSpacing: '0.03em',
                          }}
                        >
                          {t.panel === '718' ? '718' : '305'}
                        </span>
                        {hasUnread && (
                          <span
                            style={{
                              background: '#ef4444',
                              color: '#fff',
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 6px',
                              boxShadow: '0 0 0 2px rgba(239,68,68,0.3)',
                            }}
                          >
                            {t.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Conversation area */}
        {selected ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '0.5rem 1rem 0', background: NAVY, flexShrink: 0 }}>
              {/* Contact header row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 2,
                  paddingLeft: 2,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: GOLD, lineHeight: 1.2 }}>
                    ★{' '}
                    {(() => {
                      const nameIsDigits =
                        !selected.contact_name ||
                        /^\+?\d[\d\s\-()]*$/.test(selected.contact_name.trim())
                      return nameIsDigits
                        ? selected.phone
                        : selected.contact_name
                    })()}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED }}>
                    Sending via{' '}
                    <span
                      style={{
                        color: selected.panel === '718' ? '#a5b4fc' : GOLD_LITE,
                        fontWeight: 600,
                      }}
                    >
                      {selected.panel === '718' ? '+1 (718) 550-5500' : '+1 (305) 778-4861'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setProfileOpen(true)}
                  style={{
                    background: GOLD,
                    color: NAVY,
                    border: 'none',
                    padding: '8px 14px',
                    fontFamily: 'inherit',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  ★ Open Profile
                </button>
              </div>
              <ReplyBox
                panel={selected.panel}
                threadId={selected.id}
                threadHistory={messages || []}
                contact={{ name: selected.contact_name, phone: selected.phone }}
                onOptimistic={onOptimistic}
                onStatus={onStatus}
              />
            </div>
            <MessageView thread={selected} messages={messages || []} />
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 12,
              color: MUTED,
              fontSize: 13,
            }}
          >
            <span style={{ fontSize: 32 }}>★</span>
            <span>Select an investor to start a conversation.</span>
            <span style={{ fontSize: 11, maxWidth: 260, textAlign: 'center', lineHeight: 1.5 }}>
              Tag any contact as &ldquo;investor&rdquo; from the 718 or 305 panels — they will appear here automatically.
            </span>
          </div>
        )}
      </div>

      {profileOpen && selected && (
        <InvestorProfile
          data={profileFromThread({
            contact_name: selected.contact_name,
            phone: selected.phone,
            pipedrive_contact_id: selected.pipedrive_contact_id,
            investor_tier: selected.investor_tier ?? null,
            investor_role: selected.investor_role ?? null,
          })}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  )
}
