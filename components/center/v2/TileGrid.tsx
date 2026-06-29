'use client'

import { useQuery } from '@tanstack/react-query'
import DealTile from './DealTile'
import InvestorTile from './InvestorTile'
import LiveThreadTile from './LiveThreadTile'
import type {
  DealTileData,
  InvestorTileData,
  LiveThreadTileData,
  TileChannel,
} from '@/lib/center/v2/tiles'
import { panelToChannel } from '@/lib/center/v2/tiles'

/**
 * TileGrid — band 2 of /center/v2.
 *
 * Six-column grid; rows flow from active deals → top investors → live
 * threads. Drains the same /api/briefing/today + /api/investors/cadence
 * queries that power v1 columns; no new endpoints. Showing live threads
 * is gated by a setting flag in a follow-up — for now we always render
 * threads with unread > 0.
 */

const REFETCH_MS = 60_000

interface ActiveDeal {
  id: number
  title: string
  value: number
  currency: string
  stage: string
  pipedrive_url: string
  stage_change_time: string | null
}

interface BriefingThread {
  id: string
  contact_name: string | null
  panel: string | null
  is_investor: boolean
  unread_count: number
  last_message_at: string | null
  last_message_preview: string | null
}

interface BriefingPayload {
  active_deals?: ActiveDeal[]
  pending_followups?: BriefingThread[]
  recent_investors?: BriefingThread[]
}

interface CadenceItem {
  pipedrive_id: number
  name: string
  status: 'cold' | 'cooling' | 'warm' | 'hot'
  lastOutboundAt: string | null
  lastInboundAt: string | null
}
interface CadencePayload {
  items: CadenceItem[]
}

function relativePast(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diffMs = Date.now() - d.getTime()
  const days = Math.round(diffMs / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days}d ago`
  if (days < 60) return `${Math.round(days / 7)}w ago`
  return `${Math.round(days / 30)}mo ago`
}

function dealChannel(stageChangeTime: string | null): TileChannel {
  if (!stageChangeTime) return 'gold'
  const days = (Date.now() - new Date(stageChangeTime).getTime()) / 86_400_000
  if (days > 30) return 'warn'
  return 'gold'
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        color: 'var(--rp-gold)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        padding: '10px 4px 4px',
      }}
    >
      {children}
    </div>
  )
}

export default function TileGrid() {
  const briefing = useQuery({
    queryKey: ['briefing', 'today', 'tile-grid-v2'],
    queryFn: async (): Promise<BriefingPayload> => {
      const res = await fetch('/api/briefing/today', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as BriefingPayload
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })

  const cadence = useQuery({
    queryKey: ['investor-cadence', 'tiles-v2'],
    queryFn: async (): Promise<CadencePayload> => {
      const res = await fetch('/api/investors/cadence', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as CadencePayload
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: false,
  })

  const deals: DealTileData[] = (briefing.data?.active_deals ?? [])
    .slice(0, 12)
    .map((d) => ({
      id: d.id,
      title: d.title,
      value: d.value,
      currency: d.currency,
      stage: d.stage,
      pipedriveUrl: d.pipedrive_url,
      channel: dealChannel(d.stage_change_time),
    }))

  const investors: InvestorTileData[] = (cadence.data?.items ?? [])
    .filter((i) => i.status === 'cold' || i.status === 'cooling')
    .slice(0, 8)
    .map((i) => ({
      pipedriveContactId: i.pipedrive_id,
      threadId: null,
      name: i.name,
      lastReply: relativePast(i.lastInboundAt ?? i.lastOutboundAt),
      channel: 'investor',
    }))

  const liveThreads: LiveThreadTileData[] = (
    briefing.data?.pending_followups ?? []
  )
    .filter((t) => t.unread_count > 0)
    .slice(0, 6)
    .map((t) => ({
      threadId: t.id,
      contactName: t.contact_name ?? 'Unknown',
      panel: t.panel ?? 'sms',
      preview: t.last_message_preview ?? '',
      unreadCount: t.unread_count,
      channel: panelToChannel(t.panel, t.is_investor),
    }))

  return (
    <div
      data-component="tile-grid-v2"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, minmax(180px, 1fr))',
        gap: 16,
        padding: '14px 18px 6px',
        alignContent: 'start',
      }}
    >
      <SectionHeader>Active deals</SectionHeader>
      {briefing.isLoading && deals.length === 0 && (
        <EmptyTile label="Loading deals…" />
      )}
      {!briefing.isLoading && deals.length === 0 && (
        <EmptyTile label="No open deals" />
      )}
      {deals.map((d) => (
        <DealTile key={d.id} deal={d} />
      ))}

      <SectionHeader>Investors to warm</SectionHeader>
      {cadence.isLoading && investors.length === 0 && (
        <EmptyTile label="Loading cadence…" />
      )}
      {!cadence.isLoading && investors.length === 0 && (
        <EmptyTile label="No cold investors right now" />
      )}
      {investors.map((i) => (
        <InvestorTile
          key={`${i.pipedriveContactId ?? i.name}-${i.name}`}
          investor={i}
        />
      ))}

      {liveThreads.length > 0 && (
        <>
          <SectionHeader>Live threads</SectionHeader>
          {liveThreads.map((t) => (
            <LiveThreadTile key={t.threadId} thread={t} />
          ))}
        </>
      )}
    </div>
  )
}

function EmptyTile({ label }: { label: string }) {
  return (
    <div
      style={{
        gridColumn: 'span 2',
        minHeight: 120,
        background: 'rgba(14, 52, 112, 0.4)',
        border: '1px dashed rgba(255, 204, 51, 0.25)',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(245, 239, 216, 0.6)',
        fontSize: 12,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  )
}
