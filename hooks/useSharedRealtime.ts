/**
 * useSharedRealtime — Single shared realtime hook for both Command Center experiences.
 *
 * Subscribes to Supabase Realtime for live updates and pushes data to the
 * Zustand store. Both /center and /cockpit mount this through Providers,
 * ensuring a single source of truth with no duplicate subscriptions.
 *
 * Handles:
 * - WhatsApp thread/message updates
 * - Notification polling (WhatsApp unreads, upcoming meetings)
 * - System health polling
 * - Task updates
 */

'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabaseClient } from '@/lib/supabaseClient'
import { useStore } from '@/lib/store/useStore'
import type { Notification as StoreNotification, NotificationType, ServiceHealth, SystemHealth } from '@/lib/store/useStore'

const NOTIFICATION_POLL_MS = 30_000
const HEALTH_POLL_MS = 60_000

export function useSharedRealtime() {
  const {
    addNotifications,
    setSystemHealth,
    setTasks,
  } = useStore()
  const lastCheckRef = useRef<Record<string, number>>({})
  const mountedRef = useRef(true)

  // ── Notification Polling ─────────────────────────────────────────────────

  const checkNotifications = useCallback(async () => {
    if (!mountedRef.current) return
    const newNotifs: StoreNotification[] = []

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
            if (!lastCheckRef.current[key]) {
              newNotifs.push({
                id: key,
                type: 'whatsapp' as NotificationType,
                title: t.contact_name || t.phone,
                body: t.last_message_preview || 'New message',
                time: new Date(t.last_message_at || Date.now()),
                read: false,
              })
            }
          }
        }
      }
    } catch { /* swallow */ }

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
            if (!lastCheckRef.current[key]) {
              newNotifs.push({
                id: key,
                type: 'zoom' as NotificationType,
                title: m.title || 'Meeting',
                body: `Starts in ${Math.ceil(minsUntil)} minutes`,
                time: new Date(),
                read: false,
                action: m.zoomLink || undefined,
              })
            }
          }
        }
      }
    } catch { /* swallow */ }

    if (newNotifs.length > 0) {
      addNotifications(newNotifs)
      // Update lastCheck
      const updates: Record<string, number> = {}
      newNotifs.forEach(n => { updates[n.id] = Date.now() })
      lastCheckRef.current = { ...lastCheckRef.current, ...updates }

      // Browser notification
      if (typeof window !== 'undefined' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        newNotifs.slice(0, 3).forEach(n => {
          new Notification(n.title, { body: n.body, icon: '/icon.png' })
        })
      }
    }
  }, [addNotifications])

  // ── System Health Polling ────────────────────────────────────────────────

  const checkHealth = useCallback(async () => {
    if (!mountedRef.current) return
    try {
      const res = await fetch('/api/health', { cache: 'no-store' })
      if (!res.ok) return
      const h = await res.json()
      const healthData = h?.data || h

      const services: ServiceHealth[] = [
        { label: 'Nora AI', status: !!(healthData?.env?.ANTHROPIC_API_KEY || healthData?.env?.OPENAI_API_KEY) ? 'Live' : 'Error', isOk: !!(healthData?.env?.ANTHROPIC_API_KEY || healthData?.env?.OPENAI_API_KEY) },
        { label: 'WhatsApp', status: !!(healthData?.adapters?.whatsapp?.isConfigured) ? 'Live' : 'Error', isOk: !!(healthData?.adapters?.whatsapp?.isConfigured) },
        { label: 'Gmail', status: !!(healthData?.env?.GOOGLE_REFRESH_TOKEN) ? 'Live' : 'Error', isOk: !!(healthData?.env?.GOOGLE_REFRESH_TOKEN) },
        { label: 'Database', status: !!(healthData?.db?.reachable) ? 'Live' : 'Error', isOk: !!(healthData?.db?.reachable) },
        { label: 'Zoom', status: !!(healthData?.env?.ZOOM_ACCOUNT_ID || healthData?.adapters?.zoom?.isConfigured) ? 'Live' : 'Error', isOk: !!(healthData?.env?.ZOOM_ACCOUNT_ID || healthData?.adapters?.zoom?.isConfigured) },
      ]

      setSystemHealth({ services, lastChecked: Date.now() })
    } catch { /* swallow */ }
  }, [setSystemHealth])

  // ── Task Fetching ────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    if (!mountedRef.current) return
    try {
      const res = await fetch('/api/tasks', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setTasks(Array.isArray(data) ? data : data.data || [])
      }
    } catch { /* swallow */ }
  }, [setTasks])

  // ── Mount Effect ─────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true

    // Request browser notification permission
    if (typeof window !== 'undefined' && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Initial fetches
    checkNotifications()
    checkHealth()
    fetchTasks()

    // Polling intervals
    const notifInterval = setInterval(checkNotifications, NOTIFICATION_POLL_MS)
    const healthInterval = setInterval(checkHealth, HEALTH_POLL_MS)

    // Supabase Realtime: listen for new WhatsApp messages and thread updates
    const channel = supabaseClient
      .channel('shared-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        () => {
          // Refresh notifications when a new message arrives
          checkNotifications()
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_threads' },
        () => {
          checkNotifications()
        },
      )
      .subscribe()

    // Listen for Nora events (cross-component communication)
    const noraHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.text) {
        const { addNotification } = useStore.getState()
        addNotification({
          id: `nora-${Date.now()}`,
          type: 'nora' as NotificationType,
          title: 'Nora replied',
          body: detail.text.slice(0, 80),
          time: new Date(),
          read: false,
        })
      }
    }
    window.addEventListener('nora:reply', noraHandler)

    // Listen for Nora status changes (bridge CustomEvent to Zustand)
    const noraStatusHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.status) {
        const { setNoraStatus } = useStore.getState()
        setNoraStatus(detail.status)
      }
    }
    window.addEventListener('nora:status', noraStatusHandler)
    window.addEventListener('nora-state-change', noraStatusHandler)

    return () => {
      mountedRef.current = false
      clearInterval(notifInterval)
      clearInterval(healthInterval)
      supabaseClient.removeChannel(channel)
      window.removeEventListener('nora:reply', noraHandler)
      window.removeEventListener('nora:status', noraStatusHandler)
      window.removeEventListener('nora-state-change', noraStatusHandler)
    }
  }, [checkNotifications, checkHealth, fetchTasks])
}
