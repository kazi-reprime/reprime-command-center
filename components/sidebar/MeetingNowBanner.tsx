'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

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
}

const NAVY = '#0E3470'
const GOLD = '#FFCC33'
const LIVE = '#A855F7'    /* Live-now violet — matches legend */

const DISMISS_KEY = 'meeting-now-dismissed-v1'
const SHOW_WINDOW_MIN = 10 // show banner from T-1 to T+10

function loadDismissed(): Set<string> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(DISMISS_KEY) : null
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(arr)
  } catch {
    return new Set()
  }
}

function saveDismissed(set: Set<string>) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(set)))
  } catch {}
}

function findStartingMeeting(events: CalendarEvent[], dismissed: Set<string>, now: number): CalendarEvent | null {
  for (const ev of events) {
    if (dismissed.has(ev.id)) continue
    const startMs = new Date(ev.startTime).getTime()
    if (Number.isNaN(startMs)) continue
    const diffMin = (startMs - now) / 60_000
    if (diffMin <= 1 && diffMin >= -SHOW_WINDOW_MIN) {
      return ev
    }
  }
  return null
}

export default function MeetingNowBanner() {
  const [now, setNow] = useState(() => Date.now())
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed())
  const [opened, setOpened] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(tick)
  }, [])

  const { data } = useQuery<CalendarPayload>({
    queryKey: ['calendar', 'today'],
    queryFn: async () => {
      const res = await fetch('/api/calendar/today', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as CalendarPayload
    },
    refetchInterval: 60_000,
    staleTime: 60_000,
  })

  const events = data?.events ?? []
  const meeting = findStartingMeeting(events, dismissed, now)

  if (!meeting) return null

  const startMs = new Date(meeting.startTime).getTime()
  const diffMin = Math.round((startMs - now) / 60_000)
  const label =
    diffMin > 0 ? `starts in ${diffMin}m`
      : diffMin === 0 ? 'starting now'
        : `started ${-diffMin}m ago`

  const dismiss = () => {
    const next = new Set(dismissed)
    next.add(meeting.id)
    setDismissed(next)
    saveDismissed(next)
  }

  const openZoom = () => {
    if (!meeting.zoomLink) return
    window.open(meeting.zoomLink, '_blank', 'noopener,noreferrer')
    const next = new Set(opened)
    next.add(meeting.id)
    setOpened(next)
  }

  const wasOpened = opened.has(meeting.id)

  return (
    <div
      style={{
        background: `linear-gradient(90deg, ${NAVY} 0%, ${NAVY} 60%, rgba(168, 85, 247, 0.22) 100%)`,
        borderBottom: `1px solid ${LIVE}`,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 16px',
        fontFamily: 'inherit',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(168, 85, 247, 0.22)',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: LIVE,
          flexShrink: 0,
          animation: 'meetingNowPulse 1.4s ease-in-out infinite',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, letterSpacing: '0.04em' }}>
          {label.toUpperCase()}
        </div>
        <div style={{ fontSize: 14, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
          {meeting.title}
        </div>
      </div>

      {meeting.zoomLink && (
        <button
          type="button"
          onClick={openZoom}
          style={{
            background: wasOpened ? 'rgba(255, 204, 51, 0.18)' : GOLD,
            color: wasOpened ? GOLD : NAVY,
            border: wasOpened ? `1px solid ${GOLD}` : 0,
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.06em',
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          {wasOpened ? 'Reopen Zoom →' : 'Join Zoom →'}
        </button>
      )}

      <button
        type="button"
        onClick={dismiss}
        title="Dismiss"
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.25)',
          color: 'rgba(255,255,255,0.65)',
          padding: '6px 10px',
          fontSize: 11,
          cursor: 'pointer',
          fontFamily: 'inherit',
          letterSpacing: '0.06em',
          flexShrink: 0,
        }}
      >
        ✕
      </button>

      <style jsx>{`
        @keyframes meetingNowPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  )
}
