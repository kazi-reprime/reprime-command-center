'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

const REFETCH_MS = 60_000

// Realtime debounce — bucket_items receives a UPDATE event for every row
// touch (snooze, done, drop, demo seed, smoke writes). Without a collapse
// window each event triggered an independent invalidate → refetch storm
// that pinned the main thread for 20-30s. 250ms is the longest delay the
// kiosk's "feels live" budget tolerates while still collapsing bursts of
// 5-50 events into a single refetch.
const REALTIME_DEBOUNCE_MS = 250

// React Query key for the visible list. Used by both the count hook and
// the column itself so the query is shared. Exported as a named constant
// so invalidations stay narrow — invalidating ['bucket'] (no second
// segment) was hitting every detail window's ['bucket', 'detail', id]
// query and the column at once, doubling the refetch volume per write.
const LIST_QUERY_KEY = ['bucket', 'open-doing'] as const

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  1: 'var(--c-fail)',
  2: 'var(--c-warn)',
  3: 'var(--rp-gold)',
  4: 'var(--rp-gold-lite)',
  5: 'var(--rp-gold-lite)',
}

function statusOrder(status: BucketStatus): number {
  // Open before doing inside each priority group, per track spec.
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

// ── Visual primitives ────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  padding: '0.85rem 1rem',
  borderBottom: '1px solid var(--rp-border)',
}

const sectionLabel: React.CSSProperties = {
  color: 'var(--rp-gold)',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  marginBottom: 8,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 8,
}

const sectionCount: React.CSSProperties = {
  color: 'var(--rp-gold-lite)',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: 0,
  textTransform: 'none',
}

const inputBoxStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--rp-surface)',
  border: '1px solid var(--rp-border)',
  borderRadius: 6,
  color: 'var(--rp-white)',
  padding: '0.55rem 0.75rem',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
}

// ── Action menu ──────────────────────────────────────────────────────────────

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

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        right: 0,
        top: '100%',
        marginTop: 4,
        background: 'rgba(14, 52, 112, 0.98)',
        border: '1px solid var(--rp-gold)',
        borderRadius: 6,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        minWidth: 180,
        zIndex: 5,
        fontSize: 12,
        color: 'var(--rp-white)',
      }}
    >
      {showPriority ? (
        <>
          <div
            style={{
              padding: '6px 10px',
              color: 'var(--rp-gold-lite)',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
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
              style={menuButtonStyle(p === item.priority)}
            >
              <span style={{ color: PRIORITY_COLOR[p], marginRight: 8 }}>●</span>
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              onPatch({ status: 'done' })
              onClose()
            }}
            style={menuButtonStyle(false)}
          >
            ✓ Done
          </button>
          <button
            type="button"
            onClick={() => snooze(2)}
            style={menuButtonStyle(false)}
          >
            Snooze 2 days
          </button>
          <button
            type="button"
            onClick={() => snooze(3)}
            style={menuButtonStyle(false)}
          >
            Snooze 3 days
          </button>
          <button
            type="button"
            onClick={() => {
              onRemind()
              onClose()
            }}
            style={menuButtonStyle(false)}
          >
            Remind in 1 hour
          </button>
          <button
            type="button"
            onClick={() => setShowPriority(true)}
            style={menuButtonStyle(false)}
          >
            Reprioritize…
          </button>
          <button
            type="button"
            onClick={() => {
              onPatch({ status: 'dropped' })
              onClose()
            }}
            style={{ ...menuButtonStyle(false), color: 'var(--c-fail)' }}
          >
            Drop
          </button>
        </>
      )}
    </div>
  )
}

function menuButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '7px 12px',
    background: active ? 'rgba(255, 204, 51, 0.12)' : 'transparent',
    color: 'inherit',
    border: 'none',
    borderTop: '1px solid rgba(255, 204, 51, 0.10)',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
  }
}

// ── Row ──────────────────────────────────────────────────────────────────────

