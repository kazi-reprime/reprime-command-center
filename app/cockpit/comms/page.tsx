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
      <h1 style={{ margin: '0 0 0.25rem', color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Unified Communications</h1>
      <p style={{ margin: '0 0 1rem', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
        All channels consolidated · {threads.length} threads · {totalUnread} unread
      </p>

      {/* Connection Errors */}
      {errors.length > 0 && (
        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {errors.map((err, i) => (
            <div key={i} style={{
              padding: '0.5rem 0.75rem', borderRadius: 8,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)',
              color: '#F59E0B', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
              <span>⚠️</span> {err}
            </div>
          ))}
        </div>
      )}

      {/* Channel Tabs */}
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem', overflowX: 'auto' }}>
        {[
          { key: 'all' as Channel, label: `All (${threads.length})`, color: '#FFCC33' },
          ...Object.entries(CHANNEL_CONFIG).map(([k, v]) => ({
            key: k as Channel,
            label: `${v.icon} ${v.label} (${channelCounts[k as keyof typeof channelCounts]})`,
            color: v.color,
          })),
        ].map(tab => (
          <button key={tab.key} onClick={() => setChannel(tab.key)}
            style={{
              padding: '0.45rem 0.85rem', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: channel === tab.key ? `${tab.color}22` : 'rgba(0,0,0,0.15)',
              color: channel === tab.key ? tab.color : 'rgba(255,204,51,0.4)',
              fontSize: '0.72rem', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
              borderBottom: channel === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
            }}
          >{tab.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <ActionButton label="↻ Refresh" variant="ghost" size="sm" onClick={fetchThreads} />
      </div>

      {loading ? <LoadingState message="Loading communications..." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', minHeight: 500 }}>
          {/* Thread List */}
          <div style={{
            background: 'rgba(14,52,112,0.3)', borderRadius: 10,
            border: '1px solid rgba(255,204,51,0.06)', overflow: 'hidden',
          }}>
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              {filtered.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,204,51,0.3)', fontSize: '0.8rem' }}>
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
                    style={{
                      padding: '0.6rem 0.75rem', cursor: 'pointer',
                      background: selected === t.id ? 'rgba(255,204,51,0.06)' : 'transparent',
                      borderBottom: '1px solid rgba(255,204,51,0.03)',
                      borderLeft: selected === t.id ? '3px solid #FFCC33' : '3px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.7rem' }}>{cfg.icon}</span>
                        <span style={{
                          color: (t.unread_count || 0) > 0 ? '#fff' : '#e2e8f0',
                          fontSize: '0.78rem', fontWeight: (t.unread_count || 0) > 0 ? 700 : 500,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {t.contact_name || t.phone || t.email || 'Unknown'}
                        </span>
                        {t.is_investor && (
                          <span style={{ fontSize: '0.5rem', padding: '0.05rem 0.2rem', borderRadius: 3, background: 'rgba(255,204,51,0.15)', color: '#FFCC33' }}>
                            INV{t.investor_tier ? ` ${t.investor_tier}` : ''}
                          </span>
                        )}
                        {t.is_priority && <span style={{ fontSize: '0.5rem', padding: '0.05rem 0.2rem', borderRadius: 3, background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>!</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                        {(t.unread_count || 0) > 0 && (
                          <span style={{
                            width: 18, height: 18, borderRadius: '50%', background: '#FFCC33',
                            color: '#0E3470', fontSize: '0.55rem', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{t.unread_count}</span>
                        )}
                        <span style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.6rem' }}>{timeAgo(t.last_message_at)}</span>
                      </div>
                    </div>
                    {t.last_message_preview && (
                      <p style={{
                        color: 'rgba(255,204,51,0.35)', fontSize: '0.68rem', margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{t.last_message_preview}</p>
                    )}
                    <span style={{
                      display: 'inline-block', marginTop: 2, padding: '0.05rem 0.25rem', borderRadius: 3,
                      fontSize: '0.5rem', background: `${cfg.color}15`, color: cfg.color,
                    }}>{cfg.label}{t.panel ? ` · ${t.panel}` : ''}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Message Detail */}
          <div style={{
            background: 'rgba(14,52,112,0.3)', borderRadius: 10,
            border: '1px solid rgba(255,204,51,0.06)',
            display: 'flex', flexDirection: 'column',
          }}>
            {!selected ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: 'rgba(255,204,51,0.2)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
                  <div style={{ fontSize: '0.85rem' }}>Select a thread to view</div>
                  <div style={{ fontSize: '0.7rem', marginTop: '0.25rem', color: 'rgba(255,204,51,0.15)' }}>
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
                  <div style={{
                    padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,204,51,0.06)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600 }}>
                        {t.contact_name || t.phone || t.email}
                      </div>
                      <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>
                        {cfg.icon} {cfg.label} · {t.phone || t.email || ''}
                        {t.panel && ` · Panel ${t.panel}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <ActionButton label="Open Command Center" variant="primary" size="sm" onClick={() => window.open('/center', '_blank')} />
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', color: 'rgba(255,204,51,0.25)' }}>
                      <p style={{ fontSize: '0.8rem', margin: 0 }}>Message history is available in the Command Center</p>
                      <p style={{ fontSize: '0.7rem', margin: '0.25rem 0 0', color: 'rgba(255,204,51,0.15)' }}>
                        Last activity: {t.last_message_at ? new Date(t.last_message_at).toLocaleString() : 'Unknown'}
                      </p>
                      {t.is_investor && (
                        <span style={{
                          display: 'inline-block', marginTop: '0.5rem',
                          padding: '0.2rem 0.5rem', borderRadius: 4,
                          background: 'rgba(255,204,51,0.1)', color: '#FFCC33',
                          fontSize: '0.65rem', fontWeight: 600,
                        }}>
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
