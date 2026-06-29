'use client'

import { useQuery } from '@tanstack/react-query'
import type { ChannelType, Panel } from '@/lib/timelines/types'

type InvestorMessage = {
  id: string
  thread_id: string
  panel: Panel
  channel_type: ChannelType
  direction: 'in' | 'out'
  body: string | null
  sent_at: string | null
  status: string | null
  is_unread: boolean
}

type InvestorGroup = {
  phone: string
  contact_name: string | null
  panel: Panel
  channel_type: ChannelType
  messages: InvestorMessage[]
}

export type InvestorPanelJump = {
  panel: Panel
  threadId: string
  phone: string
}

type Props = {
  onJump?: (target: InvestorPanelJump) => void
}

const NAVY = '#0E3470'
const GOLD = 'var(--rp-gold, #FFCC33)'
const GOLD_LITE = 'var(--rp-gold-lite, #FFCC33)'
const BORDER = 'rgba(255, 204, 51, 0.25)'
const TEXT = '#F5EFD8'
const MUTED = '#8C8771'

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function truncate(s: string | null, n: number): string {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function channelLabel(channel: ChannelType, panel: Panel): string {
  if (channel === 'whatsapp') return panel === '718' ? 'WA 718' : 'WA 305'
  if (channel === 'sms') return 'SMS'
  if (channel === 'imessage') return 'iMsg'
  if (channel === 'google_voice') return 'Voice'
  return channel
}

export default function InvestorPanel({ onJump }: Props) {
  const { data, refetch, isLoading, error, isFetching } = useQuery({
    queryKey: ['investor-threads'],
    queryFn: async (): Promise<InvestorGroup[]> => {
      const res = await fetch('/api/whatsapp/investor-threads', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { groups: InvestorGroup[] }
      return json.groups
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  })

  const groups = data || []
  const totalContacts = groups.length
  const totalUnread = groups.reduce(
    (acc, g) => acc + g.messages.filter((m) => m.is_unread).length,
    0
  )

  return (
    <aside
      style={{
        width: '100%',
        height: '100%',
        background: NAVY,
        color: TEXT,
        borderTop: `2px solid ${GOLD}`,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: `1px solid ${BORDER}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <h2 style={{ color: GOLD, fontWeight: 600, fontSize: '1.05rem', margin: 0, letterSpacing: '0.02em' }}>
          Investors
        </h2>
        <span
          style={{
            background: GOLD,
            color: NAVY,
            borderRadius: 999,
            padding: '1px 9px',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {totalContacts}
        </span>
        {totalUnread > 0 && (
          <span style={{ color: GOLD_LITE, fontSize: 11, marginLeft: 'auto' }}>
            {totalUnread} unread
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading && (
          <div style={{ padding: '1rem', color: MUTED, fontSize: 13 }}>Loading investors…</div>
        )}
        {error && (
          <div style={{ padding: '1rem', color: '#FF7474', fontSize: 13 }}>
            Error loading investors.{' '}
            <button
              onClick={() => refetch()}
              style={{
                background: 'none',
                border: 'none',
                color: GOLD,
                cursor: 'pointer',
                textDecoration: 'underline',
                fontFamily: 'inherit',
              }}
            >
              Retry
            </button>
          </div>
        )}
        {!isLoading && !error && groups.length === 0 && (
          <div style={{ padding: '1rem', color: MUTED, fontSize: 13 }}>
            No investor-tagged contacts yet.
          </div>
        )}

        {groups.map((group) => (
          <div
            key={group.phone}
            style={{
              borderBottom: `1px solid ${BORDER}`,
              padding: '0.5rem 0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>
                {group.contact_name || group.phone}
              </span>
              {group.contact_name && (
                <span style={{ fontSize: 11, color: MUTED }}>{group.phone}</span>
              )}
            </div>

            {group.messages.length === 0 && (
              <div style={{ fontSize: 12, color: MUTED, paddingLeft: 4 }}>
                No recent messages.
              </div>
            )}

            {group.messages.map((m) => (
              <button
                key={m.id}
                onClick={() =>
                  onJump?.({ panel: m.panel, threadId: m.thread_id, phone: group.phone })
                }
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px 6px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderLeft: m.is_unread ? `3px solid ${GOLD}` : '3px solid transparent',
                  color: TEXT,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  borderRadius: 4,
                }}
                title={m.body || ''}
              >
                <span
                  style={{
                    background: 'rgba(255, 204, 51, 0.15)',
                    color: GOLD_LITE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 4,
                    padding: '1px 6px',
                    fontSize: 10,
                    fontWeight: 600,
                    flexShrink: 0,
                    letterSpacing: '0.02em',
                  }}
                >
                  {channelLabel(m.channel_type, m.panel)}
                </span>
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: m.is_unread ? TEXT : MUTED,
                  }}
                >
                  {m.direction === 'out' ? '→ ' : ''}
                  {truncate(m.body, 60) || '(attachment)'}
                </span>
                <span style={{ fontSize: 10, color: MUTED, flexShrink: 0 }}>
                  {relativeTime(m.sent_at)}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {isFetching && !isLoading && (
        <div
          style={{
            padding: '0.3rem 0.75rem',
            fontSize: 11,
            color: MUTED,
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          Refreshing…
        </div>
      )}
    </aside>
  )
}
