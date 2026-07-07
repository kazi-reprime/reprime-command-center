/* eslint-disable */
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { LoadingState } from '@/components/ui/LiveStatus'
import { useToast } from '@/lib/contexts/ToastContext'
import {
  RefreshCw, Search, Filter, ChevronRight, Phone, Video,
  MoreVertical, Send, Star, Clock, Users, MessageCircle,
  Mail, Smartphone, ArrowLeft, ExternalLink
} from 'lucide-react'

type Channel = 'all' | 'whatsapp' | 'email' | 'imessage' | 'sms'
interface Thread {
  id: string; contact_name?: string; phone?: string; email?: string;
  channel_type?: string; channel?: string; last_message_at?: string;
  last_message_preview?: string; unread_count?: number;
  is_investor?: boolean; is_priority?: boolean; panel?: string;
  investor_tier?: string | null; subject?: string;
}

interface Message {
  id?: string; body?: string; direction?: string;
  from_name?: string; sent_at?: string; status?: string;
}

const CHANNEL_TABS: { key: Channel; label: string; brandColor: string; bgGradient: string; iconBg: string }[] = [
  { key: 'all', label: 'All Channels', brandColor: '#FFCC33', bgGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', iconBg: 'rgba(102,126,234,0.15)' },
  { key: 'whatsapp', label: 'WhatsApp', brandColor: '#25D366', bgGradient: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', iconBg: 'rgba(37,211,102,0.12)' },
  { key: 'email', label: 'Gmail', brandColor: '#EA4335', bgGradient: 'linear-gradient(135deg, #EA4335 0%, #FBBC05 50%, #34A853 100%)', iconBg: 'rgba(234,67,53,0.12)' },
  { key: 'imessage', label: 'iMessage', brandColor: '#007AFF', bgGradient: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)', iconBg: 'rgba(0,122,255,0.12)' },
  { key: 'sms', label: 'SMS', brandColor: '#34C759', bgGradient: 'linear-gradient(135deg, #34C759 0%, #30B0C7 100%)', iconBg: 'rgba(52,199,89,0.12)' },
]

/** Brand-accurate SVG icons */
function ChannelIcon({ channel, size = 20 }: { channel: string; size?: number }) {
  switch (channel) {
    case 'whatsapp':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#25D366"/>
          <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.106-1.138l-.294-.175-2.6.775.775-2.6-.175-.294A7.96 7.96 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z" fill="#25D366"/>
        </svg>
      )
    case 'email':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z" fill="#EA4335" opacity="0.1"/>
          <path d="M22 6l-10 7L2 6" stroke="#EA4335" strokeWidth="2" strokeLinecap="round"/>
          <rect x="2" y="4" width="20" height="16" rx="2" stroke="#EA4335" strokeWidth="1.5" fill="none"/>
        </svg>
      )
    case 'imessage':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.477 2 2 5.79 2 10.5c0 2.47 1.21 4.69 3.13 6.29-.15 1.51-.75 2.8-1.63 3.71.93-.1 2.24-.56 3.47-1.5.97.32 2.03.5 3.13.5 5.523 0 10-3.79 10-8.5S17.523 2 12 2z" fill="#007AFF"/>
        </svg>
      )
    case 'sms':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="1" width="18" height="22" rx="3" stroke="#34C759" strokeWidth="1.5" fill="rgba(52,199,89,0.1)"/>
          <circle cx="12" cy="19" r="1.5" fill="#34C759"/>
          <rect x="6" y="4" width="12" height="12" rx="1" fill="rgba(52,199,89,0.15)"/>
          <path d="M8 8h8M8 11h5" stroke="#34C759" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )
    default:
      return <MessageCircle size={size} className="text-gray-400" />
  }
}

function getChannelConfig(ch: string) {
  return CHANNEL_TABS.find(t => t.key === ch) || CHANNEL_TABS[0]
}

