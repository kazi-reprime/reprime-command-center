'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, ActionButton } from '@/components/ui/shared'
import { LoadingState } from '@/components/ui/LiveStatus'
import { useToast } from '@/lib/contexts/ToastContext'

type Channel = 'all' | 'whatsapp' | 'email' | 'imessage' | 'sms'
interface Thread {
  id: string; contact_name?: string; phone?: string; email?: string;
  channel_type?: string; channel?: string; last_message_at?: string;
  last_message_preview?: string; unread_count?: number;
  is_investor?: boolean; is_priority?: boolean; panel?: string;
  investor_tier?: string | null;
}

const CHANNEL_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  whatsapp: { label: 'WhatsApp', color: '#25D366', icon: '💬' },
  email: { label: 'Email', color: '#3B82F6', icon: '📧' },
  imessage: { label: 'iMessage', color: '#007AFF', icon: '💙' },
  sms: { label: 'SMS', color: '#F59E0B', icon: '📱' },
}

export default function CommsPage() {
  const { addToast } = useToast()
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState<Channel>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const fetchThreads = useCallback(async () => {
    setLoading(true)
    const allThreads: Thread[] = []
    const fetchErrors: string[] = []

    // Fetch WhatsApp threads from both panels
    for (const panel of ['305', '718'] as const) {
      try {
        const res = await fetch(`/api/whatsapp/threads?panel=${panel}`, {
          credentials: 'include', // Include auth cookies
          headers: { 'Content-Type': 'application/json' },
        })
        if (res.status === 401) {
          fetchErrors.push(`WhatsApp ${panel}: Not authenticated — sign in at /login first`)
          continue
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          fetchErrors.push(`WhatsApp ${panel}: ${body.error || body.message || `HTTP ${res.status}`}`)
          continue
        }
        const data = await res.json()
        const panelThreads = data.threads || []
        panelThreads.forEach((t: any) => allThreads.push({
          id: `${panel}-${t.id}`,
          contact_name: t.contact_name,
          phone: t.phone,
          channel_type: t.channel_type || 'whatsapp',
          channel: t.channel_type || 'whatsapp',
          last_message_at: t.last_message_at,
          last_message_preview: t.last_message_preview,
          unread_count: t.unread_count,
          is_investor: t.is_investor,
          is_priority: t.is_priority,
          investor_tier: t.investor_tier,
          panel,
        }))
      } catch (err) {
        fetchErrors.push(`WhatsApp ${panel}: Network error — ${(err as Error).message}`)
      }
    }

    // Fetch Gmail threads
    try {
      const res = await fetch('/api/gmail', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.status === 401) {
        fetchErrors.push('Gmail: Not authenticated — configure Gmail in Settings')
      } else if (res.ok) {
        const data = await res.json()
        const emails = data.emails || data || []
        ;(Array.isArray(emails) ? emails : []).slice(0, 50).forEach((e: any) => allThreads.push({
          id: `email-${e.id || e.threadId}`,
          contact_name: e.from?.name || e.from,
          email: e.from?.email || e.from,
          channel_type: 'email',
          channel: 'email',
          last_message_at: e.date || e.internalDate,
          last_message_preview: e.snippet || e.subject,
          unread_count: e.unread ? 1 : 0,
        }))
      } else {
        const body = await res.json().catch(() => ({}))
        fetchErrors.push(`Gmail: ${body.error || `HTTP ${res.status}`}`)
      }
    } catch (err) {
      fetchErrors.push(`Gmail: ${(err as Error).message}`)
    }

    // Sort by recency
    allThreads.sort((a, b) => {
      const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return bt - at
    })

    setThreads(allThreads)
    setErrors(fetchErrors)
    setLoading(false)
  }, [])

  useEffect(() => { fetchThreads() }, [fetchThreads])

  const getChannel = (t: Thread) => t.channel_type || t.channel || 'whatsapp'
  const filtered = channel === 'all' ? threads : threads.filter(t => getChannel(t) === channel)
  const totalUnread = threads.reduce((s, t) => s + (t.unread_count || 0), 0)

  const channelCounts = {
    whatsapp: threads.filter(t => getChannel(t) === 'whatsapp').length,
    email: threads.filter(t => getChannel(t) === 'email').length,
    imessage: threads.filter(t => getChannel(t) === 'imessage').length,
    sms: threads.filter(t => getChannel(t) === 'sms').length,
  }

  const timeAgo = (d?: string) => {
    if (!d) return ''
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    if (mins < 1440) return `${Math.floor(mins / 60)}h`
    return `${Math.floor(mins / 1440)}d`
  }

  return (
    <div>
      <h1 className="mb-1 text-text-primary text-2xl font-bold">Unified Communications</h1>
      <p className="mb-4 text-text-secondary text-sm">
        All channels consolidated · {threads.length} threads · {totalUnread} unread
      </p>

      {/* Connection Errors */}
      {errors.length > 0 && (
        <div className="mb-4 flex flex-col gap-1">
          {errors.map((err, i) => (
            <div key={i} className="px-3 py-2 rounded-lg bg-status-warning/10 border border-status-warning/15 text-status-warning text-xs flex items-center gap-1.5">
              <span>⚠️</span> {err}
            </div>
          ))}
        </div>
      )}

      {/* Channel Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {[
          { key: 'all' as Channel, label: `All (${threads.length})`, color: '#FFCC33' },
          ...Object.entries(CHANNEL_CONFIG).map(([k, v]) => ({
            key: k as Channel,
            label: `${v.icon} ${v.label} (${channelCounts[k as keyof typeof channelCounts]})`,
            color: v.color,
          })),
        ].map(tab => (
          <button key={tab.key} onClick={() => setChannel(tab.key)}
            className="font-semibold text-xs whitespace-nowrap font-[inherit] cursor-pointer border-none"
            style={{
              padding: '0.45rem 0.85rem', borderRadius: 8,
              background: channel === tab.key ? `${tab.color}22` : 'rgba(0,0,0,0.15)',
              color: channel === tab.key ? tab.color : 'rgba(255,204,51,0.4)',
              borderBottom: channel === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
            }}
          >{tab.label}</button>
        ))}
        <div className="flex-1" />
        <ActionButton label="↻ Refresh" variant="ghost" size="sm" onClick={fetchThreads} />
      </div>

      {loading ? <LoadingState message="Loading communications..." /> : (
        <div className="grid grid-cols-2 gap-4" style={{ minHeight: 500 }}>
          {/* Thread List */}
          <div className="bg-surface-raised rounded-xl border border-border overflow-hidden">
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              {filtered.length === 0 && (
                <div className="p-8 text-center text-text-muted text-sm">
                  {errors.length > 0
                    ? 'Could not connect to messaging services. Check the warnings above.'
                    : 'No threads found. Check WhatsApp and Gmail connections in Settings.'
                  }
                </div>
              )}
              {filtered.slice(0, 100).map(t => {
                const ch = getChannel(t)
                const cfg = CHANNEL_CONFIG[ch] || { label: ch, color: '#888', icon: '💬' }
                return (
                  <div key={t.id} onClick={() => setSelected(t.id)}
                    className="cursor-pointer border-b border-border"
                    style={{
                      padding: '0.6rem 0.75rem',
                      background: selected === t.id ? 'rgba(255,204,51,0.06)' : 'transparent',
                      borderLeft: selected === t.id ? '3px solid var(--color-accent)' : '3px solid transparent',
                    }}
                  >
                    <div className="flex justify-between items-start mb-0.5">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-xs">{cfg.icon}</span>
                        <span className={`text-sm overflow-hidden text-ellipsis whitespace-nowrap ${(t.unread_count || 0) > 0 ? 'text-text-inverse font-bold' : 'text-text-primary font-medium'}`}>
                          {t.contact_name || t.phone || t.email || 'Unknown'}
                        </span>
                        {t.is_investor && (
                          <span className="text-[0.5rem] px-1 py-px rounded bg-accent/15 text-accent">
                            INV{t.investor_tier ? ` ${t.investor_tier}` : ''}
                          </span>
                        )}
                        {t.is_priority && <span className="text-[0.5rem] px-1 py-px rounded bg-status-error/15 text-status-error">!</span>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {(t.unread_count || 0) > 0 && (
                          <span className="w-[18px] h-[18px] rounded-full bg-accent text-accent-foreground text-[0.55rem] font-bold flex items-center justify-center">
                            {t.unread_count}
                          </span>
                        )}
                        <span className="text-text-muted text-[0.6rem]">{timeAgo(t.last_message_at)}</span>
                      </div>
                    </div>
                    {t.last_message_preview && (
                      <p className="text-text-muted text-[0.68rem] m-0 overflow-hidden text-ellipsis whitespace-nowrap">
                        {t.last_message_preview}
                      </p>
                    )}
                    <span className="inline-block mt-0.5 px-1 py-px rounded text-[0.5rem]"
                      style={{ background: `${cfg.color}15`, color: cfg.color }}
                    >{cfg.label}{t.panel ? ` · ${t.panel}` : ''}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Message Detail */}
          <div className="bg-surface-raised rounded-xl border border-border flex flex-col">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-text-muted">
                  <div className="text-3xl mb-2">💬</div>
                  <div className="text-sm">Select a thread to view</div>
                  <div className="text-xs mt-1 text-text-muted">
                    For full message history, use the Command Center
                  </div>
                </div>
              </div>
            ) : (() => {
              const t = threads.find(th => th.id === selected)
              if (!t) return null
              const ch = getChannel(t)
              const cfg = CHANNEL_CONFIG[ch] || { label: ch, color: '#888', icon: '💬' }
              return (
                <>
                  <div className="px-4 py-3 border-b border-border flex justify-between items-center">
                    <div>
                      <div className="text-text-primary text-[0.9rem] font-semibold">
                        {t.contact_name || t.phone || t.email}
                      </div>
                      <div className="text-text-secondary text-[0.65rem]">
                        {cfg.icon} {cfg.label} · {t.phone || t.email || ''}
                        {t.panel && ` · Panel ${t.panel}`}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <ActionButton label="Open Command Center" variant="primary" size="sm" onClick={() => window.open('/center', '_blank')} />
                    </div>
                  </div>
                  <div className="flex-1 p-4 flex items-center justify-center">
                    <div className="text-center text-text-muted">
                      <p className="text-sm m-0">Message history is available in the Command Center</p>
                      <p className="text-xs mt-1 text-text-muted">
                        Last activity: {t.last_message_at ? new Date(t.last_message_at).toLocaleString() : 'Unknown'}
                      </p>
                      {t.is_investor && (
                        <span className="inline-block mt-2 px-2 py-1 rounded bg-accent/10 text-accent text-[0.65rem] font-semibold">
                          Investor{t.investor_tier ? ` · Tier ${t.investor_tier}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
