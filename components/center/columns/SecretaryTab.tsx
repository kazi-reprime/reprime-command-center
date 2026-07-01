'use client'

import { useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'

const REFETCH_MS = 60_000
const NAME_STALE_MS = 60 * 60_000 // 1h — Pipedrive resolve is server-cached at 1h too

// ── Pipedrive name resolution ────────────────────────────────────────────────

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function isE164Phone(s: string): boolean {
  return /^\+\d{8,15}$/.test(s)
}

type ResolvedName = string | null

type ResolveResponse = {
  person?: { id: number; name?: string | null } | null
}

async function fetchPipedriveName(identifier: string): Promise<ResolvedName> {
  const param = isEmail(identifier)
    ? `email=${encodeURIComponent(identifier)}`
    : isE164Phone(identifier)
      ? `phone=${encodeURIComponent(identifier)}`
      : null
  if (!param) return null
  const res = await fetch(`/api/pipedrive/resolve?${param}`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json()) as ResolveResponse
  return data.person?.name?.trim() || null
}

function useResolvedNames(identifiers: string[]): Map<string, ResolvedName> {
  // Dedupe and only resolve email + E.164 phones; everything else stays raw.
  const targets = useMemo(() => {
    const set = new Set<string>()
    for (const id of identifiers) {
      if (isEmail(id) || isE164Phone(id)) set.add(id)
    }
    return Array.from(set)
  }, [identifiers])

  const queries = useQueries({
    queries: targets.map((identifier) => ({
      queryKey: ['secretary', 'pipedrive-name', identifier],
      queryFn: () => fetchPipedriveName(identifier),
      staleTime: NAME_STALE_MS,
      gcTime: NAME_STALE_MS,
      retry: false,
    })),
  })

  return useMemo(() => {
    const map = new Map<string, ResolvedName>()
    targets.forEach((id, i) => {
      map.set(id, queries[i]?.data ?? null)
    })
    return map
  }, [targets, queries])
}

// ── Types ────────────────────────────────────────────────────────────────────

type OutboundAskChannel = 'email' | 'whatsapp' | 'imessage' | 'sms'

interface OutboundAsk {
  id: string
  sender_identity: string
  recipient_identifier: string
  channel: OutboundAskChannel
  body: string | null
  sent_at: string
  expected_reply_by: string
  status: 'open' | 'replied' | 'closed_no_reply' | 'snoozed'
  related_thread_id: string | null
  reminded_at: string | null
  closed_at: string | null
}

interface AsksPayload {
  awaiting: OutboundAsk[]
  overdue: OutboundAsk[]
  replied_recent: OutboundAsk[]
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

function formatRelativeFuture(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = d.getTime() - Date.now()
  const past = diffMs < 0
  const absMin = Math.round(Math.abs(diffMs) / 60_000)
  if (absMin < 60) return past ? `${absMin}m overdue` : `in ${absMin}m`
  const absHr = Math.round(absMin / 60)
  if (absHr < 48) return past ? `${absHr}h overdue` : `in ${absHr}h`
  const absDay = Math.round(absHr / 24)
  return past ? `${absDay}d overdue` : `in ${absDay}d`
}

function clipPreview(body: string | null, max = 90): string {
  if (!body) return ''
  const trimmed = body.replace(/\s+/g, ' ').trim()
  return trimmed.length > max ? trimmed.slice(0, max - 1) + '…' : trimmed
}

function initials(identifier: string): string {
  // Email: take chars before @, split on dots / underscores
  const localPart = identifier.includes('@') ? identifier.split('@')[0] : identifier
  const parts = localPart.replace(/\+\d+/, '').split(/[.\-_\s]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const CHANNEL_COLOR: Record<OutboundAskChannel, string> = {
  email: 'var(--rp-gold)',
  whatsapp: 'var(--c-channel-718)',
  imessage: 'var(--c-channel-imsg)',
  sms: 'var(--c-channel-sms)',
}

const CHANNEL_LABEL: Record<OutboundAskChannel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  imessage: 'iMessage',
  sms: 'SMS',
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

function AskRow({
  ask,
  overdue,
  resolvedName,
}: {
  ask: OutboundAsk
  overdue?: boolean
  resolvedName?: ResolvedName
}) {
  const accent = CHANNEL_COLOR[ask.channel]
  const sentAgo = formatRelativePast(ask.sent_at)
  const expected = formatRelativeFuture(ask.expected_reply_by)
  const replied = ask.status === 'replied'
  const expectedColor = replied
    ? 'var(--c-channel-718)'
    : overdue
      ? 'var(--c-fail)'
      : 'var(--rp-gold-lite)'

  const onClick = () => {
    if (ask.related_thread_id) {
      // Reuse the existing investor/chat panel listener wired in the kiosk.
      window.dispatchEvent(
        new CustomEvent('open-thread', {
          detail: { thread_id: ask.related_thread_id, channel: ask.channel },
        })
      )
    }
  }

  return (
    <div
      role={ask.related_thread_id ? 'button' : undefined}
      tabIndex={ask.related_thread_id ? 0 : undefined}
      onClick={ask.related_thread_id ? onClick : undefined}
      onKeyDown={
        ask.related_thread_id
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      style={{
        background: 'var(--rp-surface)',
        border: '1px solid var(--rp-border)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 6,
        padding: '0.55rem 0.75rem',
        marginBottom: 6,
        fontSize: 13,
        color: 'var(--rp-white)',
        cursor: ask.related_thread_id ? 'pointer' : 'default',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'rgba(255, 204, 51, 0.10)',
          color: accent,
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {initials(ask.recipient_identifier)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <span
            style={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={
              resolvedName
                ? `${resolvedName} — ${ask.recipient_identifier}`
                : ask.recipient_identifier
            }
          >
            {resolvedName ? (
              <>
                {resolvedName}
                <span
                  style={{
                    color: 'var(--rp-gold-lite)',
                    fontWeight: 400,
                    opacity: 0.7,
                  }}
                >
                  {' — '}
                  {ask.recipient_identifier}
                </span>
              </>
            ) : (
              ask.recipient_identifier
            )}
          </span>
          <span
            aria-label={`channel ${CHANNEL_LABEL[ask.channel]}`}
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: accent,
              border: `1px solid ${accent}`,
              borderRadius: 4,
              padding: '1px 6px',
              flexShrink: 0,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            {CHANNEL_LABEL[ask.channel]}
          </span>
        </div>

        {ask.body && (
          <div
            style={{
              color: 'var(--rp-gold-lite)',
              fontSize: 12,
              marginTop: 3,
              opacity: 0.9,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={ask.body}
          >
            {clipPreview(ask.body)}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 4,
            fontSize: 11,
          }}
        >
          <span style={{ color: 'var(--rp-gold-lite)', opacity: 0.75 }}>
            sent {sentAgo}
          </span>
          <span style={{ color: expectedColor, fontWeight: 600 }}>
            {replied ? `replied ${formatRelativePast(ask.closed_at)}` : expected}
          </span>
        </div>
      </div>
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <div style={{ color: 'var(--rp-gold-lite)', fontSize: 12 }}>{text}</div>
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * SecretaryTab — outbound-ask tracker.
 *
 * Lives inside the future "sidekick" column tab. Until that column ships, the
 * component is also mountable standalone (e.g. inside any column body) — it
 * owns its own scroll and refetch.
 *
 * Sections (top-down):
 *   1. Overdue          — open asks past expected_reply_by (red expected pill)
 *   2. Awaiting Reply   — open asks still inside the reply window
 *   3. Replied This Week — closed asks with closed_at < 7d
 *
 * Auto-refreshes every 60s. Click a row with a related_thread_id to dispatch
 * `open-thread` so the parent dashboard surfaces the original conversation.
 */
export default function SecretaryTab() {
  const asks = useQuery({
    queryKey: ['secretary', 'asks'],
    queryFn: async (): Promise<AsksPayload> => {
      const res = await fetch('/api/secretary/asks', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as AsksPayload
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })

  const [showRepliedAll, setShowRepliedAll] = useState(false)

  const overdue = useMemo(() => asks.data?.overdue ?? [], [asks.data?.overdue])
  const awaiting = useMemo(() => asks.data?.awaiting ?? [], [asks.data?.awaiting])
  const repliedRecent = useMemo(() => asks.data?.replied_recent ?? [], [asks.data?.replied_recent])

  const repliedToShow = useMemo(() => {
    return showRepliedAll ? repliedRecent : repliedRecent.slice(0, 5)
  }, [repliedRecent, showRepliedAll])

  // Collect identifiers across all sections so each unique recipient is
  // resolved once. Pipedrive lookup runs in parallel and never blocks the
  // initial render — rows show the raw identifier first, then the name
  // appears as the query resolves.
  const allIdentifiers = useMemo(() => {
    const ids: string[] = []
    for (const a of overdue) ids.push(a.recipient_identifier)
    for (const a of awaiting) ids.push(a.recipient_identifier)
    for (const a of repliedRecent) ids.push(a.recipient_identifier)
    return ids
  }, [overdue, awaiting, repliedRecent])

  const nameMap = useResolvedNames(allIdentifiers)

  return (
    <div
      data-component="secretary-tab"
      style={{
        background: 'var(--rp-navy)',
        color: 'var(--rp-white)',
        height: '100%',
        overflowY: 'auto',
        fontFamily: 'inherit',
      }}
    >
      {/* 1. Overdue — only renders when there's something to fix */}
      {overdue.length > 0 && (
        <section style={sectionStyle} data-section="overdue">
          <div style={sectionLabel}>
            <span>Overdue</span>
            <span style={sectionCount}>{overdue.length}</span>
          </div>
          {overdue.map((ask) => (
            <AskRow
              key={ask.id}
              ask={ask}
              overdue
              resolvedName={nameMap.get(ask.recipient_identifier) ?? null}
            />
          ))}
        </section>
      )}

      {/* 2. Awaiting Reply */}
      <section style={sectionStyle} data-section="awaiting">
        <div style={sectionLabel}>
          <span>Awaiting Reply</span>
          <span style={sectionCount}>{awaiting.length}</span>
        </div>
        {asks.isLoading && <EmptyHint text="Loading…" />}
        {asks.isError && (
          <div style={{ color: 'var(--c-fail)', fontSize: 12 }}>
            Failed: {(asks.error as Error).message}
          </div>
        )}
        {!asks.isLoading && !asks.isError && awaiting.length === 0 && (
          <EmptyHint text="Nothing waiting on a reply." />
        )}
        {awaiting.map((ask) => (
          <AskRow
            key={ask.id}
            ask={ask}
            resolvedName={nameMap.get(ask.recipient_identifier) ?? null}
          />
        ))}
      </section>

      {/* 3. Replied This Week */}
      <section
        style={{ ...sectionStyle, borderBottom: 'none' }}
        data-section="replied"
      >
        <div style={sectionLabel}>
          <span>Replied This Week</span>
          <span style={sectionCount}>{repliedRecent.length}</span>
        </div>
        {!asks.isLoading && repliedRecent.length === 0 && (
          <EmptyHint text="No replies yet this week." />
        )}
        {repliedToShow.map((ask) => (
          <AskRow
            key={ask.id}
            ask={ask}
            resolvedName={nameMap.get(ask.recipient_identifier) ?? null}
          />
        ))}
        {repliedRecent.length > 5 && (
          <button
            type="button"
            onClick={() => setShowRepliedAll((v) => !v)}
            style={{
              marginTop: 4,
              background: 'transparent',
              color: 'var(--rp-gold)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              padding: 0,
            }}
          >
            {showRepliedAll
              ? 'Show fewer'
              : `Show all ${repliedRecent.length}`}
          </button>
        )}
      </section>
    </div>
  )
}
