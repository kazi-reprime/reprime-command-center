'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import ConciergeButtons from './ConciergeButtons'

interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  zoomLink: string | null
  attendees: string[]
}

interface CalendarPayload {
  events: CalendarEvent[]
  cached: boolean
}

// ── Meeting reminder types ────────────────────────────────────────────────────

interface ReminderData {
  enabled: boolean
  meetingTitle: string
  startTime: string
  attendeeEmail: string | null
  phone: string | null          // resolved Pipedrive phone
  threadId: string | null       // resolved whatsapp_threads id
  panel: string | null          // '305' | '718'
  sent10: boolean               // 10-min reminder fired
  sent1: boolean                // 1-min reminder fired
}

type ReminderMap = Record<string, ReminderData>

const REMINDER_KEY = 'meeting-reminders-v2'

function loadReminders(): ReminderMap {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(REMINDER_KEY) : null
    return raw ? (JSON.parse(raw) as ReminderMap) : {}
  } catch {
    return {}
  }
}

function saveReminders(map: ReminderMap) {
  try {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(map))
  } catch {}
}

// ── Reminder resolution ───────────────────────────────────────────────────────

async function resolveReminderData(
  meetingId: string,
  title: string,
  startTime: string,
  attendeeEmail: string | null
): Promise<Pick<ReminderData, 'phone' | 'threadId' | 'panel' | 'attendeeEmail'>> {
  let phone: string | null = null
  let threadId: string | null = null
  let panel: string | null = null

  // 1. Resolve phone from Pipedrive
  if (attendeeEmail) {
    try {
      const res = await fetch(`/api/pipedrive/resolve?phone=${encodeURIComponent(attendeeEmail)}`)
      if (res.ok) {
        const data = await res.json()
        const phones: Array<{ value: string; primary?: boolean }> = Array.isArray(data?.person?.phone)
          ? data.person.phone
          : []
        const primary = phones.find((p) => p?.primary) || phones[0]
        if (primary?.value) phone = String(primary.value)
      }
    } catch {
      // non-fatal
    }
  }

  // 2. Find whatsapp thread by phone
  if (phone) {
    try {
      const normalized = phone.replace(/\D+/g, '')
      const res = await fetch(`/api/whatsapp/threads?panel=305`)
      if (res.ok) {
        const data = await res.json()
        type ThreadRow = { id: string; phone: string; panel: string }
        const threads: ThreadRow[] = data?.threads ?? data ?? []
        const match = threads.find(
          (t: ThreadRow) => t.phone.replace(/\D+/g, '').endsWith(normalized) || normalized.endsWith(t.phone.replace(/\D+/g, ''))
        )
        if (match) {
          threadId = match.id
          panel = match.panel
        }
      }
      // Try 718 if not found in 305
      if (!threadId) {
        const res2 = await fetch(`/api/whatsapp/threads?panel=718`)
        if (res2.ok) {
          const data2 = await res2.json()
          type ThreadRow = { id: string; phone: string; panel: string }
          const threads2: ThreadRow[] = data2?.threads ?? data2 ?? []
          const match2 = threads2.find(
            (t: ThreadRow) => t.phone.replace(/\D+/g, '').endsWith(normalized) || normalized.endsWith(t.phone.replace(/\D+/g, ''))
          )
          if (match2) {
            threadId = match2.id
            panel = match2.panel
          }
        }
      }
    } catch {
      // non-fatal
    }
  }

  return { phone, threadId, panel, attendeeEmail }
}

// ── Send reminder ─────────────────────────────────────────────────────────────

