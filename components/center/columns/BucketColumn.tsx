'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

const REFETCH_MS = 60_000
const REALTIME_DEBOUNCE_MS = 250
const LIST_QUERY_KEY = ['bucket', 'open-doing'] as const

type BucketStatus = 'open' | 'doing' | 'done' | 'dropped'

interface BucketItem {
  id: string
  title: string
  body: string | null
  source_url: string | null
  source_type: string | null
  status: BucketStatus
  priority: number
  due_at: string | null
  reminded_at: string | null
  assigned_to: string | null
  assigned_by: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface ListPayload {
  items: BucketItem[]
}

function formatRelativePast(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 48) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

function formatDueRelative(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = d.getTime() - Date.now()
  const past = diffMs < 0
  const absMin = Math.round(Math.abs(diffMs) / 60_000)
  if (absMin < 60) return past ? `${absMin}m late` : `due in ${absMin}m`
  const absHr = Math.round(absMin / 60)
  if (absHr < 48) return past ? `${absHr}h late` : `due in ${absHr}h`
  const absDay = Math.round(absHr / 24)
  return past ? `${absDay}d late` : `due in ${absDay}d`
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'P1 — Now',
  2: 'P2 — High',
  3: 'P3 — Normal',
  4: 'P4 — Later',
  5: 'P5 — Someday',
}

const PRIORITY_COLOR: Record<number, string> = {
  1: 'text-error',
  2: 'text-warning',
  3: 'text-accent',
  4: 'text-text-muted',
  5: 'text-text-muted',
}

const PRIORITY_BG: Record<number, string> = {
  1: 'border-l-red-500',
  2: 'border-l-amber-500',
  3: 'border-l-blue-500',
  4: 'border-l-slate-400',
  5: 'border-l-slate-400',
}

function statusOrder(status: BucketStatus): number {
  if (status === 'open') return 0
  if (status === 'doing') return 1
  return 2
}

function dispatchOpenWindow(item: BucketItem) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('center:open-window', {
      detail: {
        target: 'bucket-item',
        opts: {
          id: 'bucket-' + item.id,
          componentProps: { itemId: item.id, title: item.title },
        },
      },
    })
  )
}

type ActionMenuProps = {
  item: BucketItem
  onClose: () => void
  onPatch: (patch: Partial<BucketItem>) => void
  onRemind: () => void
}

function ActionMenu({ item, onClose, onPatch, onRemind }: ActionMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [showPriority, setShowPriority] = useState(false)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  function snooze(days: number) {
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    onPatch({ due_at: d })
    onClose()
  }

  const btnClass = "w-full text-left px-3 py-2 text-xs border-t border-border hover:bg-surface-raised transition-colors"
  const activeBtnClass = "w-full text-left px-3 py-2 text-xs border-t border-border bg-accent/10 text-accent-hover font-bold transition-colors"

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-lg min-w-[180px] z-10 text-text-primary overflow-hidden"
    >
      {showPriority ? (
        <>
          <div className="px-3 py-2 text-[10px] font-bold text-text-muted uppercase tracking-wider">
            Set priority
          </div>
          {[1, 2, 3, 4, 5].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                onPatch({ priority: p })
                onClose()
              }}
              className={p === item.priority ? activeBtnClass : btnClass}
            >
              <span className={`${PRIORITY_COLOR[p]} mr-2`}>●</span>
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </>
      ) : (
        <>
          <button type="button" onClick={() => { onPatch({ status: 'done' }); onClose() }} className={btnClass}>
            ✓ Done
          </button>
          <button type="button" onClick={() => snooze(2)} className={btnClass}>
            Snooze 2 days
          </button>
          <button type="button" onClick={() => snooze(3)} className={btnClass}>
            Snooze 3 days
          </button>
          <button type="button" onClick={() => { onRemind(); onClose() }} className={btnClass}>
            Remind in 1 hour
          </button>
          <button type="button" onClick={() => setShowPriority(true)} className={btnClass}>
            Reprioritize…
          </button>
          <button type="button" onClick={() => { onPatch({ status: 'dropped' }); onClose() }} className={`${btnClass} text-error hover:text-error hover:bg-error/10`}>
            Drop
          </button>
        </>
      )}
    </div>
  )
}

