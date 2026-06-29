'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import QuickEmailModal from '@/components/email/QuickEmailModal'

const REFETCH_MS = 60_000
const HIDDEN_SENDERS_KEY = 'center.inbox.hidden_senders'

const NAVY = '#0E3470'
const GOLD = '#FFCC33'
const TEXT = '#F5EFD8'
const MUTED = '#8C8771'
const WARN = 'var(--c-warn)'
const INVESTOR = 'var(--c-investor)'

type TriageItem = {
  message_id: string
  thread_id: string | null
  gmail_thread_id: string
  gmail_url: string
  from_address: string
  from_name: string
  pipedrive_id: number | null
  subject: string
  score: number
  reasons: string[]
  signals: Record<string, unknown> | null
  received_at: string
  gmail_important: boolean
  unread: boolean
  has_ics: boolean
  scored_at: string
}

type TriageResponse =
  | { account: string; min_score: number; count: number; items: TriageItem[]; error?: undefined }
  | { error: string; message?: string }

function loadHiddenSenders(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(HIDDEN_SENDERS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set(parsed.map((s: string) => String(s).toLowerCase()))
  } catch {
    /* ignore */
  }
  return new Set()
}

function persistHiddenSenders(set: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(HIDDEN_SENDERS_KEY, JSON.stringify(Array.from(set)))
  } catch {
    /* quota or privacy mode — non-fatal */
  }
}

function relativeTime(iso: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const m = Math.round(diff / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function initials(nameOrAddress: string): string {
  const source = nameOrAddress.trim() || '?'
  if (source.includes('@') && !source.includes(' ')) {
    return source.slice(0, 2).toUpperCase()
  }
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function scoreBadgeColor(score: number): string {
  if (score >= 10) return INVESTOR
  return WARN
}

function dispatchOpenWindow(opts: { url: string; title: string }) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('center:open-window', {
      detail: {
        target: 'gmail',
        opts: { url: opts.url, title: opts.title },
      },
    }),
  )
}

async function addToBucket(item: TriageItem): Promise<void> {
  const title = item.subject || `Email from ${item.from_name || item.from_address}`
  // Track B's /api/bucket may not be live yet on this branch; the dispatch
  // says: fall back to inserting via Supabase if it returns 404. v1 here
  // does the simple POST and reports the failure to the user — code2's
  // endpoint will land in a sibling PR.
  const res = await fetch('/api/bucket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      source_url: item.gmail_url,
      source_type: 'email',
      body: `From ${item.from_name || item.from_address}\nScore ${item.score}\n\n${(item.reasons || []).join(' · ')}`,
    }),
  })
  if (!res.ok) {
    throw new Error(`Bucket POST failed: HTTP ${res.status}`)
  }
}

/**
 * useColumnCount — exposes the visible-item count for the kiosk header
 * badge ("Inbox (5)"). Reuses the same React Query key as InboxColumn so
 * the query is shared.
 */
export function useColumnCount(): number {
  const account = 'g@reprime.com'
  const [hiddenSenders] = useState<Set<string>>(() => loadHiddenSenders())
  const { data } = useQuery<TriageResponse>({
    queryKey: ['email-triage', account],
    queryFn: async () => {
      const res = await fetch(
        `/api/email/triage?account=${encodeURIComponent(account)}&limit=20`,
        { cache: 'no-store' },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)
      return json as TriageResponse
    },
    refetchInterval: REFETCH_MS,
  })
  if (!data || 'error' in data) return 0
  return (data.items || []).filter(
    (it) => !hiddenSenders.has((it.from_address || '').toLowerCase()),
  ).length
}

