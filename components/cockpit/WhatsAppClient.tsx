/* eslint-disable */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────
type Panel = '305' | '718'
type Thread = {
  id: string
  phone: string
  contact_name: string
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
  is_group: boolean
  is_priority: boolean
  panel: Panel
  pipedrive_contact_id?: string | null
}
type Message = {
  id: string
  text: string
  from_me: boolean
  timestamp: string
  status?: string // sent | delivered | read
  type?: string   // text | image | video | audio | document
  media_url?: string
  contact_name?: string
}
type AIReplyStyle = 'professional' | 'friendly' | 'short' | 'long' | 'translate_he' | 'translate_en' | 'improve' | 'rewrite'

// ── Styles ─────────────────────────────────────────────────────────────────────
const PANEL_INFO: Record<Panel, { label: string; phone: string; color: string; gradient: string }> = {
  '305': { label: 'WhatsApp 305', phone: '+1 305-778-4861', color: '#25D366', gradient: 'linear-gradient(135deg, #25D366, #128C7E)' },
  '718': { label: 'WhatsApp 718', phone: '+1 718-550-5500', color: '#075E54', gradient: 'linear-gradient(135deg, #075E54, #128C7E)' },
}

const AI_STYLES: { key: AIReplyStyle; label: string; icon: string }[] = [
  { key: 'professional', label: 'Professional', icon: '💼' },
  { key: 'friendly', label: 'Friendly', icon: '😊' },
  { key: 'short', label: 'Short', icon: '⚡' },
  { key: 'long', label: 'Detailed', icon: '📝' },
  { key: 'translate_he', label: 'Hebrew', icon: '🇮🇱' },
  { key: 'translate_en', label: 'English', icon: '🇺🇸' },
  { key: 'improve', label: 'Improve', icon: '✨' },
  { key: 'rewrite', label: 'Rewrite', icon: '🔄' },
]

