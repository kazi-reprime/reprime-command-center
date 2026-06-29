'use client'

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import SpeakerButton from '@/components/chat/SpeakerButton'
import {
  SuggestedFocusSection,
  type SuggestedFocusItem,
} from '@/components/center/SuggestedFocus'

type Props = {
  open: boolean
  mode?: 'morning' | 'evening'
  onClose: () => void
  /** Optional thread-click handler — caller decides how to navigate. */
  onThreadClick?: (thread: BriefingThread) => void
}

interface BriefingMeeting {
  id: string
  title: string
  startTime: string
  zoomLink: string | null
}

interface BriefingThread {
  id: string
  contact_name: string | null
  phone: string | null
  panel: string | null
  channel_type: string | null
  is_investor: boolean
  unread_count: number
  last_message_at: string | null
  last_message_preview: string | null
}

interface ExpiringInv {
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
  recent_investors: BriefingThread[]
  expiring_invitations: { count: number; items: ExpiringInv[] }
  pending_followups: BriefingThread[]
  tenant_filings_today?: TenantFiling[]
  suggested_focus?: SuggestedFocusItem[]
}

interface EveningItem {
  id: string
  who: string
  detail: string
}

interface EveningResponse {
  date: string
  greeting: string
  handled: { replies_closed_today: number; meetings_today: number }
  open: {
    unread_total: number
    overdue_followups: number
    open_tasks: number
    expiring_invitations: number
  }
  loose_ends: EveningItem[]
  degraded?: boolean
}

const NAVY = '#0E3470'
const GOLD = '#FFCC33'
const TEXT = '#F5EFD8'
const MUTED = '#8C8771'

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function buildNarrative(d: BriefingPayload): string {
  const parts: string[] = []
  if (d.meetings.count === 0) {
    parts.push('No meetings today.')
  } else {
    const first = d.meetings.first
    const time = first ? formatTime(first.startTime) : ''
    const noun = d.meetings.count === 1 ? 'meeting' : 'meetings'
    parts.push(`${d.meetings.count} ${noun} today${first ? `, first at ${time}` : ''}.`)
  }
  if (d.unread.total > 0) {
    const inv = d.unread.by_panel.investors
    parts.push(`${d.unread.total} unread${inv > 0 ? ` — ${inv} from investors` : ''}.`)
  } else {
    parts.push('Inbox is clear.')
  }
  if (d.expiring_invitations.count > 0) {
    const noun = d.expiring_invitations.count === 1 ? 'invite expires' : 'invites expire'
    parts.push(`${d.expiring_invitations.count} ${noun} within 24 hours.`)
  }
  if (d.recent_investors.length > 0) {
    const top = d.recent_investors[0]
    const name = top.contact_name || 'an investor'
    parts.push(`Most recent investor message: ${name}.`)
  }
  return parts.join(' ')
}

function buildEveningNarrative(d: EveningResponse): string {
  const parts: string[] = []
  parts.push(d.greeting)
  if (d.handled.meetings_today > 0 || d.handled.replies_closed_today > 0) {
    parts.push(`You completed ${d.handled.meetings_today} meetings and resolved ${d.handled.replies_closed_today} items today.`)
  }
  if (d.open.unread_total > 0) {
    parts.push(`You have ${d.open.unread_total} unread messages remaining.`)
  } else {
    parts.push('Inbox is totally clear.')
  }
  return parts.join(' ')
}

function formatRelative(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diffMs = d.getTime() - Date.now()
  const min = Math.round(diffMs / 60_000)
  if (Math.abs(min) < 1) return 'now'
  if (min < 0) {
    const a = -min
    if (a < 60) return `${a}m ago`
    if (a < 1440) return `${Math.round(a / 60)}h ago`
    return `${Math.round(a / 1440)}d ago`
  } else {
    if (min < 60) return `in ${min}m`
    if (min < 1440) return `in ${Math.round(min / 60)}h`
    return `in ${Math.round(min / 1440)}d`
  }
}

