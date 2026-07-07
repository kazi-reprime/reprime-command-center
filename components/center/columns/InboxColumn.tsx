'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import QuickEmailModal from '@/components/email/QuickEmailModal'

const REFETCH_MS = 60_000
const HIDDEN_SENDERS_KEY = 'center.inbox.hidden_senders'

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

function scoreBadgeClass(score: number): string {
  if (score >= 10) return 'bg-purple-100 text-purple-700'
  return 'bg-amber-100 text-warning'
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
  const [account] = useState('g@reprime.com')
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
    <div className="flex flex-col h-full bg-surface text-text-primary font-sans relative">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <select
          value={account}
          onChange={() => {}}
          aria-label="Mailbox"
          className="flex-1 bg-surface-raised text-text-primary border border-border rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-focus transition-all cursor-pointer"
        >
          <option value="g@reprime.com">g@reprime.com</option>
        </select>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="bg-surface border border-border hover:bg-surface-raised text-text-secondary rounded-lg px-3 py-1.5 text-xs cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
          aria-label="Refresh inbox triage"
          title="Refresh"
        >
          {isRefetching ? '…' : '↻'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pt-2 px-4 pb-4">
        {isLoading && (
          <div className="text-text-muted text-xs font-bold p-2">Loading inbox…</div>
        )}
        {isError && (
          <div className="text-error text-xs font-bold p-2 bg-error/10 rounded-lg border border-error/20 shadow-sm mt-2">
            {(error as Error).message || 'Failed to load.'}
          </div>
        )}
        {!isLoading && !isError && items.length === 0 && (
          <div className="p-2 mt-2">
            <div className="text-text-secondary text-sm font-bold mb-4">
              Inbox is clear. Nothing scoring above 5 today.
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="bg-accent/10 text-accent border border-blue-200 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest shadow-sm hover:bg-accent/20 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isRefetching ? 'Syncing…' : '↻ Sync now'}
            </button>
          </div>
        )}
        
        <ul className="list-none m-0 p-0 flex flex-col gap-2 mt-2">
          {items.map((it) => {
            const displayName = it.from_name || it.from_address
            const badgeClass = scoreBadgeClass(it.score)
            return (
              <li
                key={it.message_id}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('[data-row-action]')) return
                  openGmailWindow(it)
                }}
                className={`grid grid-cols-[32px_1fr_auto] gap-3 items-center p-3 rounded-xl border transition-all cursor-pointer shadow-sm ${
                  it.unread ? 'border-l-4 border-l-blue-500 bg-accent/10/30' : 'border-l-4 border-l-transparent bg-surface-raised hover:bg-surface'
                } border-border ${openMenuId === it.message_id ? 'bg-surface shadow-md border-blue-200' : ''}`}
              >
                <div
                  aria-hidden
                  className="w-8 h-8 rounded-full bg-accent/20 text-accent-hover flex items-center justify-center text-xs font-black tracking-wider"
                >
                  {initials(displayName)}
                </div>
                
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold text-text-primary truncate">
                    <span className="shrink-0 truncate max-w-[60%]">
                      {displayName}
                    </span>
                    {it.has_ics && (
                      <span title="Calendar invite" className="text-[9px] font-black uppercase tracking-widest text-success bg-emerald-100 px-1.5 py-0.5 rounded-md">
                        ICS
                      </span>
                    )}
                    {it.gmail_important && (
                      <span title="Marked important by Gmail" className="text-warning text-xs">
                        ★
                      </span>
                    )}
                    <span className="flex-1" />
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider shrink-0">
                      {relativeTime(it.received_at)}
                    </span>
                  </div>
                  
                  <div className="text-xs text-text-secondary font-medium truncate mt-1" title={it.subject}>
                    {it.subject || '(no subject)'}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    aria-label={`Score ${it.score}`}
                    title={(it.reasons || []).join(' · ')}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black text-center min-w-[24px] tracking-wider ${badgeClass}`}
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
                    className="bg-transparent border-none text-text-muted hover:text-text-primary hover:bg-surface-hover rounded p-1 text-lg leading-none cursor-pointer transition-colors"
                  >
                    ⋯
                  </button>
                </div>
                
                {openMenuId === it.message_id && (
                  <div
                    data-row-action
                    onClick={(e) => e.stopPropagation()}
                    className="col-span-full flex flex-wrap gap-2 pt-2 mt-1 border-t border-border"
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
            className="mt-4 bg-transparent text-text-muted hover:text-text-secondary border border-border rounded-lg px-3 py-1.5 text-xs font-bold transition-colors w-full cursor-pointer shadow-sm"
          >
            Reset {hiddenSenders.size} hidden sender{hiddenSenders.size === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {toast && (
        <div
          role="status"
          className={`absolute right-4 bottom-4 px-3 py-2 rounded-lg border text-xs font-bold z-30 shadow-lg ${
            toast.kind === 'ok' 
              ? 'bg-success/10 text-success border-emerald-200' 
              : 'bg-error/10 text-error border-red-200'
          }`}
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
      className="bg-surface-raised hover:bg-accent/10 text-text-primary hover:text-accent-hover border border-border hover:border-blue-200 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest cursor-pointer transition-colors shadow-sm"
    >
      {children}
    </button>
  )
}