const BucketRow = memo(function BucketRow({
  item,
  onPatch,
  onRemind,
}: {
  item: BucketItem
  onPatch: (id: string, patch: Partial<BucketItem>) => void
  onRemind: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const bgBorder = PRIORITY_BG[item.priority] ?? 'border-l-blue-500'
  const dueText = formatDueRelative(item.due_at)
  const dueOverdue = item.due_at && new Date(item.due_at).getTime() < Date.now()
  const isDoing = item.status === 'doing'
  const isDoneOrDropped = item.status === 'done' || item.status === 'dropped'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => dispatchOpenWindow(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          dispatchOpenWindow(item)
        }
      }}
      className={`relative bg-surface-raised border border-border border-l-4 rounded-xl p-3 mb-2 text-sm text-text-primary cursor-pointer hover:bg-surface hover:border-border hover:shadow-sm transition-all ${bgBorder} ${isDoneOrDropped ? 'opacity-50 grayscale' : ''}`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className={`font-bold truncate ${item.status === 'done' ? 'line-through text-text-secondary' : 'text-text-primary'}`} title={item.title}>
            {isDoing && (
              <span className="inline-block mr-2 text-[10px] font-black text-success border border-emerald-200 bg-success/10 rounded px-1 tracking-wider uppercase align-middle">
                Doing
              </span>
            )}
            {item.title}
          </div>

          <div className="flex gap-2 mt-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            <span>added {formatRelativePast(item.created_at)}</span>
            {dueText && (
              <span className={dueOverdue ? 'text-error' : 'text-text-muted'}>
                {dueText}
              </span>
            )}
            {item.assigned_to && item.assigned_to !== item.created_by && (
              <span>→ {item.assigned_to.split('@')[0]}</span>
            )}
          </div>
        </div>

        <div
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((v) => !v)
          }}
          aria-label="Actions"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setMenuOpen((v) => !v)
            }
          }}
          className="shrink-0 px-2 py-1 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded cursor-pointer text-lg leading-none transition-colors relative"
        >
          ⋯
          {menuOpen && (
            <ActionMenu
              item={item}
              onClose={() => setMenuOpen(false)}
              onPatch={(patch) => onPatch(item.id, patch)}
              onRemind={() => onRemind(item.id)}
            />
          )}
        </div>
      </div>
    </div>
  )
})