export default function InboxColumn() {
  const qc = useQueryClient()
  const [account, _setAccount] = useState('g@reprime.com')
  const [hiddenSenders, setHiddenSenders] = useState<Set<string>>(() => loadHiddenSenders())
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [composeFor, setComposeFor] = useState<TriageItem | null>(null)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery<TriageResponse>({
    queryKey: ['email-triage', account],
    queryFn: async () => {
      const res = await fetch(`/api/email/triage?account=${encodeURIComponent(account)}&limit=20`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)
      return json as TriageResponse
    },
    refetchInterval: REFETCH_MS,
  })

  const items: TriageItem[] = useMemo(() => {
    if (!data || 'error' in data) return []
    return (data.items || []).filter(
      (it) => !hiddenSenders.has((it.from_address || '').toLowerCase()),
    )
  }, [data, hiddenSenders])

  // Toast auto-clear.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  function hideSender(addr: string) {
    const next = new Set(hiddenSenders)
    next.add(addr.toLowerCase())
    setHiddenSenders(next)
    persistHiddenSenders(next)
    setToast({ kind: 'ok', text: `Hidden: ${addr}` })
  }

  async function onAddToBucket(item: TriageItem) {
    try {
      await addToBucket(item)
      setToast({ kind: 'ok', text: 'Added to Bucket' })
    } catch (err) {
      setToast({ kind: 'err', text: (err as Error).message })
    }
  }

  function openGmailWindow(item: TriageItem) {
    dispatchOpenWindow({
      url: item.gmail_url,
      title: item.subject || `Gmail — ${item.from_name || item.from_address}`,
    })
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        height: '100%',
        minHeight: 0,
        position: 'relative',
        padding: '12px 16px 16px',
        color: TEXT,
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 0 8px',
          borderBottom: '1px solid rgba(255, 204, 51, 0.10)',
        }}
      >
        {/* Account picker — single mailbox in v1, dropdown reserved for v2 multi-account */}
        <select
          value={account}
          onChange={() => {
            /* v1: single mailbox, no other options yet */
          }}
          aria-label="Mailbox"
          style={{
            flex: 1,
            background: 'rgba(14, 52, 112, 0.6)',
            color: TEXT,
            border: '1px solid rgba(255, 204, 51, 0.18)',
            borderRadius: 6,
            padding: '6px 8px',
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        >
          <option value="g@reprime.com">g@reprime.com</option>
        </select>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 204, 51, 0.25)',
            color: GOLD,
            padding: '6px 10px',
            borderRadius: 6,
            cursor: isRefetching ? 'wait' : 'pointer',
            fontSize: 12,
            fontFamily: 'inherit',
          }}
          aria-label="Refresh inbox triage"
          title="Refresh"
        >
          {isRefetching ? '…' : '↻'}
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: 4 }}>
        {isLoading && (
          <div style={{ color: MUTED, fontSize: 13, padding: '8px 4px' }}>Loading inbox…</div>
        )}
        {isError && (
          <div
            style={{
              color: 'var(--c-fail)',
              fontSize: 12,
              padding: '8px 4px',
              lineHeight: 1.4,
            }}
          >
            {(error as Error).message || 'Failed to load.'}
          </div>
        )}
        {!isLoading && !isError && items.length === 0 && (
          <div style={{ padding: '8px 4px' }}>
            <div style={{ color: MUTED, fontSize: 13, marginBottom: 8 }}>
              Inbox is clear. Nothing scoring above 5 today.
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching}
              style={{
                background: 'rgba(255, 204, 51, 0.10)',
                color: GOLD,
                border: `1px solid ${GOLD}`,
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: isRefetching ? 'wait' : 'pointer',
              }}
            >
              {isRefetching ? 'Syncing…' : '↻ Sync now'}
            </button>
          </div>
        )}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((it) => {
            const displayName = it.from_name || it.from_address
            const badgeColor = scoreBadgeColor(it.score)
            return (
              <li
                key={it.message_id}
                onClick={(e) => {
                  // Don't hijack action-menu clicks.
                  if ((e.target as HTMLElement).closest('[data-row-action]')) return
                  openGmailWindow(it)
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: '10px 8px',
                  borderBottom: '1px solid rgba(255, 204, 51, 0.08)',
                  cursor: 'pointer',
                  borderLeft: it.unread ? `3px solid ${GOLD}` : '3px solid transparent',
                  background:
                    openMenuId === it.message_id ? 'rgba(255, 204, 51, 0.06)' : 'transparent',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLLIElement).style.background =
                    'rgba(255, 204, 51, 0.06)')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLLIElement).style.background =
                    openMenuId === it.message_id ? 'rgba(255, 204, 51, 0.06)' : 'transparent')
                }
              >
                <div
                  aria-hidden
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(255, 204, 51, 0.18)',
                    color: GOLD,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                  }}
                >
                  {initials(displayName)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: TEXT,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '60%',
                      }}
                    >
                      {displayName}
                    </span>
                    {it.has_ics && (
                      <span
                        title="Calendar invite"
                        style={{
                          fontSize: 10,
                          color: 'var(--c-live-now)',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                        }}
                      >
                        ICS
                      </span>
                    )}
                    {it.gmail_important && (
                      <span
                        title="Marked important by Gmail"
                        style={{ fontSize: 10, color: GOLD, fontWeight: 700 }}
                      >
                        ★
                      </span>
                    )}
                    <span style={{ flex: 1 }} />
                    <span
                      style={{
                        fontSize: 11,
                        color: MUTED,
                        fontWeight: 400,
                        flexShrink: 0,
                      }}
                    >
                      {relativeTime(it.received_at)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#C9C0A0',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      marginTop: 2,
                    }}
                    title={it.subject}
                  >
                    {it.subject || '(no subject)'}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <span
                    aria-label={`Score ${it.score}`}
                    title={(it.reasons || []).join(' · ')}
                    style={{
                      background: badgeColor,
                      color: NAVY,
                      borderRadius: 10,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      minWidth: 22,
                      textAlign: 'center',
                    }}
                  >
                    {it.score}
                  </span>
                  <button
                    data-row-action
                    aria-haspopup="menu"
                    aria-expanded={openMenuId === it.message_id}
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMenuId(openMenuId === it.message_id ? null : it.message_id)
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 204, 51, 0.25)',
                      color: GOLD,
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    ⋯
                  </button>
                </div>
                {openMenuId === it.message_id && (
                  <div
                    data-row-action
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      gridColumn: '1 / -1',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      paddingTop: 8,
                    }}
                  >
                    <ActionBtn
                      onClick={async () => {
                        await onAddToBucket(it)
                        setOpenMenuId(null)
                      }}
                    >
                      Add to Bucket
                    </ActionBtn>
                    <ActionBtn
                      onClick={() => {
                        openGmailWindow(it)
                        setOpenMenuId(null)
                      }}
                    >
                      Open in Gmail
                    </ActionBtn>
                    <ActionBtn
                      onClick={() => {
                        setComposeFor(it)
                        setOpenMenuId(null)
                      }}
                    >
                      Reply
                    </ActionBtn>
                    <ActionBtn
                      onClick={() => {
                        if (it.from_address) hideSender(it.from_address)
                        setOpenMenuId(null)
                      }}
                    >
                      Hide sender
                    </ActionBtn>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {hiddenSenders.size > 0 && (
          <button
            onClick={() => {
              setHiddenSenders(new Set())
              persistHiddenSenders(new Set())
              qc.invalidateQueries({ queryKey: ['email-triage'] })
            }}
            style={{
              marginTop: 10,
              background: 'transparent',
              color: MUTED,
              border: '1px solid rgba(255, 204, 51, 0.18)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Reset {hiddenSenders.size} hidden sender{hiddenSenders.size === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {toast && (
        <div
          role="status"
          style={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            background: toast.kind === 'ok' ? 'rgba(37, 211, 102, 0.16)' : 'rgba(239, 68, 68, 0.16)',
            color: toast.kind === 'ok' ? '#9DEABE' : '#FFB4B4',
            border: `1px solid ${toast.kind === 'ok' ? 'rgba(37, 211, 102, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            zIndex: 30,
            fontFamily: 'inherit',
          }}
        >
          {toast.text}
        </div>
      )}

      <QuickEmailModal
        open={composeFor !== null}
        onClose={() => setComposeFor(null)}
        initialTo={composeFor?.from_address || ''}
        initialSubject={composeFor ? `Re: ${composeFor.subject}` : ''}
        initialBody=""
      />
    </div>
  )
}

function ActionBtn({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void | Promise<void>
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'rgba(255, 204, 51, 0.10)',
        color: '#F5EFD8',
        border: '1px solid rgba(255, 204, 51, 0.25)',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}
