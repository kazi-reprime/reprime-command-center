'use client'

import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'

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
      data-banner
      className="animate-in slide-in-from-top duration-500"
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 24px',
        background: activeMeeting
          ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.08) 0%, rgba(255, 255, 255, 0) 100%)'
          : 'linear-gradient(90deg, rgba(59, 130, 246, 0.08) 0%, rgba(255, 255, 255, 0) 100%)',
        borderBottom: '1px solid var(--border-main)',
        fontFamily: 'inherit',
        minHeight: 44,
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Status indicator */}
      <div className="flex items-center gap-3">
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: activeMeeting ? 'var(--status-error)' : 'var(--accent-blue)',
          boxShadow: activeMeeting ? '0 0 12px rgba(239, 68, 68, 0.4)' : '0 0 12px rgba(59, 130, 246, 0.4)',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: activeMeeting ? 'var(--status-error)' : 'var(--accent-blue)',
          flexShrink: 0,
        }}>
          {currentMeeting ? 'Live Now' : nextMeeting ? 'Up Next' : 'Core Focus'}
        </span>
      </div>

      {/* Task/Meeting title */}
      <span style={{
        flex: 1,
        fontSize: '0.85rem',
        fontWeight: 700,
        color: 'var(--text-main)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        letterSpacing: '-0.01em',
      }}>
        {activeMeeting ? activeMeeting.title : focusItem?.title}
      </span>

      {/* Details & Actions */}
      <div className="flex items-center gap-4">
        {activeMeeting && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.02em' }}>
            {formatTime(activeMeeting.startTime)} — {formatTime(activeMeeting.endTime)}
          </span>
        )}

        {activeMeeting?.zoomLink && (
          <a
            href={activeMeeting.zoomLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '6px 16px',
              borderRadius: 12,
              background: 'var(--accent-blue)',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 900,
              textDecoration: 'none',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
              transition: 'all 200ms',
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.35)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)';
            }}
          >
            Launch Meeting
          </a>
        )}

        {/* Dismiss */}
        <button
          onClick={(e) => {
            const banner = (e.target as HTMLElement).closest('[data-banner]') as HTMLElement
            if (banner) {
              banner.style.opacity = '0';
              banner.style.transform = 'translateY(-10px)';
              setTimeout(() => banner.style.display = 'none', 300);
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            padding: '4px',
            flexShrink: 0,
            opacity: 0.5,
            transition: 'opacity 200ms',
          }}
          onMouseOver={e => e.currentTarget.style.opacity = '1'}
          onMouseOut={e => e.currentTarget.style.opacity = '0.5'}
          title="Dismiss"
        >
          <X size={14} strokeWidth={3} />
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.9); }
        }
      `}</style>
    </div>
  )
}
