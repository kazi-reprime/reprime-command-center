'use client'

import { useQuery } from '@tanstack/react-query'
import { formatPhoneDisplay } from '@/lib/timelines/parse'
import type { DashboardThread } from '@/lib/timelines/types'

const REFETCH_MS = 60_000

/**
 * RelationshipStrip — horizontal lanes showing Investors / Family / Others
 * with fast contact chips. Sits below ActiveTaskBanner, above columns.
 */
export default function RelationshipStrip() {
  // Investor cadence
  const cadence = useQuery({
    queryKey: ['investor-cadence', 'strip'],
    queryFn: async () => {
      const res = await fetch('/api/investors/cadence', { cache: 'no-store' })
      if (!res.ok) return { items: [] }
      return res.json()
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: 1,
  })

  // Recent threads for "Others" lane
  const threads718 = useQuery({
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

  const investorItems = cadence.data?.items ?? []
  const recentInvestors = investorItems.filter((i: any) => i.status === 'hot' || i.status === 'warm').slice(0, 4)
  const coldInvestors = investorItems.filter((i: any) => i.status === 'cold').length

  const allThreads: DashboardThread[] = threads718.data?.threads ?? []
  const familyThreads = allThreads.filter(t => t.is_group).slice(0, 3)
  const otherThreads = allThreads
    .filter(t => !t.is_group && !t.is_investor)
    .slice(0, 6)

  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 12px',
        background: 'rgba(14, 52, 112, 0.4)',
        borderBottom: '1px solid rgba(255,204,51,0.06)',
        fontFamily: 'inherit',
        minHeight: 28,
        overflowX: 'auto',
      }}
    >
      {/* Investors Lane */}
      <Lane
        label="Investors"
        color="var(--c-investor, #A855F7)"
        empty={investorItems.length === 0 ? 'No investor activity yet' : undefined}
      >
        {recentInvestors.map((inv: any) => (
          <Chip key={inv.id || inv.name} label={inv.name} color="var(--c-investor, #A855F7)" />
        ))}
        {coldInvestors > 0 && (
          <Chip label={`${coldInvestors} cold`} color="#EF4444" />
        )}
      </Lane>

      <Divider />

      {/* Family Lane */}
      <Lane
        label="Family"
        color="var(--c-channel-718, #00A980)"
        empty={familyThreads.length === 0 ? 'Quiet at home' : undefined}
      >
        {familyThreads.map(t => (
          <Chip key={t.id} label={t.contact_name || formatPhoneDisplay(t.phone)} color="var(--c-channel-718, #00A980)" />
        ))}
      </Lane>

      <Divider />

      {/* Others Lane */}
      <Lane label="Others" color="rgba(255,204,51,0.5)">
        {otherThreads.map(t => (
          <Chip
            key={t.id}
            label={t.contact_name || formatPhoneDisplay(t.phone)}
            color="rgba(255,204,51,0.4)"
            badge={t.channel_type === 'whatsapp' ? 'WA' : t.channel_type === 'imessage' ? 'IM' : t.channel_type === 'sms' ? 'SMS' : undefined}
          />
        ))}
      </Lane>
    </div>
  )
}

function Lane({ label, color, empty, children }: {
  label: string; color: string; empty?: string; children?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <span style={{
        fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
        color, flexShrink: 0, paddingRight: 4,
      }}>
        {label}
      </span>
      {empty ? (
        <span style={{ fontSize: 9, color: 'rgba(255,204,51,0.2)', fontStyle: 'italic' }}>{empty}</span>
      ) : children}
    </div>
  )
}

function Chip({ label, color, badge }: { label: string; color: string; badge?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 8px', borderRadius: 10,
      background: `${color}15`, border: `1px solid ${color}30`,
      color, fontSize: 9, fontWeight: 500, whiteSpace: 'nowrap',
      maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      {label}
      {badge && (
        <span style={{
          fontSize: 7, padding: '0 3px', borderRadius: 3,
          background: `${color}20`, fontWeight: 700,
        }}>{badge}</span>
      )}
    </span>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 16, background: 'rgba(255,204,51,0.08)', flexShrink: 0, margin: '0 4px' }} />
}