async function sendReminderMessage(
  reminder: ReminderData,
  minutesBefore: number
): Promise<boolean> {
  if (!reminder.threadId || !reminder.panel) return false

  const body =
    minutesBefore === 10
      ? `Reminder: we have a call in 10 minutes — ${reminder.meetingTitle}`
      : `Reminder: our meeting starts in 1 minute — ${reminder.meetingTitle}`

  try {
    const res = await fetch('/api/whatsapp/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        panel: reminder.panel,
        thread_id: reminder.threadId,
        body,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

const REFETCH_MS = 5 * 60 * 1000

function formatAbsolute(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatRelative(iso: string, now: Date): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = d.getTime() - now.getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < -60) return `${Math.round(-diffMin / 60)}h ago`
  if (diffMin < -1) return `${-diffMin}m ago`
  if (diffMin <= 1 && diffMin >= -1) return 'now'
  if (diffMin < 60) return `in ${diffMin}m`
  const diffHr = Math.round(diffMin / 60)
  return `in ${diffHr}h`
}

function findNextUpId(events: CalendarEvent[], now: Date): string | null {
  let bestId: string | null = null
  let bestDelta = Infinity
  for (const ev of events) {
    const t = new Date(ev.startTime).getTime()
    if (Number.isNaN(t)) continue
    const delta = t - now.getTime()
    if (delta >= -5 * 60_000 && delta < bestDelta) {
      bestDelta = delta
      bestId = ev.id
    }
  }
  return bestId
}

export default function TodayPanel() {
  const [now, setNow] = useState(() => new Date())
  const [reminders, setReminders] = useState<ReminderMap>(() => loadReminders())
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const reminderRef = useRef(reminders)
  reminderRef.current = reminders

  // Clock tick
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  // Reminder check loop — every 30 seconds
  useEffect(() => {
    const check = () => {
      const map = reminderRef.current
      const nowMs = Date.now()
      let dirty = false

      const updated: ReminderMap = { ...map }
      for (const [id, r] of Object.entries(updated)) {
        if (!r.enabled) continue
        const startMs = new Date(r.startTime).getTime()
        if (Number.isNaN(startMs)) continue

        const diffMin = (startMs - nowMs) / 60_000

        // 10-minute window: between 10.5 and 9.5 min before
        if (!r.sent10 && diffMin >= 9.5 && diffMin <= 10.5) {
          updated[id] = { ...r, sent10: true }
          dirty = true
          void sendReminderMessage(r, 10)
        }
        // 1-minute window: between 1.5 and 0.5 min before
        if (!r.sent1 && diffMin >= 0.5 && diffMin <= 1.5) {
          updated[id] = { ...r, sent1: true }
          dirty = true
          void sendReminderMessage(r, 1)
        }
      }

      if (dirty) {
        setReminders(updated)
        saveReminders(updated)
      }
    }

    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [])

  const toggleReminder = useCallback(
    async (ev: CalendarEvent) => {
      const current = reminderRef.current[ev.id]
      if (current?.enabled) {
        // Turn off
        const updated = {
          ...reminderRef.current,
          [ev.id]: { ...current, enabled: false },
        }
        setReminders(updated)
        saveReminders(updated)
        return
      }

      // Turn on — resolve contact
      setTogglingId(ev.id)
      try {
        const firstAttendee = ev.attendees?.[0] ?? null
        const resolved = await resolveReminderData(ev.id, ev.title, ev.startTime, firstAttendee)
        const newData: ReminderData = {
          enabled: true,
          meetingTitle: ev.title,
          startTime: ev.startTime,
          attendeeEmail: resolved.attendeeEmail,
          phone: resolved.phone,
          threadId: resolved.threadId,
          panel: resolved.panel,
          sent10: false,
          sent1: false,
        }
        const updated = { ...reminderRef.current, [ev.id]: newData }
        setReminders(updated)
        saveReminders(updated)
      } finally {
        setTogglingId(null)
      }
    },
    []
  )

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['calendar', 'today'],
    queryFn: async (): Promise<CalendarPayload> => {
      const res = await fetch('/api/calendar/today', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as CalendarPayload
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })

  const events = data?.events ?? []
  const nextUpId = findNextUpId(events, now)

  const containerStyle: React.CSSProperties = {
    background: 'var(--rp-navy)',
    color: 'var(--rp-white)',
    borderBottom: '1px solid var(--rp-border)',
    padding: '0.75rem 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    overflowX: 'auto',
    flexShrink: 0,
    minHeight: 90,
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--rp-gold)',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 0,
  }

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div style={labelStyle}>Today</div>
        <div style={{ color: 'var(--rp-gold-lite)', fontSize: 12 }}>Loading…</div>
      </div>
    )
  }

  if (isError) {
    return (
      <div style={containerStyle}>
        <div style={labelStyle}>Today</div>
        <div style={{ color: 'var(--rp-red)', fontSize: 12 }}>
          Calendar failed: {(error as Error).message}
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={labelStyle}>Today</div>
        <div style={{ color: 'var(--rp-gold-lite)', fontSize: 12 }}>No meetings today</div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>Today</div>
      {events.map((ev) => {
        const isNextUp = ev.id === nextUpId
        const reminder = reminders[ev.id]
        const reminderOn = reminder?.enabled ?? false
        const isToggling = togglingId === ev.id
        const hasThread = !!(reminder?.threadId)

        const cardStyle: React.CSSProperties = {
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--rp-surface)',
          borderLeft: isNextUp ? '3px solid var(--rp-gold)' : '3px solid transparent',
          borderRadius: 6,
          padding: '0.55rem 0.9rem',
          fontSize: 13,
          whiteSpace: 'nowrap',
        }

        const timeAbs = formatAbsolute(ev.startTime)
        const timeRel = formatRelative(ev.startTime, now)

        return (
          <div key={ev.id} style={cardStyle} title={ev.title}>
            {/* Time */}
            <span suppressHydrationWarning style={{ color: 'var(--rp-gold-lite)', fontSize: 13 }}>
              {timeAbs}
              {timeRel && <span suppressHydrationWarning style={{ opacity: 0.75 }}> · {timeRel}</span>}
            </span>

            {/* Title */}
            <span
              style={{
                color: 'var(--rp-white)',
                fontWeight: isNextUp ? 600 : 500,
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {ev.title}
            </span>

            {/* Zoom link */}
            {ev.zoomLink && (
              <a
                href={ev.zoomLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--rp-gold)', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}
              >
                Zoom↗
              </a>
            )}

            {/* 🔔 Reminder toggle */}
            <button
              type="button"
              onClick={() => void toggleReminder(ev)}
              disabled={isToggling}
              title={
                isToggling
                  ? 'Resolving contact…'
                  : reminderOn
                  ? `Reminder ON${hasThread ? ' (WhatsApp ready)' : ' (phone unresolved — will skip)'}\nClick to turn off`
                  : 'Turn on WhatsApp reminder (10 min + 1 min)'
              }
              style={{
                background: reminderOn ? (hasThread ? 'rgba(34,197,94,0.15)' : 'rgba(255, 204, 51,0.15)') : 'transparent',
                border: `1px solid ${reminderOn ? (hasThread ? '#22c55e' : '#FFCC33') : 'rgba(255,255,255,0.2)'}`,
                borderRadius: 4,
                color: reminderOn ? (hasThread ? '#22c55e' : '#FFCC33') : 'rgba(255,255,255,0.35)',
                cursor: isToggling ? 'wait' : 'pointer',
                fontSize: 16,
                padding: '3px 6px',
                fontFamily: 'inherit',
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {isToggling ? '⏳' : reminderOn ? '🔔' : '🔕'}
            </button>

            {/* Late / Can't make it — inline */}
            <ConciergeButtons
              meeting={{
                id: ev.id,
                title: ev.title,
                startTime: ev.startTime,
                attendees: ev.attendees,
                zoomLink: ev.zoomLink,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
