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
  email: 'border-l-blue-500 text-accent bg-accent/10',
  whatsapp: 'border-l-emerald-500 text-success bg-success/10',
  imessage: 'border-l-indigo-500 text-accent bg-accent/10',
  sms: 'border-l-purple-500 text-purple-600 bg-purple-50',
}

const CHANNEL_LABEL: Record<OutboundAskChannel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  imessage: 'iMessage',
  sms: 'SMS',
}

// ── Visual primitives ────────────────────────────────────────────────────────

function AskRow({
  ask,
  overdue,
  resolvedName,
}: {
  ask: OutboundAsk
  overdue?: boolean
  resolvedName?: ResolvedName
}) {
  const channelClasses = CHANNEL_COLOR[ask.channel]
  const sentAgo = formatRelativePast(ask.sent_at)
  const expected = formatRelativeFuture(ask.expected_reply_by)
  const replied = ask.status === 'replied'
  const expectedColor = replied
    ? 'text-success'
    : overdue
      ? 'text-error'
      : 'text-text-muted'

  const onClick = () => {
    if (ask.related_thread_id) {
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
      className={`flex items-start gap-3 p-3 mb-2 rounded-xl bg-surface-raised border border-border border-l-4 shadow-sm ${channelClasses.split(' ')[0]} ${ask.related_thread_id ? 'cursor-pointer hover:bg-surface-raised hover:border-border transition-colors' : ''}`}
    >
      <div
        aria-hidden
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${channelClasses.split(' ').slice(1).join(' ')}`}
      >
        {initials(ask.recipient_identifier)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-2">
          <span
            className="font-bold text-text-primary truncate text-sm"
            title={
              resolvedName
                ? `${resolvedName} — ${ask.recipient_identifier}`
                : ask.recipient_identifier
            }
          >
            {resolvedName ? (
              <>
                {resolvedName}
                <span className="text-text-muted font-normal ml-1">
                  — {ask.recipient_identifier}
                </span>
              </>
            ) : (
              ask.recipient_identifier
            )}
          </span>
          <span
            aria-label={`channel ${CHANNEL_LABEL[ask.channel]}`}
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${channelClasses.split(' ').slice(1).join(' ')}`}
          >
            {CHANNEL_LABEL[ask.channel]}
          </span>
        </div>

        {ask.body && (
          <div
            className="text-text-secondary text-xs mt-1 truncate"
            title={ask.body}
          >
            {clipPreview(ask.body)}
          </div>
        )}

        <div className="flex justify-between gap-2 mt-2 text-[10px] font-bold uppercase tracking-wider">
          <span className="text-text-muted">
            sent {sentAgo}
          </span>
          <span className={expectedColor}>
            {replied ? `replied ${formatRelativePast(ask.closed_at)}` : expected}
          </span>
        </div>
      </div>
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <div className="text-text-muted text-xs font-semibold">{text}</div>
}

// ── Component ────────────────────────────────────────────────────────────────

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
      className="bg-surface text-text-primary h-full overflow-y-auto"
    >
      {/* 1. Overdue */}
      {overdue.length > 0 && (
        <section className="px-4 py-4 border-b border-border" data-section="overdue">
          <div className="flex justify-between items-baseline gap-2 mb-3">
            <span className="text-error text-xs font-black uppercase tracking-widest">Overdue</span>
            <span className="text-text-muted text-xs font-bold">{overdue.length}</span>
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
      <section className="px-4 py-4 border-b border-border" data-section="awaiting">
        <div className="flex justify-between items-baseline gap-2 mb-3">
          <span className="text-accent text-xs font-black uppercase tracking-widest">Awaiting Reply</span>
          <span className="text-text-muted text-xs font-bold">{awaiting.length}</span>
        </div>
        {asks.isLoading && <EmptyHint text="Loading…" />}
        {asks.isError && (
          <div className="text-error text-xs font-semibold">
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
        className="px-4 py-4"
        data-section="replied"
      >
        <div className="flex justify-between items-baseline gap-2 mb-3">
          <span className="text-success text-xs font-black uppercase tracking-widest">Replied This Week</span>
          <span className="text-text-muted text-xs font-bold">{repliedRecent.length}</span>
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
            className="mt-2 text-accent hover:text-accent text-[10px] font-bold uppercase tracking-wider cursor-pointer"
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
