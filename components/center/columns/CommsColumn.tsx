'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import ChatList from '@/components/chat/ChatList'
import type { DashboardThread, Panel } from '@/lib/timelines/types'

const REFETCH_MS = 60_000

/**
 * CommsColumn — multi-tab WhatsApp/SMS/iMessage communication center.
 * Shows 4 tabs: 305 RePrime, 718 Personal, Staff, Investors
 * Each tab wraps the existing ChatList component.
 */

type CommsTab = '305' | '718' | 'staff' | 'investors'

export function useColumnCount(): number {
  const q305 = useQuery({
    queryKey: ['whatsapp-threads', '305'],
    queryFn: async () => {
      const res = await fetch('/api/whatsapp/threads?panel=305', { cache: 'no-store' })
      if (!res.ok) return { threads: [] }
      return res.json()
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: 1,
  })
  const q718 = useQuery({
    queryKey: ['whatsapp-threads', '718'],
    queryFn: async () => {
      const res = await fetch('/api/whatsapp/threads?panel=718', { cache: 'no-store' })
      if (!res.ok) return { threads: [] }
      return res.json()
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: 1,
  })
  return (q305.data?.threads?.length ?? 0) + (q718.data?.threads?.length ?? 0)
}

export default function CommsColumn() {
  const [tab, setTab] = useState<CommsTab>('305')
  const [selectedThread, setSelectedThread] = useState<string | null>(null)

  // Thread counts for tabs
  const q305 = useQuery({
    queryKey: ['whatsapp-threads', '305'],
    queryFn: async () => {
      const res = await fetch('/api/whatsapp/threads?panel=305', { cache: 'no-store' })
      if (!res.ok) return { threads: [] }
      return res.json()
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: 1,
  })
  const q718 = useQuery({
    queryKey: ['whatsapp-threads', '718'],
    queryFn: async () => {
      const res = await fetch('/api/whatsapp/threads?panel=718', { cache: 'no-store' })
      if (!res.ok) return { threads: [] }
      return res.json()
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: 1,
  })

  const count305 = q305.data?.threads?.length ?? 0
  const count718 = q718.data?.threads?.length ?? 0
  const staffCount = (q305.data?.threads ?? []).filter((t: DashboardThread) => t.is_staff).length +
                     (q718.data?.threads ?? []).filter((t: DashboardThread) => t.is_staff).length
  const investorCount = (q305.data?.threads ?? []).filter((t: DashboardThread) => t.is_investor).length +
                        (q718.data?.threads ?? []).filter((t: DashboardThread) => t.is_investor).length

  const handleSelect = (thread: DashboardThread) => {
    setSelectedThread(thread.id)
    // Dispatch to WindowManager for thread detail if needed
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('center:open-window', {
        detail: {
          target: 'investor-profile',
          opts: { pipedriveContactId: thread.pipedrive_contact_id, name: thread.contact_name },
        },
      }))
    }
  }

  const TABS: { key: CommsTab; label: string; count: number; color: string }[] = [
    { key: '305', label: '305', count: count305, color: 'var(--c-channel-305, #FFCC33)' },
    { key: '718', label: '718', count: count718, color: 'var(--c-channel-718, #00A980)' },
    { key: 'staff', label: 'Staff', count: staffCount, color: 'var(--c-warn, #F59E0B)' },
    { key: 'investors', label: 'Inv', count: investorCount, color: 'var(--c-investor, #A855F7)' },
  ]

  const isLoading = tab === '305' ? q305.isLoading : tab === '718' ? q718.isLoading : q305.isLoading || q718.isLoading
  const isError = tab === '305' ? q305.isError : tab === '718' ? q718.isError : false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab Bar */}
      <div style={{
        display: 'flex', gap: 2, padding: '6px 8px',
        borderBottom: '1px solid rgba(255,204,51,0.08)',
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '4px 2px', borderRadius: 5, border: 'none', cursor: 'pointer',
              background: tab === t.key ? `${t.color}22` : 'transparent',
              color: tab === t.key ? t.color : 'rgba(255,204,51,0.3)',
              fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
              borderBottom: tab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            }}
          >
            <span>{t.label}</span>
            <span style={{ fontSize: 8, opacity: 0.6 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isError && (
          <div style={{ padding: 12, margin: 8, borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', color: '#F59E0B', fontSize: 10 }}>
            ⚠️ Failed to load threads. Check WhatsApp API credentials.
          </div>
        )}
        {(tab === '305' || tab === '718') && (
          <ChatList
            panel={tab as Panel}
            selectedThreadId={selectedThread}
            onSelect={handleSelect}
            hideInvestors={tab === '305'}
          />
        )}
        {tab === 'staff' && (
          <StaffList
            threads305={q305.data?.threads ?? []}
            threads718={q718.data?.threads ?? []}
            loading={isLoading}
            selectedId={selectedThread}
            onSelect={handleSelect}
          />
        )}
        {tab === 'investors' && (
          <InvestorList
            threads305={q305.data?.threads ?? []}
            threads718={q718.data?.threads ?? []}
            loading={isLoading}
            selectedId={selectedThread}
            onSelect={handleSelect}
          />
        )}
      </div>
    </div>
  )
}

// Staff sub-list — filters both panels for is_staff threads
function StaffList({ threads305, threads718, loading, selectedId, onSelect }: {
  threads305: DashboardThread[]; threads718: DashboardThread[];
  loading: boolean; selectedId: string | null;
  onSelect: (t: DashboardThread) => void;
}) {
  const staff = useMemo(() => {
    return [...threads305, ...threads718]
      .filter(t => t.is_staff || t.is_family)
      .sort((a, b) => {
        const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
        const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
        return bt - at
      })
  }, [threads305, threads718])

  if (loading) return <div style={{ padding: 16, textAlign: 'center', color: 'rgba(255,204,51,0.3)', fontSize: 11 }}>Loading...</div>
  if (staff.length === 0) return <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,204,51,0.2)', fontSize: 11 }}>No staff threads</div>

  return <ThreadList threads={staff} selectedId={selectedId} onSelect={onSelect} />
}

// Investor sub-list
function InvestorList({ threads305, threads718, loading, selectedId, onSelect }: {
  threads305: DashboardThread[]; threads718: DashboardThread[];
  loading: boolean; selectedId: string | null;
  onSelect: (t: DashboardThread) => void;
}) {
  const investors = useMemo(() => {
    return [...threads305, ...threads718]
      .filter(t => t.is_investor)
      .sort((a, b) => {
        const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
        const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
        return bt - at
      })
  }, [threads305, threads718])

  if (loading) return <div style={{ padding: 16, textAlign: 'center', color: 'rgba(255,204,51,0.3)', fontSize: 11 }}>Loading...</div>
  if (investors.length === 0) return <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,204,51,0.2)', fontSize: 11 }}>No investor threads</div>

  return <ThreadList threads={investors} selectedId={selectedId} onSelect={onSelect} />
}

// Shared thread list renderer
function ThreadList({ threads, selectedId, onSelect }: {
  threads: DashboardThread[]; selectedId: string | null;
  onSelect: (t: DashboardThread) => void;
}) {
  const timeAgo = (iso: string | null) => {
    if (!iso) return ''
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    if (mins < 1440) return `${Math.floor(mins / 60)}h`
    return `${Math.floor(mins / 1440)}d`
  }

  return (
    <>
      {threads.map(t => (
        <div key={t.id} onClick={() => onSelect(t)}
          style={{
            padding: '6px 10px', cursor: 'pointer',
            background: selectedId === t.id ? 'rgba(255,204,51,0.06)' : 'transparent',
            borderBottom: '1px solid rgba(255,204,51,0.03)',
            borderLeft: selectedId === t.id ? '3px solid var(--rp-gold, #FFCC33)' : '3px solid transparent',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#F5EFD8', fontSize: 11, fontWeight: (t.unread_count || 0) > 0 ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {t.contact_name || t.phone || 'Unknown'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {(t.unread_count || 0) > 0 && (
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--rp-gold, #FFCC33)', color: '#0E3470', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.unread_count}</span>
              )}
              <span style={{ color: 'rgba(255,204,51,0.25)', fontSize: 9 }}>{timeAgo(t.last_message_at)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
            <span style={{ fontSize: 8, padding: '0px 4px', borderRadius: 3, background: t.channel_type === 'whatsapp' ? 'rgba(37,211,102,0.15)' : t.channel_type === 'imessage' ? 'rgba(0,122,255,0.15)' : 'rgba(245,158,11,0.15)', color: t.channel_type === 'whatsapp' ? '#25D366' : t.channel_type === 'imessage' ? '#007AFF' : '#F59E0B' }}>
              {t.channel_type === 'whatsapp' ? 'WA' : t.channel_type === 'imessage' ? 'IM' : 'SMS'}
            </span>
            {t.is_investor && (
              <span style={{ fontSize: 8, padding: '0px 4px', borderRadius: 3, background: 'rgba(168,85,247,0.15)', color: '#A855F7' }}>INV</span>
            )}
          </div>
        </div>
      ))}
    </>
  )
}
