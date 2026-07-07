/* eslint-disable */
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatPhoneDisplay } from '@/lib/timelines/parse'
import MessageView from '@/components/chat/MessageView'
import ReplyBox from '@/components/chat/ReplyBox'
import InvestorProfile, { profileFromThread } from '@/components/panels/InvestorProfile'
import { Shield } from 'lucide-react'
import type { DashboardMessage, DashboardThread } from '@/lib/timelines/types'

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
        (payload: { new?: { thread_id?: string } }) => {
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

  // Allow other parts of the dashboard to open an investor thread
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

  const threads = useMemo<DashboardThread[]>(() => {
    let list = threadsData || []
    if (tierFilter !== 'all') list = list.filter((t) => t.investor_tier === tierFilter)
    if (roleFilter !== 'both') list = list.filter((t) => t.investor_role === roleFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t => (t.contact_name || '').toLowerCase().includes(q) || (t.phone || '').toLowerCase().includes(q))
    }
    return list
  }, [threadsData, search, tierFilter, roleFilter])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', color: '#1e293b', minWidth: 0, minHeight: 0, fontFamily: 'inherit' }}>
      {/* ── Header ── */}
      <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0, background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            <Shield size={20} />
          </div>
          <div>
            <h1 style={{ color: '#0f172a', fontWeight: 900, fontSize: '1.25rem', margin: 0, letterSpacing: '-0.03em' }}>Investor Syndicate</h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Secure Channel Protocol</p>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Realtime Active</span>
          </div>
        </div>
      </div>

      {/* ── Body: list + conversation ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Thread list */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 380, flexShrink: 0, borderRight: '1px solid rgba(0,0,0,0.05)', background: '#fff', minHeight: 0 }}>
          {/* Filters */}
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(['all', 'A', 'B', 'C', 'D'] as TierFilter[]).map((tier) => {
                const active = tierFilter === tier
                const count = tier === 'all' ? counts.total : counts[tier]
                return (
                  <button key={tier} onClick={() => setTierFilter(tier)} style={{
                    background: active ? '#0f172a' : '#f1f5f9',
                    color: active ? '#fff' : '#64748b',
                    border: 'none',
                    borderRadius: 12, padding: '6px 14px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', transition: 'all 200ms',
                    display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <span>{tier === 'all' ? 'All' : `Tier ${tier}`}</span>
                    <span style={{ opacity: 0.5 }}>{count}</span>
                  </button>
                )
              })}
            </div>
            
            <div style={{ position: 'relative' }}>
              <input type="text" placeholder="Search syndicate..." value={search} onChange={(e) => setSearch(e.target.value)} style={{
                width: '100%', background: '#f8fafc', color: '#0f172a', border: '1px solid rgba(0,0,0,0.03)', borderRadius: 16, padding: '0.75rem 1rem 0.75rem 2.5rem', fontSize: '0.9rem', fontWeight: 600, outline: 'none', transition: 'all 200ms'
              }} />
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>🔍</span>
            </div>
          </div>

          {/* Thread rows */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {isLoading && (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div style={{ width: 24, height: 24, border: '3px solid #f1f5f9', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                <p style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700 }}>Synchronizing Hub...</p>
              </div>
            )}
            {threads.map((t) => {
              const isSelected = t.id === selected?.id
              const hasUnread = t.unread_count > 0
              return (
                <button key={t.id} onClick={() => setSelected(t)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', border: 'none',
                  background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'transparent', borderRadius: 24, cursor: 'pointer', textAlign: 'left',
                  marginBottom: '0.5rem', transition: 'all 200ms',
                  position: 'relative'
                }}>
                  {isSelected && <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 4, background: '#3b82f6', borderRadius: '0 4px 4px 0' }} />}
                  <div style={{
                    width: 52, height: 52, borderRadius: 18,
                    background: t.panel === '305' ? '#f59e0b' : 
                                t.channel_type === 'whatsapp' ? '#10b981' :
                                t.channel_type === 'imessage' ? '#3b82f6' : '#8b5cf6',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 900, flexShrink: 0,
                    boxShadow: '0 8px 16px rgba(0,0,0,0.08)'
                  }}>
                    {t.panel === '305' ? '305' : t.panel === '718' ? '718' : initials(t.contact_name, t.phone)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontWeight: 900, fontSize: '0.95rem', color: isSelected ? '#3b82f6' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                        {t.contact_name || formatPhoneDisplay(t.phone)}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800 }}>{relativeTime(t.last_message_at)}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: isSelected ? '#64748b' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {t.last_message_preview || 'Protocol initiated'}
                    </div>
                  </div>
                  {hasUnread && <div style={{ width: 10, height: 10, background: '#ef4444', borderRadius: '50%', flexShrink: 0, boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)' }} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Conversation area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', minWidth: 0, minHeight: 0 }}>
          {selected ? (
            <>
              <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                   <div style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: '#f8fafc', border: '1px solid rgba(0,0,0,0.05)',
                    color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 900
                  }}>
                    {initials(selected.contact_name, selected.phone)}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>{selected.contact_name || formatPhoneDisplay(selected.phone)}</div>
                    <div style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Active {selected.channel_type} protocol</div>
                  </div>
                </div>
                <button onClick={() => setProfileOpen(true)} style={{
                  padding: '10px 20px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 16, fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', transition: 'all 200ms', boxShadow: '0 10px 20px rgba(15, 23, 42, 0.15)'
                }}>SYNTHESIS INSIGHTS</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc' }}>
                <MessageView thread={selected} messages={messages || []} />
              </div>
              <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid rgba(0,0,0,0.05)', background: '#fff' }}>
                <ReplyBox panel={selected.panel} threadId={selected.id} threadHistory={messages || []} contact={{ name: selected.contact_name, phone: selected.phone }} onOptimistic={onOptimistic} onStatus={onStatus} />
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#94a3b8', gap: '1.5rem', background: '#f8fafc' }}>
              <div style={{ width: 120, height: 120, borderRadius: 40, background: '#fff', border: '1px solid rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.02)' }}>
                <Shield size={48} color="#3b82f6" style={{ opacity: 0.2 }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 900, fontSize: '1.25rem', color: '#0f172a', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Select Syndicate Node</div>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, maxWidth: 320, color: '#64748b', lineHeight: 1.6 }}>Choose an investor contact to initiate the deal synthesis and communication protocol.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {profileOpen && selected && (
        <InvestorProfile data={profileFromThread({
          contact_name: selected.contact_name, phone: selected.phone, pipedrive_contact_id: selected.pipedrive_contact_id,
          investor_tier: selected.investor_tier ?? null, investor_role: selected.investor_role ?? null,
        })} onClose={() => setProfileOpen(false)} />
      )}
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