export default function BriefingModal({ open, mode = 'morning', onClose, onThreadClick }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const { data, isLoading, isError } = useQuery<BriefingPayload | EveningResponse>({
    queryKey: ['briefing', mode],
    queryFn: async () => {
      const endpoint = mode === 'evening' ? '/api/briefing/evening' : '/api/briefing/today'
      const res = await fetch(endpoint, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    },
    enabled: open,
    staleTime: 60_000,
  })

  const narrative = useMemo(() => {
    if (!data) return ''
    if (mode === 'evening') return buildEveningNarrative(data as EveningResponse)
    return buildNarrative(data as BriefingPayload)
  }, [data, mode])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(7, 16, 30, 0.78)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 9000,
        padding: '6vh 1rem 1rem',
      }}
    >
      <div
        style={{
          background: NAVY,
          border: `1px solid ${GOLD}55`,
          width: '100%',
          maxWidth: 720,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'inherit',
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${GOLD}33`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: GOLD, fontSize: 14, fontWeight: 700, letterSpacing: '0.06em' }}>
              {mode === 'morning' ? '☀ Morning Briefing' : '🌙 Evening Briefing'}
            </div>
            {data && <div style={{ color: MUTED, fontSize: 11, marginTop: 2, letterSpacing: '0.04em' }}>{data.date}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={escBtn}>ESC</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          {isLoading && <div style={msg}>Loading…</div>}
          {isError && <div style={{ ...msg, color: '#FF7474' }}>Briefing failed to load.</div>}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Narrative summary + Listen */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(255, 204, 51, 0.06)', border: `1px solid ${GOLD}33`, padding: '12px 14px' }}>
                <div style={{ flex: 1, color: TEXT, fontSize: 14, lineHeight: 1.55 }}>
                  {narrative}
                </div>
                <div style={{ flexShrink: 0 }}>
                  <SpeakerButton text={narrative} />
                </div>
              </div>

              {/* Content specific to morning vs evening */}
              {mode === 'morning' ? (
                <>
                  {/* Stat row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <Stat
                      label="Meetings"
                      value={String((data as BriefingPayload).meetings.count)}
                      sub={(data as BriefingPayload).meetings.nextUp ? `Next: ${formatTime((data as BriefingPayload).meetings.nextUp!.startTime)}` : ((data as BriefingPayload).meetings.first ? `First: ${formatTime((data as BriefingPayload).meetings.first!.startTime)}` : 'None')}
                      accent={GOLD}
                    />
                    <Stat
                      label="Unread"
                      value={String((data as BriefingPayload).unread.total)}
                      sub={`305:${(data as BriefingPayload).unread.by_panel['305']} · 718:${(data as BriefingPayload).unread.by_panel['718']} · Inv:${(data as BriefingPayload).unread.by_panel.investors}`}
                      accent={(data as BriefingPayload).unread.by_panel.investors > 0 ? '#FFCC33' : '#25D366'}
                    />
                    <Stat
                      label="Expiring"
                      value={String((data as BriefingPayload).expiring_invitations.count)}
                      sub="Invites within 24h"
                      accent={(data as BriefingPayload).expiring_invitations.count > 0 ? '#F59E0B' : '#25D366'}
                    />
                  </div>

                  {/* Suggested focus */}
                  {((data as BriefingPayload).suggested_focus?.length ?? 0) > 0 && (
                    <SuggestedFocusSection items={(data as BriefingPayload).suggested_focus ?? []} />
                  )}

                  {/* Today's meetings */}
                  {(data as BriefingPayload).meetings.items.length > 0 && (
                    <Section title="Today's Calendar">
                      {(data as BriefingPayload).meetings.items.map((m) => {
                        const isNext = m.id === (data as BriefingPayload).meetings.nextUp?.id
                        return (
                          <Row
                            key={m.id}
                            left={
                              <div>
                                <div style={{ color: TEXT, fontSize: 13, fontWeight: isNext ? 700 : 500 }}>
                                  {formatTime(m.startTime)} {isNext && <span style={{ color: GOLD, marginLeft: 6 }}>← next</span>}
                                </div>
                                <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{m.title}</div>
                              </div>
                            }
                            right={m.zoomLink ? <a href={m.zoomLink} target="_blank" rel="noopener noreferrer" style={zoomLink}>Zoom ↗</a> : null}
                          />
                        )
                      })}
                    </Section>
                  )}

                  {/* Recent investor activity */}
                  {(data as BriefingPayload).recent_investors.length > 0 && (
                    <Section title="Recent Investor Activity (24h)">
                      {(data as BriefingPayload).recent_investors.map((t) => (
                        <Row
                          key={t.id}
                          onClick={onThreadClick ? () => { onThreadClick(t as BriefingThread); onClose() } : undefined}
                          left={
                            <div>
                              <div style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>
                                {t.contact_name || t.phone || 'Unknown'}
                                <span style={{ color: GOLD, marginLeft: 6 }}>★</span>
                              </div>
                              <div style={{ color: MUTED, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.last_message_preview || '(no preview)'}
                              </div>
                            </div>
                          }
                          right={
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ color: MUTED, fontSize: 11 }}>{formatRelative(t.last_message_at)}</div>
                              {t.unread_count > 0 && <div style={unreadPill}>{t.unread_count}</div>}
                            </div>
                          }
                        />
                      ))}
                    </Section>
                  )}

                  {/* Pending follow-ups */}
                  {(data as BriefingPayload).pending_followups.length > 0 && (
                    <Section title="Needs a Reply">
                      {(data as BriefingPayload).pending_followups.map((t) => (
                        <Row
                          key={t.id}
                          onClick={onThreadClick ? () => { onThreadClick(t as BriefingThread); onClose() } : undefined}
                          left={
                            <div>
                              <div style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>
                                {t.contact_name || t.phone || 'Unknown'}
                                {t.is_investor && <span style={{ color: GOLD, marginLeft: 6 }}>★</span>}
                              </div>
                              <div style={{ color: MUTED, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.last_message_preview || '(no preview)'}
                              </div>
                            </div>
                          }
                          right={
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ color: MUTED, fontSize: 11 }}>{formatRelative(t.last_message_at)}</div>
                              <div style={unreadPill}>{t.unread_count}</div>
                            </div>
                          }
                        />
                      ))}
                    </Section>
                  )}

                  {/* New tenant filings */}
                  {((data as BriefingPayload).tenant_filings_today?.length ?? 0) > 0 && (
                    <Section title="New Tenant Filings (today)">
                      {((data as BriefingPayload).tenant_filings_today ?? []).map((f) => (
                        <Row
                          key={f.case_no}
                          left={
                            <div>
                              <div style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>
                                {f.tenant}
                              </div>
                              <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
                                {f.case_no}
                                {f.court ? ` · ${f.court}` : ''}
                              </div>
                            </div>
                          }
                          right={
                            <div style={{ textAlign: 'right' }}>
                              {f.filed_at && (
                                <div style={{ color: MUTED, fontSize: 11 }}>filed {f.filed_at}</div>
                              )}
                            </div>
                          }
                        />
                      ))}
                    </Section>
                  )}

                  {/* Expiring invitations */}
                  {(data as BriefingPayload).expiring_invitations.items.length > 0 && (
                    <Section title="Expiring Invitations">
                      {(data as BriefingPayload).expiring_invitations.items.map((inv) => (
                        <Row
                          key={inv.id}
                          left={
                            <div>
                              <div style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>
                                {inv.contact_name || inv.contact_email || 'Unknown'}
                              </div>
                              {inv.contact_email && (
                                <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{inv.contact_email}</div>
                              )}
                            </div>
                          }
                          right={<div style={{ color: '#FFB400', fontSize: 11 }}>expires {formatRelative(inv.expires_at)}</div>}
                        />
                      ))}
                    </Section>
                  )}
                  
                  {(data as BriefingPayload).meetings.count === 0 &&
                    (data as BriefingPayload).recent_investors.length === 0 &&
                    (data as BriefingPayload).pending_followups.length === 0 &&
                    (data as BriefingPayload).expiring_invitations.count === 0 &&
                    ((data as BriefingPayload).tenant_filings_today?.length ?? 0) === 0 && (
                      <div style={{ ...msg, padding: '48px 0' }}>Nothing pending. Quiet morning.</div>
                    )}
                </>
              ) : (
                <>
                  {/* Evening Mode */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    <Stat
                      label="Handled"
                      value={String((data as EveningResponse).handled.replies_closed_today + (data as EveningResponse).handled.meetings_today)}
                      sub={`${(data as EveningResponse).handled.replies_closed_today} replies, ${(data as EveningResponse).handled.meetings_today} meetings`}
                      accent={'#25D366'}
                    />
                    <Stat
                      label="Pending"
                      value={String((data as EveningResponse).open.unread_total + (data as EveningResponse).open.overdue_followups + (data as EveningResponse).open.open_tasks)}
                      sub={`${(data as EveningResponse).open.unread_total} unread, ${(data as EveningResponse).open.open_tasks} tasks`}
                      accent={(data as EveningResponse).open.unread_total > 0 ? '#F59E0B' : '#FFCC33'}
                    />
                  </div>

                  {/* Loose ends */}
                  {(data as EveningResponse).loose_ends.length > 0 && (
                    <Section title="Loose Ends Awaiting Action">
                      {(data as EveningResponse).loose_ends.map((item) => (
                        <Row
                          key={item.id}
                          left={
                            <div>
                              <div style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>
                                {item.who}
                              </div>
                              <div style={{ color: MUTED, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.detail}
                              </div>
                            </div>
                          }
                          right={null}
                        />
                      ))}
                    </Section>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 20px', borderTop: `1px solid ${GOLD}22`, fontSize: 10, color: MUTED, letterSpacing: '0.06em', display: 'flex', justifyContent: 'space-between' }}>
          <span>Auto-refreshes every minute</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, accent = GOLD }: { label: string; value: string; sub: string; accent?: string }) {
  return (
    <div style={{ background: 'rgba(255, 204, 51, 0.04)', border: `1px solid ${accent}55`, borderLeft: `3px solid ${accent}`, padding: '10px 12px' }}>
      <div style={{ color: accent, fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: TEXT, fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
      <div style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  )
}

function Row({ left, right, onClick }: { left: React.ReactNode; right: React.ReactNode; onClick?: () => void }) {
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 6px',
    borderBottom: `1px solid ${GOLD}11`,
    gap: 12,
    minWidth: 0,
    cursor: onClick ? 'pointer' : 'default',
    borderRadius: onClick ? 4 : 0,
    transition: 'background 0.15s',
  }
  if (!onClick) {
    return (
      <div style={baseStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>{left}</div>
        <div style={{ flexShrink: 0 }}>{right}</div>
      </div>
    )
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${GOLD}10` }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      style={baseStyle}
    >
      <div style={{ flex: 1, minWidth: 0 }}>{left}</div>
      <div style={{ flexShrink: 0 }}>{right}</div>
    </div>
  )
}

const escBtn: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${GOLD}55`,
  color: GOLD,
  padding: '4px 10px',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '0.10em',
}

const msg: React.CSSProperties = {
  textAlign: 'center',
  color: MUTED,
  fontSize: 13,
  padding: '32px 16px',
}

const zoomLink: React.CSSProperties = {
  color: GOLD,
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: '0.04em',
}

const unreadPill: React.CSSProperties = {
  display: 'inline-block',
  background: '#ef4444',
  color: '#fff',
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 6px',
  marginTop: 2,
  borderRadius: 8,
}
