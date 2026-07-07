'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import ChatList from '@/components/chat/ChatList'
import type { DashboardThread, Panel } from '@/lib/timelines/types'

const REFETCH_MS = 60_000

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
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const channel = supabase
      .channel('comms_whatsapp_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_threads' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-threads'] })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

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
  const staffCount = (q305.data?.threads ?? []).filter((t: DashboardThread) => t.is_group).length +
                     (q718.data?.threads ?? []).filter((t: DashboardThread) => t.is_group).length
  const investorCount = (q305.data?.threads ?? []).filter((t: DashboardThread) => t.is_investor).length +
                        (q718.data?.threads ?? []).filter((t: DashboardThread) => t.is_investor).length

  const handleSelect = (thread: DashboardThread) => {
    setSelectedThread(thread.id)
    if (typeof window !== 'undefined') {
      // ONLY open investor-profile if explicitly tagged as is_investor.
      // If it's just a Pipedrive contact (e.g. a broker or vendor), open chat.
      const shouldShowProfile = !!thread.is_investor
      
      window.dispatchEvent(new CustomEvent('center:open-window', {
        detail: {
          target: shouldShowProfile ? 'investor-profile' : 'chat',
          opts: { 
            pipedriveContactId: thread.pipedrive_contact_id, 
            name: thread.contact_name,
            threadId: thread.id,
            title: thread.contact_name ?? thread.phone,
            componentProps: {
              pipedriveContactId: thread.pipedrive_contact_id,
              name: thread.contact_name,
              threadId: thread.id,
              panel: thread.panel
            }
          },
        },
      }))
    }
  }


  const TABS: { key: CommsTab; label: string; count: number; activeClass: string; idleClass: string; underlineClass: string }[] = [
    { key: '305', label: '305', count: count305, activeClass: 'text-warning bg-warning/10', idleClass: 'text-text-muted hover:bg-surface-raised', underlineClass: 'border-b-amber-500' },
    { key: '718', label: '718', count: count718, activeClass: 'text-success bg-success/10', idleClass: 'text-text-muted hover:bg-surface-raised', underlineClass: 'border-b-emerald-500' },
    { key: 'staff', label: 'Staff', count: staffCount, activeClass: 'text-accent bg-accent/10', idleClass: 'text-text-muted hover:bg-surface-raised', underlineClass: 'border-b-blue-500' },
    { key: 'investors', label: 'Inv', count: investorCount, activeClass: 'text-purple-600 bg-purple-50', idleClass: 'text-text-muted hover:bg-surface-raised', underlineClass: 'border-b-purple-500' },
  ]

  const isLoading = tab === '305' ? q305.isLoading : tab === '718' ? q718.isLoading : q305.isLoading || q718.isLoading
  const isError = tab === '305' ? q305.isError : tab === '718' ? q718.isError : false

  return (
    <div className="flex flex-col h-full bg-surface text-text-primary font-sans">
      {/* Tab Bar */}
      <div className="flex gap-1 px-4 py-2 border-b border-border">
        {TABS.map(t => (
          <button 
            key={t.key} 
            onClick={() => setTab(t.key)}
            className={`flex-1 flex flex-col items-center gap-0.5 px-1 py-2 rounded-t-lg border-b-2 transition-colors cursor-pointer ${
              tab === t.key ? `${t.activeClass} ${t.underlineClass} font-black` : `${t.idleClass} border-transparent font-bold`
            }`}
          >
            <span className="text-[10px] uppercase tracking-widest">{t.label}</span>
            <span className={`text-[9px] font-bold ${tab === t.key ? 'opacity-100' : 'opacity-60'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isError && (
          <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs font-bold shadow-sm">
            ⚠️ Failed to load threads. Check WhatsApp API credentials.
          </div>
        )}
        
        {(tab === '305' || tab === '718') && (
          <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
             <ChatList
                panel={tab as Panel}
                selectedThreadId={selectedThread}
                onSelect={handleSelect}
                hideInvestors={tab === '305'}
             />
          </div>
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

function StaffList({ threads305, threads718, loading, selectedId, onSelect }: {
  threads305: DashboardThread[]; threads718: DashboardThread[];
  loading: boolean; selectedId: string | null;
  onSelect: (t: DashboardThread) => void;
}) {
  const staff = useMemo(() => {
    return [...threads305, ...threads718]
      .filter(t => t.is_group)
      .sort((a, b) => {
        const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
        const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
        return bt - at
      })
  }, [threads305, threads718])

  if (loading) return <div className="p-4 text-center text-text-muted text-xs font-bold">Loading...</div>
  if (staff.length === 0) return <div className="p-6 text-center text-text-muted text-xs font-bold">No staff threads</div>

  return <ThreadList threads={staff} selectedId={selectedId} onSelect={onSelect} />
}

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

  if (loading) return <div className="p-4 text-center text-text-muted text-xs font-bold">Loading...</div>
  if (investors.length === 0) return <div className="p-6 text-center text-text-muted text-xs font-bold">No investor threads</div>

  return <ThreadList threads={investors} selectedId={selectedId} onSelect={onSelect} />
}

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
    <div className="flex flex-col gap-2">
      {threads.map(t => {
        const isSelected = selectedId === t.id
        return (
          <div 
            key={t.id} 
            onClick={() => onSelect(t)}
            className={`p-3 rounded-xl border cursor-pointer transition-colors ${
              isSelected 
                ? 'bg-accent/10 border-blue-200 border-l-4 border-l-blue-500 shadow-sm' 
                : 'bg-surface-raised border-border border-l-4 border-l-transparent hover:bg-surface hover:border-border hover:shadow-sm'
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className={`text-sm truncate flex-1 ${isSelected ? 'font-black text-accent' : (t.unread_count || 0) > 0 ? 'font-black text-text-primary' : 'font-bold text-text-secondary'}`}>
                {t.contact_name || t.phone || 'Unknown'}
              </span>
              
              <div className="flex items-center gap-2 shrink-0">
                {(t.unread_count || 0) > 0 && (
                  <span className="w-5 h-5 rounded-full bg-accent text-accent-foreground text-[9px] font-black flex items-center justify-center shadow-sm">
                    {t.unread_count}
                  </span>
                )}
                <span className="text-text-muted text-[10px] font-bold tracking-wider uppercase">
                  {timeAgo(t.last_message_at)}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest ${
                t.channel_type === 'whatsapp' 
                  ? 'bg-emerald-100 text-success' 
                  : t.channel_type === 'imessage' 
                    ? 'bg-accent/20 text-accent-hover' 
                    : 'bg-amber-100 text-warning'
              }`}>
                {t.channel_type === 'whatsapp' ? 'WA' : t.channel_type === 'imessage' ? 'IM' : 'SMS'}
              </span>
              
              {t.is_investor && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 uppercase tracking-widest">
                  INV
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
