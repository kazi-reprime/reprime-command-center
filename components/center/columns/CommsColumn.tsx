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
      window.dispatchEvent(new CustomEvent('center:open-window', {
        detail: {
          target: 'investor-profile',
          opts: { pipedriveContactId: thread.pipedrive_contact_id, name: thread.contact_name },
        },
      }))
    }
  }

  const TABS: { key: CommsTab; label: string; count: number; activeClass: string; idleClass: string; underlineClass: string }[] = [
    { key: '305', label: '305', count: count305, activeClass: 'text-amber-600 bg-amber-50', idleClass: 'text-slate-400 hover:bg-slate-50', underlineClass: 'border-b-amber-500' },
    { key: '718', label: '718', count: count718, activeClass: 'text-emerald-600 bg-emerald-50', idleClass: 'text-slate-400 hover:bg-slate-50', underlineClass: 'border-b-emerald-500' },
    { key: 'staff', label: 'Staff', count: staffCount, activeClass: 'text-blue-600 bg-blue-50', idleClass: 'text-slate-400 hover:bg-slate-50', underlineClass: 'border-b-blue-500' },
    { key: 'investors', label: 'Inv', count: investorCount, activeClass: 'text-purple-600 bg-purple-50', idleClass: 'text-slate-400 hover:bg-slate-50', underlineClass: 'border-b-purple-500' },
  ]

  const isLoading = tab === '305' ? q305.isLoading : tab === '718' ? q718.isLoading : q305.isLoading || q718.isLoading
  const isError = tab === '305' ? q305.isError : tab === '718' ? q718.isError : false

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans">
      {/* Tab Bar */}
      <div className="flex gap-1 px-4 py-2 border-b border-slate-100">
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
          <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold shadow-sm">
            ⚠️ Failed to load threads. Check WhatsApp API credentials.
          </div>
        )}
        
        {(tab === '305' || tab === '718') && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
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

  if (loading) return <div className="p-4 text-center text-slate-400 text-xs font-bold">Loading...</div>
  if (staff.length === 0) return <div className="p-6 text-center text-slate-400 text-xs font-bold">No staff threads</div>

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

  if (loading) return <div className="p-4 text-center text-slate-400 text-xs font-bold">Loading...</div>
  if (investors.length === 0) return <div className="p-6 text-center text-slate-400 text-xs font-bold">No investor threads</div>

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
                ? 'bg-blue-50 border-blue-200 border-l-4 border-l-blue-500 shadow-sm' 
                : 'bg-slate-50 border-slate-100 border-l-4 border-l-transparent hover:bg-white hover:border-slate-200 hover:shadow-sm'
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className={`text-sm truncate flex-1 ${isSelected ? 'font-black text-blue-900' : (t.unread_count || 0) > 0 ? 'font-black text-slate-800' : 'font-bold text-slate-600'}`}>
                {t.contact_name || t.phone || 'Unknown'}
              </span>
              
              <div className="flex items-center gap-2 shrink-0">
                {(t.unread_count || 0) > 0 && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                    {t.unread_count}
                  </span>
                )}
                <span className="text-slate-400 text-[10px] font-bold tracking-wider uppercase">
                  {timeAgo(t.last_message_at)}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest ${
                t.channel_type === 'whatsapp' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : t.channel_type === 'imessage' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-amber-100 text-amber-700'
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
