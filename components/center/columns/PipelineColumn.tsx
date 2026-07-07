'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import MeetingNowBanner from '@/components/sidebar/MeetingNowBanner'
import SpeakerButton from '@/components/chat/SpeakerButton'
import {
  SuggestedFocusMiniCard,
  type SuggestedFocusItem,
} from '@/components/center/SuggestedFocus'

const REFETCH_MS = 60_000

// ── Types mirroring /api/briefing/today response ─────────────────────────────

interface BriefingMeeting {
  id: string
  title: string
  startTime: string
  endTime: string
  zoomLink: string | null
  attendees: string[]
}

interface ActiveDeal {
  id: number
  title: string
  value: number
  currency: string
  stage: string
  stage_change_time: string | null
  pipedrive_url: string
}

interface ExpiringInvitation {
  id: string
  contact_name: string | null
  contact_email: string | null
  expires_at: string
}

interface TenantFiling {
  case_no: string
  tenant: string
  party_title: string | null
  court: string | null
  filed_at: string | null
  first_seen_at: string
}

const TENANT_WATCHLIST = [
  'Family Dollar Stores',
  'Dollar Tree',
  'Planet Fitness',
  'Tractor Supply',
  'Joann',
  'Big Lots',
] as const

interface BriefingPayload {
  date: string
  meetings: {
    count: number
    first: BriefingMeeting | null
    nextUp: BriefingMeeting | null
    items: BriefingMeeting[]
  }
  unread: {
    total: number
    by_panel: { '305': number; '718': number; investors: number }
  }
  recent_investors: unknown[]
  expiring_invitations: {
    count: number
    items: ExpiringInvitation[]
  }
  pending_followups: unknown[]
  active_deals?: ActiveDeal[]
  tenant_filings_today?: TenantFiling[]
  suggested_focus?: SuggestedFocusItem[]
}

interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  zoomLink: string | null
  attendees: string[]
}