function getInitials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function getAvatarColor(name?: string) {
  if (!name) return '#888'
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function CommsPage() {
  const { addToast } = useToast()
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState<Channel>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const fetchThreads = useCallback(async () => {
    setRefreshing(true)
    setLoading(threads.length === 0)
    const allThreads: Thread[] = []
    const fetchErrors: string[] = []

    // Fetch WhatsApp threads from both panels
    for (const panel of ['305', '718'] as const) {
      try {
        const res = await fetch(`/api/whatsapp/threads?panel=${panel}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
        if (res.status === 401) {
          fetchErrors.push(`WhatsApp ${panel}: Sign in required`)
          continue
        }
        if (!res.ok) continue
        const data = await res.json()
        const panelThreads = data.threads || []
        panelThreads.forEach((t: any) => allThreads.push({
          id: `wa-${panel}-${t.id}`,
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
        fetchErrors.push(`WhatsApp ${panel}: ${(err as Error).message}`)
      }
    }

    // Fetch Gmail threads
    try {
      const res = await fetch('/api/gmail', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const emails = data.emails || data || []
        ;(Array.isArray(emails) ? emails : []).slice(0, 50).forEach((e: any) => allThreads.push({
          id: `em-${e.id || e.threadId}`,
          contact_name: e.from?.name || e.fromName || (typeof e.from === 'string' ? e.from.split('<')[0].trim() : 'Unknown'),
          email: e.from?.email || e.from,
          channel_type: 'email',
          channel: 'email',
          last_message_at: e.date || e.receivedAt || e.internalDate,
          last_message_preview: e.snippet || e.subject,
          subject: e.subject,
          unread_count: e.unread ? 1 : 0,
        }))
      }
    } catch {}

    // Sort by recency
    allThreads.sort((a, b) => {
      const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return bt - at
    })

    setThreads(allThreads)
    setErrors(fetchErrors)
    setLoading(false)
    setRefreshing(false)
  }, [threads.length])

  useEffect(() => { fetchThreads() }, []) // eslint-disable-line

  // Fetch messages when thread selected
  const loadMessages = useCallback(async (thread: Thread) => {
    if (thread.channel_type !== 'whatsapp') return
    setLoadingMessages(true)
    try {
      const realId = thread.id.replace(/^wa-\d+-/, '')
      const res = await fetch(`/api/whatsapp/messages?thread_id=${realId}&limit=30`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch {}
    setLoadingMessages(false)
  }, [])

  useEffect(() => {
    if (selected) {
      const thread = threads.find(t => t.id === selected)
      if (thread) loadMessages(thread)
    }
  }, [selected, threads, loadMessages])

  const getChannel = (t: Thread) => t.channel_type || t.channel || 'whatsapp'
  const filtered = (channel === 'all' ? threads : threads.filter(t => getChannel(t) === channel))
    .filter(t => !searchQuery || (t.contact_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
  const totalUnread = threads.reduce((s, t) => s + (t.unread_count || 0), 0)

  const channelCounts = {
    all: threads.length,
    whatsapp: threads.filter(t => getChannel(t) === 'whatsapp').length,
    email: threads.filter(t => getChannel(t) === 'email').length,
    imessage: threads.filter(t => getChannel(t) === 'imessage').length,
    sms: threads.filter(t => getChannel(t) === 'sms').length,
  }

  const channelUnread = {
    all: totalUnread,
    whatsapp: threads.filter(t => getChannel(t) === 'whatsapp').reduce((s, t) => s + (t.unread_count || 0), 0),
    email: threads.filter(t => getChannel(t) === 'email').reduce((s, t) => s + (t.unread_count || 0), 0),
    imessage: threads.filter(t => getChannel(t) === 'imessage').reduce((s, t) => s + (t.unread_count || 0), 0),
    sms: threads.filter(t => getChannel(t) === 'sms').reduce((s, t) => s + (t.unread_count || 0), 0),
  }

  const timeAgo = (d?: string) => {
    if (!d) return ''
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    if (mins < 1440) return `${Math.floor(mins / 60)}h`
    return `${Math.floor(mins / 1440)}d`
  }

  const selectedThread = threads.find(t => t.id === selected)

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-black text-text-primary tracking-tight">Communications</h1>
            <p className="text-sm text-text-secondary mt-1">
              {threads.length} conversations · <span className="text-accent font-semibold">{totalUnread} unread</span>
            </p>
          </div>
          <button
            onClick={fetchThreads}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-raised hover:bg-surface-hover border border-border text-text-secondary hover:text-text-primary transition-all text-sm font-medium cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Channel Tabs (mobile-app style) ─────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CHANNEL_TABS.map(tab => {
            const count = channelCounts[tab.key]
            const unread = channelUnread[tab.key]
            const active = channel === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setChannel(tab.key)}
                className="flex-shrink-0 cursor-pointer border-none relative group transition-all duration-200"
                style={{
                  padding: '10px 18px',
                  borderRadius: 16,
                  background: active ? tab.bgGradient : 'var(--color-surface-raised)',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  boxShadow: active ? `0 4px 16px ${tab.brandColor}40` : 'none',
                  border: active ? 'none' : '1px solid var(--color-border)',
                  minWidth: 100,
                }}
              >
                <div className="flex items-center gap-2.5">
                  {tab.key !== 'all' && (
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: active ? 'rgba(255,255,255,0.2)' : tab.iconBg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <ChannelIcon channel={tab.key} size={16} />
                    </div>
                  )}
                  {tab.key === 'all' && (
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: active ? 'rgba(255,255,255,0.2)' : 'rgba(102,126,234,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <MessageCircle size={16} className={active ? 'text-white' : 'text-indigo-400'} />
                    </div>
                  )}
                  <div className="text-left">
                    <div className="text-xs font-bold">{tab.label}</div>
                    <div className="text-[10px] opacity-70">{count} threads</div>
                  </div>
                </div>
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1"
                    style={{ background: active ? '#fff' : tab.brandColor, color: active ? tab.brandColor : '#fff' }}
                  >
                    {unread}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Connection Warnings ──────────────────────────────────────────── */}
      {errors.length > 0 && (
        <div className="flex-shrink-0 mb-3 flex flex-wrap gap-2">
          {errors.map((err, i) => (
            <div key={i} className="px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs flex items-center gap-1.5">
              ⚠️ {err}
            </div>
          ))}
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      {loading ? <LoadingState message="Connecting to all channels..." /> : (
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0 overflow-hidden">

          {/* ── Thread List (5 cols) ─────────────────────────────────────── */}
          <div className="col-span-5 flex flex-col min-h-0 bg-surface-raised rounded-2xl border border-border overflow-hidden">
            {/* Search */}
            <div className="flex-shrink-0 p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-9 pr-3 py-2 bg-surface rounded-xl border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                />
              </div>
            </div>

            {/* Thread Items */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface flex items-center justify-center">
                    <MessageCircle className="w-8 h-8 text-text-muted" />
                  </div>
                  <p className="text-text-muted text-sm">No conversations found</p>
                  <p className="text-text-muted text-xs mt-1">Try a different channel or search</p>
                </div>
              ) : (
                filtered.slice(0, 200).map(t => {
                  const ch = getChannel(t)
                  const cfg = getChannelConfig(ch)
                  const isActive = selected === t.id
                  const hasUnread = (t.unread_count || 0) > 0
                  const avatarBg = getAvatarColor(t.contact_name)

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelected(t.id)}
                      className="cursor-pointer transition-all duration-150 border-b border-border/50 hover:bg-surface-hover"
                      style={{
                        padding: '12px 16px',
                        background: isActive ? `${cfg.brandColor}08` : 'transparent',
                        borderLeft: isActive ? `3px solid ${cfg.brandColor}` : '3px solid transparent',
                      }}
                    >
                      <div className="flex gap-3">
                        {/* Avatar */}
                        <div className="flex-shrink-0 relative">
                          <div
                            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold"
                            style={{ background: avatarBg }}
                          >
                            {getInitials(t.contact_name)}
                          </div>
                          {/* Channel badge */}
                          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-surface border-2 border-surface-raised flex items-center justify-center">
                            <ChannelIcon channel={ch} size={11} />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`text-sm truncate ${hasUnread ? 'text-text-primary font-bold' : 'text-text-primary font-medium'}`}>
                                {t.contact_name || t.phone || t.email || 'Unknown'}
                              </span>
                              {t.is_investor && (
                                <span className="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                  style={{ background: 'rgba(255,204,51,0.15)', color: '#FFCC33' }}>
                                  INVESTOR
                                </span>
                              )}
                              {t.is_priority && (
                                <Star className="w-3 h-3 text-yellow-400 flex-shrink-0 fill-yellow-400" />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                              <span className="text-[10px] text-text-muted">{timeAgo(t.last_message_at)}</span>
                              {hasUnread && (
                                <span className="min-w-[20px] h-5 rounded-full text-[10px] font-bold flex items-center justify-center px-1.5 text-white"
                                  style={{ background: cfg.brandColor }}>
                                  {t.unread_count}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Preview */}
                          <p className={`text-xs mt-0.5 truncate ${hasUnread ? 'text-text-secondary' : 'text-text-muted'}`}>
                            {t.subject ? `📋 ${t.subject}` : t.last_message_preview || 'No messages'}
                          </p>
                          {/* Tags */}
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium"
                              style={{ background: `${cfg.brandColor}12`, color: cfg.brandColor }}>
                              {cfg.label}
                            </span>
                            {t.panel && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-surface text-text-muted font-medium">
                                {t.panel}
                              </span>
                            )}
                            {t.investor_tier && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-accent/10 text-accent font-medium">
                                Tier {t.investor_tier}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* ── Message Panel (7 cols) ───────────────────────────────────── */}
          <div className="col-span-7 flex flex-col min-h-0 bg-surface-raised rounded-2xl border border-border overflow-hidden">
            {!selectedThread ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1))' }}>
                    <MessageCircle className="w-12 h-12 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold text-text-primary mb-2">Select a conversation</h3>
                  <p className="text-sm text-text-muted max-w-xs">
                    Choose a thread from the left to view messages, reply, or take action
                  </p>
                  <div className="flex items-center justify-center gap-4 mt-6">
                    {['whatsapp', 'email', 'imessage', 'sms'].map(ch => (
                      <div key={ch} className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center">
                        <ChannelIcon channel={ch} size={18} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (() => {
              const ch = getChannel(selectedThread)
              const cfg = getChannelConfig(ch)
              return (
                <>
                  {/* Thread Header */}
                  <div className="flex-shrink-0 px-5 py-3 border-b border-border flex items-center justify-between"
                    style={{ background: `${cfg.brandColor}06` }}>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ background: getAvatarColor(selectedThread.contact_name) }}
                      >
                        {getInitials(selectedThread.contact_name)}
                      </div>
                      <div>
                        <div className="font-semibold text-text-primary flex items-center gap-2">
                          {selectedThread.contact_name || selectedThread.phone || selectedThread.email}
                          <ChannelIcon channel={ch} size={14} />
                        </div>
                        <div className="text-xs text-text-muted flex items-center gap-2">
                          <span>{cfg.label}</span>
                          {selectedThread.phone && <span>· {selectedThread.phone}</span>}
                          {selectedThread.panel && <span>· Panel {selectedThread.panel}</span>}
                          {selectedThread.email && <span>· {selectedThread.email}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {ch === 'whatsapp' && (
                        <>
                          <button className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-hover flex items-center justify-center text-text-secondary cursor-pointer border-none">
                            <Phone className="w-4 h-4" />
                          </button>
                          <button className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-hover flex items-center justify-center text-text-secondary cursor-pointer border-none">
                            <Video className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => window.open('/center', '_blank')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none text-white"
                        style={{ background: cfg.brandColor }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open Full View
                      </button>
                    </div>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center h-full">
                        <LoadingState message="Loading messages..." />
                      </div>
                    ) : messages.length > 0 ? (
                      messages.map((msg, i) => {
                        const isOutgoing = msg.direction === 'outgoing' || msg.direction === 'sent'
                        return (
                          <div key={i} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className="max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm"
                              style={{
                                background: isOutgoing
                                  ? ch === 'whatsapp' ? '#005C4B' : cfg.brandColor
                                  : 'var(--color-surface)',
                                color: isOutgoing ? '#fff' : 'var(--color-text-primary)',
                                borderBottomRightRadius: isOutgoing ? 4 : 16,
                                borderBottomLeftRadius: isOutgoing ? 16 : 4,
                              }}
                            >
                              {!isOutgoing && msg.from_name && (
                                <div className="text-[10px] font-bold mb-0.5" style={{ color: cfg.brandColor }}>
                                  {msg.from_name}
                                </div>
                              )}
                              <p className="m-0 leading-relaxed whitespace-pre-wrap">{msg.body || '(no content)'}</p>
                              <div className={`text-[9px] mt-1 ${isOutgoing ? 'text-white/50 text-right' : 'text-text-muted'}`}>
                                {msg.sent_at ? new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                {isOutgoing && msg.status && ` · ${msg.status}`}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-text-muted">
                          <ChannelIcon channel={ch} size={32} />
                          <p className="text-sm mt-3">
                            {ch === 'email' ? 'Email preview — open Gmail for full thread' : 'Select a WhatsApp thread to see messages'}
                          </p>
                          {selectedThread.last_message_preview && (
                            <div className="mt-4 px-4 py-3 rounded-xl bg-surface text-left max-w-md">
                              <p className="text-xs text-text-muted mb-1">Latest</p>
                              <p className="text-sm text-text-primary">{selectedThread.last_message_preview}</p>
                            </div>
                          )}
                          <p className="text-xs mt-3 text-text-muted">
                            Last activity: {selectedThread.last_message_at ? new Date(selectedThread.last_message_at).toLocaleString() : 'Unknown'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Compose Bar */}
                  {ch === 'whatsapp' && (
                    <div className="flex-shrink-0 px-4 py-3 border-t border-border">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder={`Message ${selectedThread.contact_name || 'contact'}...`}
                          className="flex-1 px-4 py-2.5 bg-surface rounded-xl border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              addToast('Use the Command Center for sending messages', 'info')
                            }
                          }}
                        />
                        <button
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white cursor-pointer border-none"
                          style={{ background: cfg.brandColor }}
                          onClick={() => addToast('Use the Command Center for sending messages', 'info')}
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