export function useColumnCount(): number {
  const list = useQuery({
    queryKey: LIST_QUERY_KEY,
    queryFn: async (): Promise<ListPayload> => {
      const res = await fetch('/api/bucket?status=open,doing', {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as ListPayload
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })
  return list.data?.items?.length ?? 0
}

export default function BucketColumn() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const list = useQuery({
    queryKey: LIST_QUERY_KEY,
    queryFn: async (): Promise<ListPayload> => {
      const res = await fetch('/api/bucket?status=open,doing', {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as ListPayload
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    structuralSharing: true,
  })

  useEffect(() => {
    const supabase = createClient()
    let pending: ReturnType<typeof setTimeout> | null = null
    const flush = () => {
      pending = null
      queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY })
    }
    const channel = supabase
      .channel('bucket_items_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bucket_items' },
        () => {
          if (pending !== null) return
          pending = setTimeout(flush, REALTIME_DEBOUNCE_MS)
        }
      )
      .subscribe()

    return () => {
      if (pending !== null) clearTimeout(pending)
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  const addMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch('/api/bucket', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message || j.error || `HTTP ${res.status}`)
      }
      return (await res.json()) as BucketItem
    },
    onSuccess: () => {
      setDraft('')
      queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY })
      inputRef.current?.focus()
    },
  })

  const patchMutation = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<BucketItem> }) => {
      const res = await fetch(`/api/bucket/${vars.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(vars.patch),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message || j.error || `HTTP ${res.status}`)
      }
      return (await res.json()) as BucketItem
    },
    onSuccess: (data) => {
      queryClient.setQueryData<ListPayload>(LIST_QUERY_KEY, (prev) => {
        if (!prev) return prev
        const next = prev.items.map((it) => (it.id === data.id ? data : it))
        return { ...prev, items: next }
      })
      queryClient.setQueryData<BucketItem>(['bucket', 'detail', data.id], data)
    },
  })

  const handlePatch = useCallback(
    (id: string, patch: Partial<BucketItem>) => {
      patchMutation.mutate({ id, patch })
    },
    [patchMutation]
  )

  const handleRemind = useCallback((id: string) => {
    fetch(`/api/bucket/${id}/remind`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ in_minutes: 60 }),
    }).catch((err) => {
      console.error('[bucket] remind failed', err)
    })
  }, [])

  function commitDraft() {
    const t = draft.trim()
    if (!t) return
    setAdding(true)
    addMutation.mutate(t, {
      onSettled: () => setAdding(false),
    })
  }

  const grouped = useMemo(() => {
    const items = list.data?.items ?? []
    const buckets = new Map<number, BucketItem[]>()
    for (const it of items) {
      const arr = buckets.get(it.priority) ?? []
      arr.push(it)
      buckets.set(it.priority, arr)
    }
    for (const [p, arr] of buckets) {
      arr.sort((a, b) => {
        const so = statusOrder(a.status) - statusOrder(b.status)
        if (so !== 0) return so
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      buckets.set(p, arr)
    }
    return [1, 2, 3, 4, 5]
      .map((p) => ({ priority: p, items: buckets.get(p) ?? [] }))
      .filter((g) => g.items.length > 0)
  }, [list.data])

  const total = list.data?.items?.length ?? 0

  return (
    <div
      data-component="bucket-column"
      className="bg-surface text-text-primary h-full overflow-y-auto"
    >
      {/* Add-to-bucket input */}
      <section className="px-4 py-4 border-b border-border" data-section="add">
        <input
          ref={inputRef}
          type="text"
          placeholder="+ Add to bucket — Enter to save"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitDraft()
            }
          }}
          disabled={adding}
          className="w-full bg-surface-raised border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus focus:border-accent transition-all shadow-sm"
        />
        {addMutation.isError && (
          <div className="text-error text-xs font-bold mt-2">
            {(addMutation.error as Error).message}
          </div>
        )}
      </section>

      {/* Loading / error / empty */}
      {list.isLoading && (
        <section className="px-4 py-4 border-b border-border">
          <div className="text-text-muted text-xs font-bold">Loading…</div>
        </section>
      )}
      {list.isError && (
        <section className="px-4 py-4 border-b border-border">
          <div className="text-error text-xs font-bold">
            Failed: {(list.error as Error).message}
          </div>
        </section>
      )}
      {!list.isLoading && !list.isError && total === 0 && (
        <section className="px-4 py-4 border-b border-border">
          <div className="text-text-secondary text-sm font-bold mb-3">
            Nothing in the bucket. Speak or type to add.
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="bg-accent/10 hover:bg-accent/20 text-accent border border-blue-200 rounded-lg px-4 py-2 text-xs font-bold transition-colors shadow-sm"
          >
            + Add
          </button>
        </section>
      )}

      {/* Priority groups */}
      {grouped.map((group) => (
        <section
          key={group.priority}
          className="px-4 py-4 border-b border-border"
          data-section={`p${group.priority}`}
        >
          <div className="flex justify-between items-baseline mb-3">
            <span className={`text-xs font-black uppercase tracking-widest ${PRIORITY_COLOR[group.priority]}`}>
              {PRIORITY_LABELS[group.priority]}
            </span>
            <span className="text-text-muted text-xs font-bold">{group.items.length}</span>
          </div>
          {group.items.map((item) => (
            <BucketRow
              key={item.id}
              item={item}
              onPatch={handlePatch}
              onRemind={handleRemind}
            />
          ))}
        </section>
      ))}
    </div>
  )
}
