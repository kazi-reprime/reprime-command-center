'use client'

import { useQuery } from '@tanstack/react-query'

const REFETCH_MS = 30_000

interface ActiveMeeting {
  id: string
  title: string
  startTime: string
  endTime: string
  zoomLink: string | null
  attendees: string[]
}

interface BriefingPayload {
  meetings: {
    items: ActiveMeeting[]
  }
  suggested_focus?: { title: string; item_id: string; priority: number }[]
}

/**
 * ActiveTaskBanner — red live status banner showing the current in-progress
 * meeting or focus task. Sits between TopStrip and the column canvas.
 */
export default function ActiveTaskBanner() {
  const briefing = useQuery<BriefingPayload>({
    queryKey: ['briefing-today'],
    queryFn: async () => {
      const res = await fetch('/api/briefing/today', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: 2,
  })

  const now = new Date()
  const meetings = briefing.data?.meetings?.items ?? []

  // Find current meeting (happening right now)
  const currentMeeting = meetings.find(m => {
    const start = new Date(m.startTime)
    const end = new Date(m.endTime)
    return now >= start && now <= end
  })

  // Find next upcoming meeting (within 15 min)
  const nextMeeting = !currentMeeting ? meetings.find(m => {
    const start = new Date(m.startTime)
    const diff = start.getTime() - now.getTime()
    return diff > 0 && diff < 15 * 60_000
  }) : null

  const activeMeeting = currentMeeting || nextMeeting
  const focusItem = briefing.data?.suggested_focus?.[0]

  if (!activeMeeting && !focusItem) return null

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 16px',
        background: activeMeeting
          ? 'linear-gradient(90deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)'
          : 'linear-gradient(90deg, rgba(255,204,51,0.1) 0%, rgba(255,204,51,0.03) 100%)',
        borderBottom: activeMeeting
          ? '1px solid rgba(239,68,68,0.2)'
          : '1px solid rgba(255,204,51,0.1)',
        fontFamily: 'inherit',
        minHeight: 36,
      }}
    >
      {/* Status dot */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: activeMeeting ? '#EF4444' : 'var(--rp-gold, #FFCC33)',
        boxShadow: activeMeeting ? '0 0 8px rgba(239,68,68,0.5)' : '0 0 6px rgba(255,204,51,0.3)',
        animation: 'pulse 2s ease-in-out infinite',
        flexShrink: 0,
      }} />

      {/* Status label */}
      <span style={{
        fontSize: 9,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: activeMeeting ? '#EF4444' : 'var(--rp-gold, #FFCC33)',
        flexShrink: 0,
      }}>
        {currentMeeting ? 'In progress' : nextMeeting ? 'Starting soon' : 'Focus'}
      </span>

      {/* Task/Meeting title */}
      <span style={{
        flex: 1,
        fontSize: 11,
        fontWeight: 500,
        color: '#F5EFD8',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {activeMeeting ? activeMeeting.title : focusItem?.title}
      </span>

      {/* Time */}
      {activeMeeting && (
        <span style={{ fontSize: 10, color: 'rgba(255,204,51,0.4)', flexShrink: 0 }}>
          {formatTime(activeMeeting.startTime)}
        </span>
      )}

      {/* Zoom button */}
      {activeMeeting?.zoomLink && (
        <a
          href={activeMeeting.zoomLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '3px 12px',
            borderRadius: 5,
            background: 'var(--rp-gold, #FFCC33)',
            color: '#0E3470',
            fontSize: 10,
            fontWeight: 800,
            textDecoration: 'none',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          Join Now
        </a>
      )}

      {/* Dismiss */}
      <button
        onClick={(e) => {
          // Hide the banner for this session
          const banner = (e.target as HTMLElement).closest('[data-banner]') as HTMLElement
          if (banner) banner.style.display = 'none'
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,204,51,0.3)',
          cursor: 'pointer',
          fontSize: 12,
          padding: '2px 4px',
          flexShrink: 0,
        }}
        title="Dismiss"
      >
        ✕
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
