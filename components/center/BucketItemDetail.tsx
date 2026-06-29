'use client'

import { useQuery } from '@tanstack/react-query'

interface BucketItem {
  id: string
  title: string
  body: string | null
  source_url: string | null
  source_type: string | null
  status: 'open' | 'doing' | 'done' | 'dropped'
  priority: number
  due_at: string | null
  reminded_at: string | null
  assigned_to: string | null
  assigned_by: string | null
  created_by: string
  created_at: string
  updated_at: string
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

const STATUS_LABEL: Record<BucketItem['status'], string> = {
  open: 'Open',
  doing: 'Doing',
  done: 'Done',
  dropped: 'Dropped',
}

const STATUS_COLOR: Record<BucketItem['status'], string> = {
  open: 'var(--rp-gold)',
  doing: 'var(--c-live-now)',
  done: 'var(--c-channel-718)',
  dropped: 'var(--c-fail)',
}

function formatLong(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const labelStyle: React.CSSProperties = {
  color: 'var(--rp-gold-lite)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  fontWeight: 600,
  marginBottom: 4,
}

const valueStyle: React.CSSProperties = {
  color: '#F5EFD8',
  fontSize: 13,
  marginBottom: 14,
  lineHeight: 1.5,
}

const fieldRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
  marginBottom: 14,
}

/**
 * BucketItemDetail — read-only v1.
 *
 * Renders inside code3's WindowManager when the user clicks a BucketColumn
 * row. Edit-in-place is deferred to v2. Pulls fresh data from
 * GET /api/bucket/[id] so the window reflects current state even if the
 * column hasn't refreshed yet.
 */
export default function BucketItemDetail({
  itemId,
  title,
}: {
  itemId?: string
  title?: string
}) {
  const detail = useQuery({
    queryKey: ['bucket', 'detail', itemId],
    queryFn: async (): Promise<BucketItem> => {
      if (!itemId) throw new Error('missing_item_id')
      const res = await fetch(`/api/bucket/${itemId}`, { cache: 'no-store' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message || j.error || `HTTP ${res.status}`)
      }
      return (await res.json()) as BucketItem
    },
    enabled: !!itemId,
    staleTime: 30_000,
  })

  if (!itemId) {
    return (
      <div style={{ padding: 24, fontSize: 13, color: '#F5EFD8' }}>
        Bucket item id missing.
      </div>
    )
  }

  if (detail.isLoading) {
    return (
      <div style={{ padding: 24, fontSize: 13, color: 'var(--rp-gold-lite)' }}>
        Loading {title ? `“${title}”` : 'bucket item'}…
      </div>
    )
  }

  if (detail.isError) {
    return (
      <div style={{ padding: 24, fontSize: 13, color: 'var(--c-fail)' }}>
        Failed to load: {(detail.error as Error).message}
      </div>
    )
  }

  const item = detail.data
  if (!item) {
    return (
      <div style={{ padding: 24, fontSize: 13, color: 'var(--c-fail)' }}>
        Item not found.
      </div>
    )
  }

  return (
    <div
      data-component="bucket-item-detail"
      style={{
        padding: 24,
        fontFamily: 'inherit',
        color: '#F5EFD8',
        fontSize: 13,
        lineHeight: 1.55,
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: STATUS_COLOR[item.status],
            border: `1px solid ${STATUS_COLOR[item.status]}`,
            borderRadius: 3,
            padding: '1px 6px',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {STATUS_LABEL[item.status]}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: PRIORITY_COLOR[item.priority],
            border: `1px solid ${PRIORITY_COLOR[item.priority]}`,
            borderRadius: 3,
            padding: '1px 6px',
            letterSpacing: 0.5,
          }}
        >
          {PRIORITY_LABELS[item.priority]}
        </span>
      </div>

      <h2
        style={{
          margin: '0 0 16px',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--rp-white)',
        }}
      >
        {item.title}
      </h2>

      {item.body && (
        <>
          <div style={labelStyle}>Notes</div>
          <div
            style={{
              ...valueStyle,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {item.body}
          </div>
        </>
      )}

      <div style={fieldRowStyle}>
        <div>
          <div style={labelStyle}>Due</div>
          <div style={{ fontSize: 13 }}>{formatLong(item.due_at)}</div>
        </div>
        <div>
          <div style={labelStyle}>Last reminded</div>
          <div style={{ fontSize: 13 }}>{formatLong(item.reminded_at)}</div>
        </div>
      </div>

      <div style={fieldRowStyle}>
        <div>
          <div style={labelStyle}>Assigned to</div>
          <div style={{ fontSize: 13 }}>{item.assigned_to ?? '—'}</div>
        </div>
        <div>
          <div style={labelStyle}>Assigned by</div>
          <div style={{ fontSize: 13 }}>{item.assigned_by ?? '—'}</div>
        </div>
      </div>

      <div style={fieldRowStyle}>
        <div>
          <div style={labelStyle}>Created</div>
          <div style={{ fontSize: 13 }}>{formatLong(item.created_at)}</div>
        </div>
        <div>
          <div style={labelStyle}>Updated</div>
          <div style={{ fontSize: 13 }}>{formatLong(item.updated_at)}</div>
        </div>
      </div>

      {item.source_url && (
        <div style={{ marginTop: 6 }}>
          <div style={labelStyle}>Source</div>
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 13,
              color: 'var(--rp-gold)',
              wordBreak: 'break-all',
            }}
          >
            {item.source_url}
          </a>
        </div>
      )}

      <div
        style={{
          marginTop: 24,
          paddingTop: 12,
          borderTop: '1px solid var(--rp-border)',
          fontSize: 11,
          color: 'var(--rp-gold-lite)',
          opacity: 0.7,
        }}
      >
        Read-only view. Edit-in-place lands in Track B v2.
      </div>
    </div>
  )
}
