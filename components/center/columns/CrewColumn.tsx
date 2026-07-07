'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { CrewMemberRow } from '@/app/api/crew/route'

const REFETCH_MS = 60_000

interface CrewListResponse {
  crew: CrewMemberRow[]
}

const AVATAR_TINTS = [
  'text-blue-600 border-blue-200',      // Gideon
  'text-emerald-600 border-emerald-200', // green
  'text-amber-600 border-amber-200',     // amber
  'text-purple-600 border-purple-200',   // gold/purple
  'text-pink-600 border-pink-200',       // violet
  'text-orange-600 border-orange-200',   // orange
] as const

function tintFor(email: string, isPrincipal: boolean, investorSide: boolean): string {
  if (isPrincipal) return 'text-blue-600 border-blue-200'
  if (investorSide) return 'text-purple-600 border-purple-200'
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % AVATAR_TINTS.length
  return AVATAR_TINTS[idx]
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

export function useColumnCount(): number {
  const crewQuery = useQuery({
    queryKey: ['crew', 'active'],
    queryFn: async (): Promise<CrewMemberRow[]> => {
      const res = await fetch('/api/crew', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as CrewListResponse
      return json.crew
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })
  return crewQuery.data?.length ?? 0
}

export default function CrewColumn() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  const crewQuery = useQuery({
    queryKey: ['crew', 'active'],
    queryFn: async (): Promise<CrewMemberRow[]> => {
      const res = await fetch('/api/crew', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as CrewListResponse
      return json.crew
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })

  const emails = useMemo(
    () => (crewQuery.data ?? []).map((c) => c.email),
    [crewQuery.data]
  )

  const countsQuery = useQuery({
    queryKey: ['crew', 'open-counts', emails.join(',')],
    enabled: emails.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bucket_items')
        .select('assigned_to')
        .eq('status', 'open')
        .in('assigned_to', emails)
      if (error) throw new Error(error.message)
      const counts: Record<string, number> = {}
      for (const row of (data ?? []) as { assigned_to: string | null }[]) {
        const key = row.assigned_to
        if (!key) continue
        counts[key] = (counts[key] ?? 0) + 1
      }
      return counts
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })

  const counts = countsQuery.data ?? {}

  useEffect(() => {
    if (emails.length === 0) return
    const filter = `assigned_to=in.(${emails.join(',')})`
    const channel = supabase
      .channel(`crew_bucket_counts:${emails.join(',')}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bucket_items', filter },
        () => {
          queryClient.invalidateQueries({ queryKey: ['crew', 'open-counts'] })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [emails, supabase, queryClient])

  return (
    <div data-component="crew-column" className="bg-white h-full overflow-y-auto px-4 py-4 text-slate-800">
      {crewQuery.isLoading && (
        <div className="text-slate-400 text-xs font-bold">Loading crew…</div>
      )}
      {crewQuery.isError && (
        <div className="text-red-500 text-xs font-bold">
          Crew failed: {(crewQuery.error as Error).message}
        </div>
      )}
      {!crewQuery.isLoading && !crewQuery.isError && (crewQuery.data ?? []).length === 0 && (
        <div className="text-slate-400 text-xs font-bold">No active crew</div>
      )}
      
      <div className="flex flex-col gap-2">
        {(crewQuery.data ?? []).map((member) => (
          <CrewRow
            key={member.email}
            member={member}
            openCount={counts[member.email] ?? 0}
            onDelegated={() => {
              queryClient.invalidateQueries({ queryKey: ['crew', 'open-counts'] })
            }}
          />
        ))}
      </div>
    </div>
  )
}

function CrewRow({
  member,
  openCount,
  onDelegated,
}: {
  member: CrewMemberRow
  openCount: number
  onDelegated: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const tintClass = tintFor(member.email, member.is_principal, member.is_investor_side_only)
  const initials = initialsFor(member.display_name)

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
        className={`flex items-center gap-3 p-3 bg-slate-50 border rounded-xl cursor-pointer text-sm text-slate-800 transition-all ${
          expanded ? 'border-blue-300 bg-white shadow-sm' : 'border-slate-100 hover:border-slate-200 hover:bg-white hover:shadow-sm'
        }`}
      >
        <div
          aria-hidden
          className={`w-10 h-10 rounded-full bg-white border-2 flex items-center justify-center font-black text-sm shrink-0 ${tintClass}`}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-bold leading-tight truncate">{member.display_name}</div>
          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap font-medium">
            <span>{member.role}</span>
            {member.is_investor_side_only && (
              <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest">
                investor-side only
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (typeof window === 'undefined') return
            window.dispatchEvent(
              new CustomEvent('center:scroll-to-bucket', {
                detail: { assigned_to: member.email },
              })
            )
          }}
          aria-label={`Show bucket items assigned to ${member.display_name}`}
          className={`min-w-[44px] h-8 px-3 rounded-full text-xs font-black transition-colors ${
            openCount > 0 
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
              : 'bg-transparent text-slate-300 border border-slate-200 hover:text-slate-500 hover:border-slate-300'
          }`}
        >
          {openCount}
        </button>
      </div>

      {expanded && (
        <DelegateForm
          member={member}
          onClose={() => setExpanded(false)}
          onDelegated={onDelegated}
        />
      )}
    </div>
  )
}

function DelegateForm({
  member,
  onClose,
  onDelegated,
}: {
  member: CrewMemberRow
  onClose: () => void
  onDelegated: () => void
}) {
  const [title, setTitle] = useState('')
  const [remindAt, setRemindAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minRemind = useMemo(() => toLocalInputValue(new Date()), [])

  const submit = async () => {
    setError(null)
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Add a title first.')
      return
    }
    setBusy(true)
    try {
      const remindIso = remindAt ? new Date(remindAt).toISOString() : undefined
      const res = await fetch('/api/crew/delegate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to_email: member.email,
          title: trimmed,
          remind_at: remindIso,
        }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
        throw new Error(json.message || json.error || `HTTP ${res.status}`)
      }
      setTitle('')
      setRemindAt('')
      onDelegated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="bg-slate-50 border border-slate-200 rounded-xl p-3 -mt-2 mb-2 pt-4 relative z-0 shadow-inner"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-3">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1" htmlFor={`crew-title-${member.email}`}>
          Task for {member.display_name}
        </label>
        <input
          id={`crew-title-${member.email}`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
          autoFocus
          disabled={busy}
        />
      </div>

      <div className="mb-3">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1" htmlFor={`crew-remind-${member.email}`}>
          Remind (optional)
        </label>
        <input
          id={`crew-remind-${member.email}`}
          type="datetime-local"
          value={remindAt}
          min={minRemind}
          onChange={(e) => setRemindAt(e.target.value)}
          className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
          disabled={busy}
        />
      </div>

      {error && (
        <div className="text-red-500 text-xs font-bold mb-2">{error}</div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className={`flex-1 bg-blue-600 hover:bg-blue-700 text-white border-none rounded-lg px-4 py-2 font-bold text-sm transition-colors shadow-sm ${busy ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
        >
          {busy ? 'Delegating…' : 'Delegate'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className={`bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg px-4 py-2 font-bold text-sm transition-colors shadow-sm ${busy ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