// Memoized row — every snooze / done / drop mutates one row but the parent
// list re-renders all of them. Without React.memo + a stable item identity
// the freeze trace showed BucketRow as the dominant offender (50+ rows ×
// per-row style object allocations × 5 priority groups). Cheap equality:
// item reference is stable when React Query's structuralSharing keeps the
// row unchanged, and onPatch/onRemind are stabilized by useCallback in
// the parent.
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
  const accent = PRIORITY_COLOR[item.priority] ?? 'var(--rp-gold)'
  const dueText = formatDueRelative(item.due_at)
  const dueOverdue =
    item.due_at && new Date(item.due_at).getTime() < Date.now()
  const isDoing = item.status === 'doing'

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
      style={{
        position: 'relative',
        background: 'var(--rp-surface)',
        border: '1px solid var(--rp-border)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 6,
        padding: '0.55rem 0.75rem',
        marginBottom: 6,
        fontSize: 13,
        color: 'var(--rp-white)',
        cursor: 'pointer',
        opacity: item.status === 'done' || item.status === 'dropped' ? 0.55 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textDecoration: item.status === 'done' ? 'line-through' : undefined,
            }}
            title={item.title}
          >
            {isDoing && (
              <span
                style={{
                  display: 'inline-block',
                  marginRight: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--c-live-now)',
                  border: '1px solid var(--c-live-now)',
                  borderRadius: 3,
                  padding: '0 4px',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  verticalAlign: 'middle',
                }}
              >
                Doing
              </span>
            )}
            {item.title}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 4,
              fontSize: 11,
              color: 'var(--rp-gold-lite)',
              opacity: 0.8,
            }}
          >
            <span>added {formatRelativePast(item.created_at)}</span>
            {dueText && (
              <span
                style={{
                  color: dueOverdue ? 'var(--c-fail)' : 'var(--rp-gold-lite)',
                  fontWeight: dueOverdue ? 600 : 400,
                }}
              >
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
          style={{
            flexShrink: 0,
            padding: '2px 8px',
            color: 'var(--rp-gold-lite)',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            borderRadius: 4,
            position: 'relative',
          }}
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

// ── Hook: column count for the kiosk header badge ───────────────────────────

/**
 * useColumnCount — exposes the visible-item count for this column so the
 * parent kiosk can render a header badge ("Bucket (5)"). Reuses the same
 * React Query key as BucketColumn, so the query is shared (no extra fetch).
 */
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
  return list.data?.items.length ?? 0
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * BucketColumn — Track B. Renders open + doing items grouped by priority.
 *
 * Realtime: subscribes to public.bucket_items via the browser Supabase
 * client and invalidates the open-doing list query on every INSERT /
 * UPDATE / DELETE. Invalidations are debounced by REALTIME_DEBOUNCE_MS
 * to collapse bursts (demo seed, smoke writes) into a single refetch.
 * Background polling at 60s is the fallback when Realtime is disconnected.
 *
 * Mutation strategy: PATCH responses are written into the cache via
 * setQueryData so the row update lands instantly; the Realtime broadcast
 * arrives ~100ms later and the debounced invalidate is then a no-op
 * because the data is already current.
 *
 * Click row → dispatches `center:open-window` for code3's WindowManager
 * (target='bucket-item', componentProps={ itemId, title }).
 *
 * Action menu → PATCH /api/bucket/[id] for status / priority / due_at;
 * "Remind in 1 hour" hits POST /api/bucket/[id]/remind which is owned
 * by code5 (this column does not build that endpoint).
 */
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
    // Keep row references stable across refetches when the underlying
    // payload hasn't changed; React.memo on BucketRow depends on this
    // to skip per-row work on every refetch.
    structuralSharing: true,
  })

  // Realtime subscription with debounced invalidation. Each Realtime event
  // used to fire its own invalidate → refetch; with the demo seed +
  // smoke writes that produced 5-50 events back-to-back, the main thread
  // was pinned for 20-30s. Collapse all events inside REALTIME_DEBOUNCE_MS
  // into a single invalidate.
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
      // Refocus the input so rapid-fire dictation flows naturally.
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
      // Optimistically update the open-doing list with the server-confirmed
      // row. Avoids waiting for the Realtime broadcast to refetch and
      // eliminates the cache-bust + Realtime double work for snooze/done.
      queryClient.setQueryData<ListPayload>(LIST_QUERY_KEY, (prev) => {
        if (!prev) return prev
        const next = prev.items.map((it) => (it.id === data.id ? data : it))
        return { ...prev, items: next }
      })
      // Also keep any open detail window in sync.
      queryClient.setQueryData<BucketItem>(['bucket', 'detail', data.id], data)
    },
  })

  // Stable callbacks — BucketRow is React.memo'd so unstable refs would
  // defeat the optimization and re-render every row on every parent
  // render.
  const handlePatch = useCallback(
    (id: string, patch: Partial<BucketItem>) => {
      patchMutation.mutate({ id, patch })
    },
    [patchMutation]
  )

  const handleRemind = useCallback((id: string) => {
    // Code5 owns this endpoint. We POST a minimal in_minutes payload —
    // if code5's contract drifts, this is the only place to update.
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

  // Group by priority for the rendered sections.
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

  const total = list.data?.items.length ?? 0

  return (
    <div
      data-component="bucket-column"
      style={{
        background: 'var(--rp-navy)',
        color: 'var(--rp-white)',
        height: '100%',
        overflowY: 'auto',
        fontFamily: 'inherit',
      }}
    >
      {/* Add-to-bucket input */}
      <section style={sectionStyle} data-section="add">
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
          style={inputBoxStyle}
        />
        {addMutation.isError && (
          <div
            style={{
              color: 'var(--c-fail)',
              fontSize: 11,
              marginTop: 4,
            }}
          >
            {(addMutation.error as Error).message}
          </div>
        )}
      </section>

      {/* Loading / error / empty */}
      {list.isLoading && (
        <section style={sectionStyle}>
          <div style={{ color: 'var(--rp-gold-lite)', fontSize: 12 }}>Loading…</div>
        </section>
      )}
      {list.isError && (
        <section style={sectionStyle}>
          <div style={{ color: 'var(--c-fail)', fontSize: 12 }}>
            Failed: {(list.error as Error).message}
          </div>
        </section>
      )}
      {!list.isLoading && !list.isError && total === 0 && (
        <section style={sectionStyle}>
          <div style={{ color: 'var(--rp-gold-lite)', fontSize: 13, marginBottom: 8 }}>
            Nothing in the bucket. Speak or type to add.
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            style={{
              background: 'rgba(255, 204, 51, 0.10)',
              color: 'var(--rp-gold)',
              border: '1px solid var(--rp-gold)',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            + Add
          </button>
        </section>
      )}

      {/* Priority groups */}
      {grouped.map((group) => (
        <section
          key={group.priority}
          style={sectionStyle}
          data-section={`p${group.priority}`}
        >
          <div style={sectionLabel}>
            <span style={{ color: PRIORITY_COLOR[group.priority] }}>
              {PRIORITY_LABELS[group.priority]}
            </span>
            <span style={sectionCount}>{group.items.length}</span>
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
