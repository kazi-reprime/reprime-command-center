'use client'

import { useQuery } from '@tanstack/react-query'
import ColorLegend from '@/components/help/ColorLegend'
import HealthPill from '@/components/center/HealthPill'
import IdentityPickerSlot from '@/components/center/IdentityPickerSlot'
import KpiCard from './KpiCard'
import ActionButton from './ActionButton'

/**
 * TopStripV2 — full-width HUD strip for /center/v2.
 *
 * Layout (left → right):
 *   - Color legend (compact, gold meaning chips)
 *   - 4 KPI cards: Meetings today / Unread investor / Expiring invitations
 *     / Active deals
 *   - 6 big action buttons: Briefing / Cadence / Secretary / Settings /
 *     New Deal / New Note
 *   - Identity picker + health pill
 *
 * Reads the same /api/briefing/today + /api/investors/cadence queries the
 * existing PipelineColumn + TopStrip use, so no extra fetch lands. Click
 * targets dispatch the same `center:open-window` / `open-briefing` events
 * the v1 surface already wires.
 */

const REFETCH_MS = 60_000

type CadenceStatus = 'cold' | 'cooling' | 'warm' | 'hot'

interface CadenceItem {
  status: CadenceStatus
}

interface CadencePayload {
  items: CadenceItem[]
}

interface BriefingPayload {
  meetings: { count: number }
  unread: {
    by_panel: { '305': number; '718': number; investors: number }
  }
  expiring_invitations: { count: number }
  active_deals?: unknown[]
}

function dispatchOpenWindow(target: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('center:open-window', { detail: { target } }),
  )
}

function dispatchBriefing() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('open-briefing'))
}

export default function TopStripV2() {
  const briefing = useQuery({
    queryKey: ['briefing', 'today', 'topstrip-v2'],
    queryFn: async (): Promise<BriefingPayload> => {
      const res = await fetch('/api/briefing/today', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as BriefingPayload
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })

  const cadence = useQuery({
    queryKey: ['investor-cadence', 'cold-count', 'topstrip-v2'],
    queryFn: async (): Promise<CadencePayload> => {
      const res = await fetch('/api/investors/cadence', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as CadencePayload
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: false,
  })

  const meetings = briefing.data?.meetings.count ?? 0
  const unreadInvestor = briefing.data?.unread.by_panel.investors ?? 0
  const expiring = briefing.data?.expiring_invitations.count ?? 0
  const activeDeals = briefing.data?.active_deals?.length ?? 0
  const coldCount =
    cadence.data?.items.filter((i) => i.status === 'cold').length ?? 0

  return (
    <div
      data-component="top-strip-v2"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(14, 52, 112, 0.96)',
        borderBottom: '1px solid rgba(255, 204, 51, 0.22)',
        fontFamily: 'inherit',
      }}
    >
      <ColorLegend />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '10px 16px',
          minHeight: 88,
          overflowX: 'auto',
        }}
      >
        {/* KPI cards — first cluster */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'stretch',
            flexShrink: 0,
          }}
        >
          <KpiCard
            value={meetings}
            label="Meetings today"
            title="Meetings on today's calendar"
          />
          <KpiCard
            value={unreadInvestor}
            label="Unread investor"
            title="Investor messages waiting on a reply"
          />
          <KpiCard
            value={expiring}
            label="Expiring invitations"
            title="Terminal invitations expiring inside 24 hours"
          />
          <KpiCard
            value={activeDeals}
            label="Active deals"
            title="Open Pipedrive deals moving recently"
          />
        </div>

        {/* Action buttons — second cluster */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <ActionButton
            icon="📰"
            label="Briefing"
            onClick={dispatchBriefing}
          />
          <ActionButton
            icon="🌡"
            label="Cadence"
            onClick={() => dispatchOpenWindow('investor-cadence')}
            badge={coldCount > 0 ? `${coldCount} cold` : null}
          />
          <ActionButton
            icon="✉"
            label="Secretary"
            onClick={() => dispatchOpenWindow('secretary')}
          />
          <ActionButton
            icon="⚙"
            label="Settings"
            onClick={() => dispatchOpenWindow('settings')}
          />
          <ActionButton
            icon="＋"
            label="New deal"
            onClick={() => dispatchOpenWindow('pipedrive')}
            title="New deal — opens Pipedrive in a window"
          />
          <ActionButton
            icon="✎"
            label="New note"
            onClick={() => {
              if (typeof window === 'undefined') return
              window.dispatchEvent(
                new CustomEvent('center:open-search', {
                  detail: { query: '' },
                }),
              )
            }}
            title="New note — opens the quick-capture search modal"
          />
        </div>

        {/* Right spacer pushes identity to far-right */}
        <div style={{ flex: 1, minWidth: 16 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <HealthPill />
          <IdentityPickerSlot />
        </div>
      </div>
    </div>
  )
}