function timeAgo(ts: string | null): string {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const AVATAR_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6']
function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function WhatsAppClient() {
  const [activePanel, setActivePanel] = useState<Panel>('305')
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [composing, setComposing] = useState('')
  const [sending, setSending] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [aiReply, setAiReply] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [recording, setRecording] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // ── Fetch threads ──
  const fetchThreads = useCallback(async (panel: Panel) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/whatsapp/threads?panel=${panel}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const list = (data.threads || data || []) as Thread[]
        setThreads(list.sort((a, b) => {
          if (a.is_priority && !b.is_priority) return -1
          if (!a.is_priority && b.is_priority) return 1
          return new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
        }))
      }
    } catch (e) { console.error('Failed to fetch threads:', e) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchThreads(activePanel) }, [activePanel, fetchThreads])

  // Auto-refresh threads every 30s
  useEffect(() => {
    const t = setInterval(() => fetchThreads(activePanel), 30000)
    return () => clearInterval(t)
  }, [activePanel, fetchThreads])

  // ── Fetch messages ──
  const fetchMessages = useCallback(async (thread: Thread) => {
    setMsgLoading(true)
    setMessages([])
    try {
      const params = new URLSearchParams()
      if (thread.id) params.set('thread_id', thread.id)
      params.set('panel', thread.panel)
      const res = await fetch(`/api/whatsapp/messages?${params}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setMessages((data.messages || data || []) as Message[])
      }
    } catch (e) { console.error('Failed to fetch messages:', e) }
    setMsgLoading(false)
  }, [])

  useEffect(() => {
    if (selectedThread) fetchMessages(selectedThread)
  }, [selectedThread, fetchMessages])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ──
  const sendMessage = async () => {
    if (!composing.trim() || !selectedThread || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/whatsapp/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedThread.phone,
          text: composing.trim(),
          panel: selectedThread.panel,
        }),
      })
      if (res.ok) {
        setComposing('')
        setAiReply('')
        setShowAI(false)
        // Refresh messages
        setTimeout(() => fetchMessages(selectedThread), 1000)
      }
    } catch (e) { console.error('Send failed:', e) }
    setSending(false)
  }

  // ── AI Reply ──
  const generateAIReply = async (style: AIReplyStyle) => {
    if (!selectedThread) return
    setAiLoading(true)
    try {
      const context = messages.slice(-10).map(m =>
        `${m.from_me ? 'Gideon' : selectedThread.contact_name}: ${m.text}`
      ).join('\n')

      const res = await fetch('/api/whatsapp/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          draft: composing || undefined,
          style,
          contactName: selectedThread.contact_name,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiReply(data.reply || '')
        setComposing(data.reply || '')
      }
    } catch (e) { console.error('AI reply failed:', e) }
    setAiLoading(false)
  }

  // ── Voice recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.start()
      mediaRecRef.current = rec
      setRecording(true)
    } catch { console.error('Mic access denied') }
  }

  const stopRecording = async () => {
    const rec = mediaRecRef.current
    if (!rec) return
    setRecording(false)
    mediaRecRef.current = null

    const blob = await new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' }))
      rec.stop()
    })
    rec.stream.getTracks().forEach(t => t.stop())

    if (!selectedThread || blob.size < 500) return
    // Upload as voice note
    setSending(true)
    try {
      const fd = new FormData()
      fd.append('audio', new File([blob], 'voice.ogg', { type: 'audio/ogg' }))
      fd.append('phone', selectedThread.phone)
      fd.append('panel', selectedThread.panel)
      await fetch('/api/whatsapp/messages', { method: 'POST', body: fd })
      setTimeout(() => fetchMessages(selectedThread), 1000)
    } catch (e) { console.error('Voice send failed:', e) }
    setSending(false)
  }

  // ── File upload ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedThread) return
    setSending(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('phone', selectedThread.phone)
      fd.append('panel', selectedThread.panel)
      await fetch('/api/whatsapp/messages', { method: 'POST', body: fd })
      setTimeout(() => fetchMessages(selectedThread), 1000)
    } catch (e2) { console.error('File upload failed:', e2) }
    setSending(false)
    e.target.value = ''
  }

  // ── Filter threads ──
  const filtered = threads.filter(t =>
    !searchQuery || t.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.phone.includes(searchQuery)
  )

  const emojis = ['👍', '❤️', '😂', '🙏', '🔥', '👋', '✅', '🎉', '💪', '🤝', '👏', '💯', '🚀', '⭐', '😊', '🙌']

  return (
    <div style={{ display: 'flex', height: '100%', background: '#0B1426', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ── LEFT PANEL: Chat List ──────────────────────────────────────── */}
      <div style={{
        width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(11,20,38,0.98)',
      }}>
        {/* Panel Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {(['305', '718'] as Panel[]).map(p => (
            <button key={p} onClick={() => { setActivePanel(p); setSelectedThread(null) }}
              style={{
                flex: 1, padding: '14px 0', border: 'none',
                background: activePanel === p ? PANEL_INFO[p].gradient : 'transparent',
                color: activePanel === p ? '#fff' : 'rgba(255,255,255,0.4)',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                letterSpacing: '0.05em',
                borderBottom: activePanel === p ? `2px solid ${PANEL_INFO[p].color}` : '2px solid transparent',
                transition: 'all 0.2s',
              }}>
              <span style={{ fontSize: 14, marginRight: 6 }}>📱</span>
              {PANEL_INFO[p].label}
              {threads.length > 0 && activePanel === p && (
                <span style={{
                  marginLeft: 6, background: 'rgba(255,255,255,0.2)',
                  borderRadius: 99, padding: '1px 7px', fontSize: 10,
                }}>{threads.filter(t => t.unread_count > 0).length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ padding: '10px 12px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.05)', borderRadius: 10,
            padding: '8px 12px',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>🔍</span>
            <input
              type="text" placeholder="Search chats..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: '#fff', fontSize: 13,
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
                cursor: 'pointer', fontSize: 12,
              }}>✕</button>
            )}
          </div>
        </div>

        {/* Thread List */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
              <div style={{ fontSize: 24, marginBottom: 8, animation: 'spin 1s linear infinite' }}>⏳</div>
              Loading chats...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              No chats found
            </div>
          ) : filtered.map(thread => (
            <div key={thread.id}
              onClick={() => setSelectedThread(thread)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', cursor: 'pointer',
                background: selectedThread?.id === thread.id ? 'rgba(37,211,102,0.08)' : 'transparent',
                borderLeft: selectedThread?.id === thread.id ? `3px solid ${PANEL_INFO[activePanel].color}` : '3px solid transparent',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => {
                if (selectedThread?.id !== thread.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              }}
              onMouseLeave={e => {
                if (selectedThread?.id !== thread.id) e.currentTarget.style.background = 'transparent'
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: avatarColor(thread.contact_name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 14, fontWeight: 700,
              }}>
                {thread.is_group ? '👥' : getInitials(thread.contact_name)}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    color: '#fff', fontSize: 14, fontWeight: thread.unread_count > 0 ? 700 : 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {thread.contact_name}
                    {thread.is_priority && <span style={{ marginLeft: 4, fontSize: 10, color: '#F59E0B' }}>⭐</span>}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, flexShrink: 0 }}>
                    {timeAgo(thread.last_message_at)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <span style={{
                    color: 'rgba(255,255,255,0.35)', fontSize: 12,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1, marginRight: 8,
                  }}>
                    {thread.last_message_preview || thread.phone}
                  </span>
                  {thread.unread_count > 0 && (
                    <span style={{
                      background: PANEL_INFO[activePanel].color, color: '#fff',
                      borderRadius: 99, minWidth: 20, height: 20,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                    }}>{thread.unread_count}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL: Conversation ─────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!selectedThread ? (
          /* Empty state */
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div style={{ fontSize: 64, opacity: 0.3 }}>💬</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 15, fontWeight: 600 }}>
              Select a conversation to start messaging
            </div>
            <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>
              {PANEL_INFO[activePanel].label} • {PANEL_INFO[activePanel].phone}
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
              background: 'rgba(14,52,112,0.4)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <button onClick={() => setSelectedThread(null)} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer', fontSize: 18, display: 'none',
              }}>←</button>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: avatarColor(selectedThread.contact_name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 14, fontWeight: 700,
              }}>
                {getInitials(selectedThread.contact_name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>
                  {selectedThread.contact_name}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
                  {selectedThread.phone} • {PANEL_INFO[activePanel].label}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button title="Search in conversation" style={{
                  background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8,
                  width: 36, height: 36, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16,
                }}>🔍</button>
                <button title="Contact info" style={{
                  background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8,
                  width: 36, height: 36, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16,
                }}>ℹ️</button>
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', overflowX: 'hidden',
              padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4,
              background: 'linear-gradient(180deg, rgba(11,20,38,0.95) 0%, rgba(14,52,112,0.15) 100%)',
            }}>
              {msgLoading ? (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 40 }}>
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: 40, fontSize: 13 }}>
                  No messages yet
                </div>
              ) : messages.map((msg, i) => {
                const isMe = msg.from_me
                const showTime = i === 0 || (
                  new Date(msg.timestamp).getTime() - new Date(messages[i-1].timestamp).getTime() > 300000
                )
                return (
                  <div key={msg.id || i}>
                    {showTime && (
                      <div style={{
                        textAlign: 'center', color: 'rgba(255,255,255,0.2)',
                        fontSize: 10, margin: '12px 0 8px',
                        background: 'rgba(255,255,255,0.03)', borderRadius: 12,
                        padding: '3px 12px', display: 'inline-block',
                        marginLeft: 'auto', marginRight: 'auto', width: 'fit-content',
                      }}>
                        {new Date(msg.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' '}{formatTime(msg.timestamp)}
                      </div>
                    )}
                    <div style={{
                      display: 'flex',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: 2,
                    }}>
                      <div style={{
                        maxWidth: '70%', padding: '8px 12px',
                        borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                        background: isMe
                          ? 'linear-gradient(135deg, rgba(37,211,102,0.15), rgba(18,140,126,0.1))'
                          : 'rgba(255,255,255,0.05)',
                        border: isMe
                          ? '1px solid rgba(37,211,102,0.2)'
                          : '1px solid rgba(255,255,255,0.05)',
                      }}>
                        {msg.type === 'audio' || msg.type === 'voice' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16 }}>🎵</span>
                            {msg.media_url ? (
                              <audio controls src={msg.media_url} style={{ height: 32, maxWidth: 200 }} />
                            ) : (
                              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Voice message</span>
                            )}
                          </div>
                        ) : msg.type === 'image' && msg.media_url ? (
                          <img src={msg.media_url} alt="" style={{ maxWidth: '100%', borderRadius: 8 }} />
                        ) : null}
                        {msg.text && (
                          <div style={{
                            color: isMe ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.75)',
                            fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word',
                          }}>
                            {msg.text}
                          </div>
                        )}
                        <div style={{
                          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4,
                          marginTop: 2,
                        }}>
                          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>
                            {formatTime(msg.timestamp)}
                          </span>
                          {isMe && (
                            <span style={{ fontSize: 10, color: msg.status === 'read' ? '#53BDEB' : 'rgba(255,255,255,0.2)' }}>
                              {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* AI Reply Bar */}
            {showAI && (
              <div style={{
                padding: '8px 16px',
                background: 'rgba(168,85,247,0.06)',
                borderTop: '1px solid rgba(168,85,247,0.15)',
                display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
              }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, marginRight: 4 }}>AI:</span>
                {AI_STYLES.map(s => (
                  <button key={s.key} onClick={() => generateAIReply(s.key)}
                    disabled={aiLoading}
                    style={{
                      background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)',
                      borderRadius: 8, padding: '4px 10px', color: '#A855F7',
                      fontSize: 11, fontWeight: 600, cursor: aiLoading ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                      opacity: aiLoading ? 0.5 : 1,
                    }}>
                    <span>{s.icon}</span> {s.label}
                  </button>
                ))}
                {aiLoading && <span style={{ color: '#A855F7', fontSize: 11 }}>Generating...</span>}
              </div>
            )}

            {/* Emoji Picker */}
            {showEmoji && (
              <div style={{
                padding: '8px 16px', background: 'rgba(255,255,255,0.03)',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', gap: 4, flexWrap: 'wrap',
              }}>
                {emojis.map(e => (
                  <button key={e} onClick={() => { setComposing(prev => prev + e); setShowEmoji(false) }}
                    style={{
                      background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
                      padding: 4, borderRadius: 6,
                    }}>{e}</button>
                ))}
              </div>
            )}

            {/* Compose Bar */}
            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 8, padding: '10px 16px',
              background: 'rgba(14,52,112,0.3)',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              {/* Emoji button */}
              <button onClick={() => setShowEmoji(!showEmoji)} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
                color: showEmoji ? '#FFCC33' : 'rgba(255,255,255,0.3)', padding: '6px 2px',
              }}>😊</button>

              {/* Attachment */}
              <label style={{
                cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 20, padding: '6px 2px',
              }}>
                📎
                <input type="file" hidden onChange={handleFileUpload}
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" />
              </label>

              {/* Text input */}
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea
                  value={composing}
                  onChange={e => setComposing(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder="Type a message..."
                  rows={1}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
                    padding: '10px 14px', color: '#fff', fontSize: 13,
                    resize: 'none', outline: 'none', fontFamily: 'inherit',
                    maxHeight: 120, minHeight: 40,
                  }}
                />
              </div>

              {/* AI button */}
              <button onClick={() => setShowAI(!showAI)}
                title="AI Reply"
                style={{
                  background: showAI ? 'linear-gradient(135deg, #A855F7, #7C3AED)' : 'rgba(168,85,247,0.1)',
                  border: showAI ? 'none' : '1px solid rgba(168,85,247,0.2)',
                  borderRadius: 10, width: 38, height: 38,
                  color: showAI ? '#fff' : '#A855F7', cursor: 'pointer',
                  fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>🤖</button>

              {/* Voice / Send */}
              {composing.trim() ? (
                <button onClick={sendMessage} disabled={sending}
                  style={{
                    background: PANEL_INFO[activePanel].gradient,
                    border: 'none', borderRadius: 10, width: 38, height: 38,
                    color: '#fff', cursor: sending ? 'wait' : 'pointer',
                    fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: sending ? 0.5 : 1,
                  }}>
                  {sending ? '⏳' : '➤'}
                </button>
              ) : (
                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={recording ? stopRecording : undefined}
                  style={{
                    background: recording ? '#EF4444' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                    width: 38, height: 38, color: recording ? '#fff' : 'rgba(255,255,255,0.4)',
                    cursor: 'pointer', fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: recording ? 'voice-pulse 1.2s ease-in-out infinite' : undefined,
                  }}>🎤</button>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes voice-pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.15) } }
      `}</style>
    </div>
  )
}
