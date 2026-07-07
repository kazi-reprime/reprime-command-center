/* eslint-disable */
'use client'

import { useCallback, useEffect, useState } from 'react'

type NotificationType = 'whatsapp' | 'email' | 'zoom' | 'task' | 'nora' | 'system'
type Notification = {
  id: string
  type: NotificationType
  title: string
  body: string
  time: Date
  read: boolean
  action?: string // URL or event to dispatch
}

const TYPE_COLORS: Record<NotificationType, { icon: string; color: string; bg: string }> = {
  whatsapp: { icon: '💬', color: '#25D366', bg: 'rgba(37,211,102,0.1)' },
  email: { icon: '📧', color: '#EA4335', bg: 'rgba(234,67,53,0.1)' },
  zoom: { icon: '📹', color: '#2D8CFF', bg: 'rgba(45,140,255,0.1)' },
  task: { icon: '✅', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  nora: { icon: '🤖', color: '#A855F7', bg: 'rgba(168,85,247,0.1)' },
  system: { icon: '⚙️', color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
}

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [lastCheck, setLastCheck] = useState<Record<string, number>>({})

  // Poll for new events
  const checkNotifications = useCallback(async () => {
    const newNotifs: Notification[] = []

    // Check WhatsApp unreads
    try {
      const [res305, res718] = await Promise.all([
        fetch('/api/whatsapp/threads?panel=305', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/whatsapp/threads?panel=718', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      ])
      for (const data of [res305, res718]) {
        if (!data) continue
        const threads = data.threads || data || []
        for (const t of threads) {
          if (t.unread_count > 0) {
            const key = `wa-${t.id}`
            if (!lastCheck[key]) {
              newNotifs.push({
                id: key, type: 'whatsapp' as NotificationType,
                title: t.contact_name || t.phone,
                body: t.last_message_preview || 'New message',
                time: new Date(t.last_message_at || Date.now()),
                read: false,
              })
            }
          }
        }
      }
    } catch {}

    // Check upcoming meetings
    try {
      const res = await fetch('/api/briefing/today', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const meetings = data.meetings?.items || []
        for (const m of meetings) {
          const start = new Date(m.startTime)
          const minsUntil = (start.getTime() - Date.now()) / 60000
          if (minsUntil > 0 && minsUntil <= 15) {
            const key = `zoom-${m.id}`
            if (!lastCheck[key]) {
              newNotifs.push({
                id: key, type: 'zoom' as NotificationType,
                title: m.title || 'Meeting',
                body: `Starts in ${Math.ceil(minsUntil)} minutes`,
                time: new Date(), read: false,
                action: m.zoomLink || undefined,
              })
            }
          }
        }
      }
    } catch {}

    if (newNotifs.length > 0) {
      setNotifications(prev => {
        const existing = new Set(prev.map(n => n.id))
        const fresh = newNotifs.filter(n => !existing.has(n.id))
        return [...fresh, ...prev].slice(0, 50) // Keep max 50
      })
      // Update lastCheck
      const updates: Record<string, number> = {}
      newNotifs.forEach(n => { updates[n.id] = Date.now() })
      setLastCheck(prev => ({ ...prev, ...updates }))

      // Browser notification
      if (Notification.permission === 'granted') {
        newNotifs.slice(0, 3).forEach(n => {
          new Notification(n.title, { body: n.body, icon: '/icon.png' })
        })
      }
    }
  }, [lastCheck])

  // Request notification permission
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Poll every 30s
  useEffect(() => {
    checkNotifications()
    const t = setInterval(checkNotifications, 30000)
    return () => clearInterval(t)
  }, [checkNotifications])

  // Listen for Nora events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.text) {
        const notif: Notification = {
          id: `nora-${Date.now()}`, type: 'nora' as NotificationType,
          title: 'Nora replied',
          body: detail.text.slice(0, 80),
          time: new Date(), read: false,
        }
        setNotifications(prev => [notif, ...prev].slice(0, 50))
      }
    }
    window.addEventListener('nora:reply', handler)
    return () => window.removeEventListener('nora:reply', handler)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button onClick={() => setOpen(!open)} title="Notifications"
        style={{
          background: unreadCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
          border: unreadCount > 0 ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, width: 36, height: 36,
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', position: 'relative', fontSize: 16,
        }}>
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#EF4444', color: '#fff',
            borderRadius: 99, minWidth: 18, height: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 800,
          }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          width: 360, maxHeight: 480, borderRadius: 16,
          background: 'rgba(11,20,38,0.98)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          zIndex: 10000, overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{
                background: 'none', border: 'none', color: '#A855F7',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>Mark all read</button>
            )}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13,
              }}>
                No notifications yet
              </div>
            ) : notifications.map(notif => {
              const config = TYPE_COLORS[notif.type]
              return (
                <div key={notif.id}
                  onClick={() => {
                    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
                    if (notif.action) window.open(notif.action, '_blank')
                  }}
                  style={{
                    display: 'flex', gap: 10, padding: '10px 16px',
                    cursor: 'pointer',
                    background: notif.read ? 'transparent' : 'rgba(168,85,247,0.03)',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    borderLeft: notif.read ? '3px solid transparent' : `3px solid ${config.color}`,
                  }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: config.bg, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>{config.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: notif.read ? 'rgba(255,255,255,0.5)' : '#fff',
                      fontSize: 12, fontWeight: notif.read ? 400 : 600,
                    }}>{notif.title}</div>
                    <div style={{
                      color: 'rgba(255,255,255,0.3)', fontSize: 11,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{notif.body}</div>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, flexShrink: 0 }}>
                    {timeAgo(notif.time)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