interface CalendarPayload {
  events: CalendarEvent[]
  cached: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatRelativePast(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 60) return diffMin <= 1 ? 'just now' : `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 48) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

function formatExpiringRelative(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const diffMs = d.getTime() - Date.now()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 0) return 'expired'
  if (diffMin < 60) return `${diffMin}m left`
  const diffHr = Math.round(diffMin / 60)
  return `${diffHr}h left`
}

function formatCurrency(value: number, currency: string): string {
  if (!Number.isFinite(value) || value === 0) return ''
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `$${Math.round(value).toLocaleString('en-US')}`
  }
}

function buildNarrative(b: BriefingPayload | undefined): string {
  if (!b) return ''
  const meetings = b.meetings?.count ?? 0
  const investor = b.unread?.by_panel?.investors ?? 0
  const unread = b.unread?.total ?? 0
  const expiring = b.expiring_invitations?.count ?? 0
  const deals = b.active_deals?.length ?? 0

  const parts: string[] = []
  if (meetings === 0) parts.push('No meetings today.')
  else if (meetings === 1) parts.push('One meeting on the calendar.')
  else parts.push(`${meetings} meetings today.`)

  if (b.meetings.nextUp) {
    parts.push(`Next up: ${b.meetings.nextUp.title} at ${formatTime(b.meetings.nextUp.startTime)}.`)
  }

  if (investor > 0) {
    parts.push(`${investor} unread from investors.`)
  }
  if (unread > investor && unread > 0) {
    parts.push(`${unread} unread total across all channels.`)
  }
  if (expiring > 0) {
    parts.push(`${expiring} invitation${expiring === 1 ? '' : 's'} expiring soon.`)
  }
  if (deals > 0) {
    parts.push(`${deals} active deal${deals === 1 ? '' : 's'} moving in Pipedrive.`)
  }
  return parts.join(' ')
}

// ── Visual primitives ────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  colorClass,
}: {
  label: string
  value: number | string
  colorClass: string
}) {
  return (
    <div className={`flex-1 min-w-0 bg-surface-raised border border-border rounded-xl px-2 py-3 text-center`}>
      <div className={`text-2xl font-bold leading-tight ${colorClass}`}>{value}</div>
      <div className="text-[10px] text-text-secondary uppercase tracking-widest mt-1 font-bold">
        {label}
      </div>
    </div>
  )
}

// ── Hook: column count for the kiosk header badge ───────────────────────────

export function useColumnCount(): number {
  const calendar = useQuery({
    queryKey: ['calendar', 'today', 'pipeline-column'],
    queryFn: async (): Promise<CalendarPayload> => {
      const res = await fetch('/api/calendar/today', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as CalendarPayload
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })
  return calendar.data?.events?.length ?? 0
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PipelineColumn() {
  const briefing = useQuery({
    queryKey: ['briefing', 'today', 'pipeline-column'],
    queryFn: async (): Promise<BriefingPayload> => {
      const res = await fetch('/api/briefing/today', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as BriefingPayload
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })

  const calendar = useQuery({
    queryKey: ['calendar', 'today', 'pipeline-column'],
    queryFn: async (): Promise<CalendarPayload> => {
      const res = await fetch('/api/calendar/today', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as CalendarPayload
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })

  const narrative = useMemo(() => buildNarrative(briefing.data), [briefing.data])
  const events = calendar.data?.events ?? []
  const deals = briefing.data?.active_deals ?? []
  const expiring = briefing.data?.expiring_invitations?.items ?? []
  const tenantFilings = useMemo(() => briefing.data?.tenant_filings_today ?? [], [briefing.data?.tenant_filings_today])
  const tenantCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of TENANT_WATCHLIST) counts[t] = 0
    for (const f of tenantFilings) {
      counts[f.tenant] = (counts[f.tenant] ?? 0) + 1
    }
    return counts
  }, [tenantFilings])
  const suggestedFocus = briefing.data?.suggested_focus ?? []

  return (
    <div
      data-component="pipeline-column"
      className="bg-surface text-text-primary h-full overflow-y-auto"
    >
      {/* 1. Now */}
      <div data-section="now">
        <MeetingNowBanner />
      </div>

      {/* 1b. Suggested focus */}
      <SuggestedFocusMiniCard items={suggestedFocus} />

      {/* 2. Today's calendar */}
      <section className="px-4 py-4 border-b border-border" data-section="today">
        <div className="text-accent text-xs font-black uppercase tracking-widest mb-3">Today</div>
        {calendar.isLoading && <div className="text-text-muted text-xs font-semibold">Loading…</div>}
        {calendar.isError && <div className="text-error text-xs font-semibold">Calendar failed: {(calendar.error as Error).message}</div>}
        
        {!calendar.isLoading && !calendar.isError && events.length === 0 && (
          <div>
            <div className="text-text-secondary text-sm font-semibold mb-3">Quiet day. No meetings on the calendar.</div>
            <a
              href="https://calendar.google.com/calendar/u/0/r/eventedit"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-accent/10 hover:bg-accent/20 text-accent border border-blue-200 rounded-lg px-4 py-2 text-xs font-bold transition-colors"
            >
              + Create event
            </a>
          </div>
        )}
        
        {events.map((ev) => (
          <div key={ev.id} className="bg-surface-raised border border-border rounded-xl px-4 py-3 mb-2 shadow-sm">
            <div className="flex justify-between gap-2">
              <span className="text-text-secondary text-xs font-bold">{formatTime(ev.startTime)}</span>
              {ev.zoomLink && (
                <a
                  href={ev.zoomLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent font-bold text-xs hover:underline"
                >
                  Zoom↗
                </a>
              )}
            </div>
            <div className="font-semibold text-sm mt-1 text-text-primary">{ev.title}</div>
          </div>
        ))}
      </section>

      {/* 3. Briefing summary */}
      <section className="px-4 py-4 border-b border-border" data-section="briefing">
        <div className="flex items-center gap-2 mb-3">
          <div className="text-accent text-xs font-black uppercase tracking-widest">Briefing</div>
          {narrative && <SpeakerButton text={narrative} />}
        </div>

        {briefing.isLoading && <div className="text-text-muted text-xs font-semibold">Loading…</div>}
        {briefing.isError && <div className="text-error text-xs font-semibold">Briefing failed: {(briefing.error as Error).message}</div>}
        
        {briefing.data && (
          <>
            <p className="text-sm font-medium text-text-secondary mb-4 leading-relaxed">
              {narrative || 'Quiet morning.'}
            </p>
            <div className="flex gap-2">
              <StatTile label="Meetings" value={briefing.data.meetings.count} colorClass="text-success" />
              <StatTile label="Investors" value={briefing.data.unread.by_panel.investors} colorClass="text-purple-500" />
              <StatTile label="Unread" value={briefing.data.unread.total} colorClass="text-warning" />
              <StatTile label="Expiring" value={briefing.data.expiring_invitations.count} colorClass="text-error" />
            </div>
          </>
        )}
      </section>

      {/* 4. Active deals */}
      <section className="px-4 py-4 border-b border-border" data-section="active-deals">
        <div className="text-accent text-xs font-black uppercase tracking-widest mb-3">Active Deals</div>
        
        {briefing.isLoading && <div className="text-text-muted text-xs font-semibold">Loading…</div>}
        {briefing.data && deals.length === 0 && <div className="text-text-secondary text-xs font-semibold">No open deals</div>}
        
        {deals.map((deal) => {
          const valueStr = formatCurrency(deal.value, deal.currency)
          const movedStr = formatRelativePast(deal.stage_change_time)
          return (
            <a
              key={deal.id}
              href={deal.pipedrive_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-surface-raised hover:bg-accent/10 border border-border hover:border-blue-200 rounded-xl px-4 py-3 mb-2 shadow-sm transition-colors group"
            >
              <div className="font-bold text-text-primary text-sm mb-2">{deal.title}</div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="bg-accent/20 text-accent-hover border border-blue-200 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  {deal.stage}
                </span>
                {valueStr && <span className="text-text-secondary text-xs font-semibold">{valueStr}</span>}
                {movedStr && <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider">moved {movedStr}</span>}
              </div>
            </a>
          )
        })}
      </section>

      {/* 5. Tenant filings */}
      <section className="px-4 py-4 border-b border-border" data-section="tenant-filings">
        <div className="text-accent text-xs font-black uppercase tracking-widest mb-3">New Filings (today)</div>
        
        {briefing.isLoading && <div className="text-text-muted text-xs font-semibold">Loading…</div>}
        {briefing.data && (
          <>
            <div className="text-xs font-semibold text-text-secondary mb-3 leading-relaxed">
              {TENANT_WATCHLIST.map((t, i) => {
                const n = tenantCounts[t] ?? 0
                return (
                  <span key={t}>
                    {i > 0 ? ', ' : ''}
                    <span className={n > 0 ? 'text-accent font-bold' : 'text-text-muted'}>
                      {t.replace(/ Stores$/, '')} +{n}
                    </span>
                  </span>
                )
              })}
            </div>
            {tenantFilings.slice(0, 5).map((f) => (
              <div key={f.case_no} className="bg-surface-raised border border-border rounded-xl px-4 py-3 mb-2">
                <div className="font-bold text-sm text-text-primary">{f.tenant}</div>
                <div className="text-text-secondary text-[10px] font-bold uppercase tracking-wider mt-1">
                  {f.case_no}
                  {f.court ? ` · ${f.court}` : ''}
                  {f.filed_at ? ` · filed ${f.filed_at}` : ''}
                </div>
              </div>
            ))}
            {tenantFilings.length === 0 && (
              <div className="text-text-muted text-xs font-semibold">Nothing new today</div>
            )}
          </>
        )}
      </section>

      {/* 6. Expiring invitations */}
      <section className="px-4 py-4" data-section="expiring">
        <div className="text-accent text-xs font-black uppercase tracking-widest mb-3">Expiring Invitations</div>
        
        {briefing.isLoading && <div className="text-text-muted text-xs font-semibold">Loading…</div>}
        {briefing.data && expiring.length === 0 && <div className="text-text-muted text-xs font-semibold">None expiring</div>}
        
        {expiring.map((inv) => (
          <div key={inv.id} className="bg-surface-raised border border-border rounded-xl px-4 py-3 mb-2 shadow-sm">
            <div className="font-bold text-sm text-text-primary">{inv.contact_name || inv.contact_email || 'Unknown'}</div>
            <div className="text-error text-xs font-bold mt-1">
              {formatExpiringRelative(inv.expires_at)}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
