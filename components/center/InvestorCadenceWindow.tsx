'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import SpeakerButton from '@/components/chat/SpeakerButton'

const REFETCH_MS = 60_000

type CadenceStatus = 'cold' | 'cooling' | 'warm' | 'hot'
type InvestorTier = 'A' | 'B' | 'C' | 'D'

interface CadenceRow {
  pipedrive_id: number
  name: string
  tier: InvestorTier | null
  score: number
  status: CadenceStatus
  reasons: string[]
  lastOutboundAt: string | null
  lastInboundAt: string | null
  openAsksCount: number
  overdueAsksCount: number
}

interface CadencePayload {
  items: CadenceRow[]
  cached: boolean
}

const STATUS_COLOR: Record<CadenceStatus, string> = {
  cold: 'var(--c-fail)',
  cooling: 'var(--c-warn)',
  warm: 'var(--c-channel-718)',
  hot: 'var(--c-investor)',
}

const STATUS_LABEL: Record<CadenceStatus, string> = {
  cold: 'cold',
  cooling: 'cooling',
  warm: 'warm',
  hot: 'hot',
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

function daysSinceLabel(iso: string | null): string {
  const d = daysSince(iso)
  if (d === null) return 'no inbound'
  if (d === 0) return 'today'
  if (d === 1) return '1d silent'
  return `${d}d silent`
}

function firstNameLastInitial(full: string): string {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 0) return full
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}`
}

function buildListenScript(rows: CadenceRow[]): string {
  const top = rows.filter((r) => r.status === 'cold').slice(0, 3)
  if (top.length === 0) return 'No cold investors right now.'
  const phrases = top.map((r) => {
    const days = daysSince(r.lastInboundAt)
    const silentPart =
      days === null
        ? 'no inbound on record'
        : days <= 1
          ? `${days} day silent`
          : `${days} days silent`
    const overduePart =
      r.overdueAsksCount > 0
        ? `, ${r.overdueAsksCount} overdue ${r.overdueAsksCount === 1 ? 'ask' : 'asks'}`
        : ''
    return `${firstNameLastInitial(r.name)}, ${silentPart}${overduePart}.`
  })
  return `Top cold investors. ${phrases.join(' ')}`
}

function StatusDot({ status }: { status: CadenceStatus }) {
  return (
    <span
      aria-label={STATUS_LABEL[status]}
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: STATUS_COLOR[status],
        flexShrink: 0,
        boxShadow: `0 0 0 2px rgba(14, 52, 112, 0.6)`,
      }}
    />
  )
}

function TierBadge({ tier }: { tier: InvestorTier | null }) {
  const label = tier ?? '—'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--rp-gold)',
        border: '1px solid rgba(255, 204, 51, 0.45)',
        background: 'rgba(255, 204, 51, 0.08)',
        flexShrink: 0,
      }}
      title={tier ? `Tier ${tier}` : 'Untagged'}
    >
      {label}
    </span>
  )
}

function CadenceRowItem({ row }: { row: CadenceRow }) {
  const [expanded, setExpanded] = useState(false)
  const accent = STATUS_COLOR[row.status]
  const days = daysSinceLabel(row.lastInboundAt)

  const onOpenChat = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent('open-investor-thread', {
        detail: { pipedrive_id: row.pipedrive_id },
      }),
    )
  }

  return (
    <div
      style={{
        background: 'var(--rp-surface)',
        border: '1px solid var(--rp-border)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 6,
        padding: '0.6rem 0.75rem',
        marginBottom: 6,
        fontSize: 13,
        color: 'var(--rp-white)',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenChat}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpenChat(e)
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
        }}
        title="Open investor chat"
      >
        <StatusDot status={row.status} />
        <TierBadge tier={row.tier} />
        <span
          style={{
            fontWeight: 600,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.name}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: accent,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          {STATUS_LABEL[row.status]}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--rp-gold-lite)',
            opacity: 0.7,
            flexShrink: 0,
          }}
          title={`Cadence score ${row.score}/100`}
        >
          {row.score}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 4,
          fontSize: 11,
          color: 'var(--rp-gold-lite)',
          opacity: 0.85,
          flexWrap: 'wrap',
        }}
      >
        <span>{days}</span>
        {row.openAsksCount > 0 && (
          <span>
            {row.openAsksCount} open {row.openAsksCount === 1 ? 'ask' : 'asks'}
          </span>
        )}
        {row.overdueAsksCount > 0 && (
          <span style={{ color: 'var(--c-fail)', fontWeight: 600 }}>
            {row.overdueAsksCount} overdue
          </span>
        )}
        {row.reasons.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              color: 'var(--rp-gold)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              padding: 0,
            }}
            aria-expanded={expanded}
          >
            {expanded ? 'Hide reasons' : `Why ${row.status}?`}
          </button>
        )}
      </div>

      {expanded && row.reasons.length > 0 && (
        <ul
          style={{
            margin: '6px 0 0',
            padding: '0 0 0 18px',
            color: 'var(--rp-gold-lite)',
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          {row.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * InvestorCadenceWindow — ranks investors by silence + open/overdue asks
 * via /api/investors/cadence (code11). Renders a header with status
 * counts, a Listen button that reads the top 3 cold investors aloud,
 * and a coldest-first list. Click a row to open the existing investor
 * chat panel via the `open-investor-thread` window event.
 */
export default function InvestorCadenceWindow() {
  const cadence = useQuery({
    queryKey: ['investor-cadence'],
    queryFn: async (): Promise<CadencePayload> => {
      const res = await fetch('/api/investors/cadence', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as CadencePayload
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })

  const items = useMemo(() => cadence.data?.items ?? [], [cadence.data?.items])

  const counts = useMemo(() => {
    const c: Record<CadenceStatus, number> = {
      cold: 0,
      cooling: 0,
      warm: 0,
      hot: 0,
    }
    for (const r of items) c[r.status] += 1
    return c
  }, [items])

  const listenScript = useMemo(() => buildListenScript(items), [items])

  return (
    <div
      data-component="investor-cadence-window"
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--rp-navy)',
        color: 'var(--rp-white)',
        fontFamily: 'inherit',
      }}
    >
      <header
        style={{
          padding: '0.85rem 1rem',
          borderBottom: '1px solid var(--rp-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            color: 'var(--rp-gold)',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          Investor cadence
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flex: 1,
            flexWrap: 'wrap',
          }}
        >
          <CountChip count={counts.cold} label="cold" status="cold" />
          <CountChip count={counts.cooling} label="cooling" status="cooling" />
          <CountChip count={counts.warm} label="warm" status="warm" />
          <CountChip count={counts.hot} label="hot" status="hot" />
        </div>
        <SpeakerButton text={listenScript} />
      </header>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.75rem 1rem',
        }}
      >
        {cadence.isLoading && (
          <div style={{ color: 'var(--rp-gold-lite)', fontSize: 12 }}>
            Loading…
          </div>
        )}
        {cadence.isError && (
          <div style={{ color: 'var(--c-fail)', fontSize: 12 }}>
            Failed: {(cadence.error as Error).message}
          </div>
        )}
        {!cadence.isLoading && !cadence.isError && items.length === 0 && (
          <div style={{ color: 'var(--rp-gold-lite)', fontSize: 12 }}>
            No investors tagged in Pipedrive yet.
          </div>
        )}
        {items.map((row) => (
          <CadenceRowItem key={row.pipedrive_id} row={row} />
        ))}
      </div>
    </div>
  )
}

function CountChip({
  count,
  label,
  status,
}: {
  count: number
  label: string
  status: CadenceStatus
}) {
  const color = STATUS_COLOR[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: 'var(--rp-white)',
      }}
    >
      <StatusDot status={status} />
      <span style={{ fontWeight: 700, color }}>{count}</span>
      <span style={{ color: 'var(--rp-gold-lite)', opacity: 0.85 }}>{label}</span>
    </span>
  )
}
