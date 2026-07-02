'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

const REFETCH_MS = 60_000

interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  zoomLink: string | null
  attendees: string[]
  location?: string
}

interface CalendarPayload {
  date: string
  meetings: {
    count: number
    first: CalendarEvent | null
    nextUp: CalendarEvent | null
    items: CalendarEvent[]
  }
  hebrew?: { date: string; holiday?: string; candles?: string; havdalah?: string }
  suggested_focus?: unknown[]
}

type TabView = 'today' | 'tomorrow' | 'week'

export function useColumnCount(): number {
  const { data } = useQuery<CalendarPayload>({
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
  return data?.meetings?.count ?? 0
}

export default function CalendarColumn() {
  const [tab, setTab] = useState<TabView>('today')

  const briefing = useQuery<CalendarPayload>({
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

  const meetings = useMemo(() => {
    return briefing.data?.meetings?.items ?? []
  }, [briefing.data])

  const hebrew = briefing.data?.hebrew

  const now = new Date()
  const isCurrentMeeting = (m: CalendarEvent) => {
    const start = new Date(m.startTime)
    const end = new Date(m.endTime)
    return now >= start && now <= end
  }
  const isUpcoming = (m: CalendarEvent) => {
    const start = new Date(m.startTime)
    const diff = start.getTime() - now.getTime()
    return diff > 0 && diff < 30 * 60_000
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Header */}
      <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: 'var(--rp-gold, #FFCC33)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            📅 {now.toLocaleDateString('en-US', { weekday: 'short' })} · {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
          {hebrew && (
            <div style={{ color: 'var(--rp-gold-lite, rgba(255,204,51,0.4))', fontSize: 10, marginTop: 2 }}>
              {hebrew.date}
              {hebrew.candles && <span> · 🕯 {hebrew.candles}</span>}
              {hebrew.havdalah && <span> · ✡ {hebrew.havdalah}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '0 12px 8px', borderBottom: '1px solid rgba(255,204,51,0.08)' }}>
        {(['today', 'tomorrow', 'week'] as TabView[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: tab === t ? 'rgba(255,204,51,0.15)' : 'transparent',
              color: tab === t ? 'var(--rp-gold, #FFCC33)' : 'rgba(255,204,51,0.3)',
              fontSize: 10, fontWeight: 700, fontFamily: 'inherit', textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >{t}</button>
        ))}
      </div>

      {/* Events */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {briefing.isLoading && (
          <div style={{ padding: 16, textAlign: 'center', color: 'rgba(255,204,51,0.3)', fontSize: 11 }}>
            Loading calendar...
          </div>
        )}
        {briefing.isError && (
          <div style={{ padding: 12, margin: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444', fontSize: 11 }}>
            ⚠️ Calendar failed to load. Check Google Calendar credentials.
          </div>
        )}
        {!briefing.isLoading && meetings.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: 'rgba(255,204,51,0.25)', fontSize: 11 }}>
            No meetings today
          </div>
        )}
        {meetings.map(m => {
          const isCurrent = isCurrentMeeting(m)
          const isNext = isUpcoming(m)
          return (
            <div key={m.id} style={{
              margin: '2px 6px', padding: '8px 10px', borderRadius: 8,
              background: isCurrent ? 'rgba(239,68,68,0.08)' : isNext ? 'rgba(255,204,51,0.06)' : 'rgba(0,0,0,0.1)',
              border: isCurrent ? '1px solid rgba(239,68,68,0.2)' : isNext ? '1px solid rgba(255,204,51,0.1)' : '1px solid transparent',
              borderLeft: isCurrent ? '3px solid #EF4444' : isNext ? '3px solid var(--rp-gold, #FFCC33)' : '3px solid transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                <span style={{ color: 'var(--rp-gold-lite, rgba(255,204,51,0.5))', fontSize: 10, fontWeight: 600 }}>
                  {formatTime(m.startTime)}
                </span>
                {isCurrent && (
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#EF4444', color: '#fff', fontWeight: 700 }}>NOW</span>
                )}
                {isNext && !isCurrent && (
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'var(--rp-gold, #FFCC33)', color: '#0E3470', fontWeight: 700 }}>STARTS</span>
                )}
              </div>
              <div style={{ color: '#F5EFD8', fontSize: 12, fontWeight: 500, marginBottom: 2, lineHeight: 1.3 }}>
                {m.title}
              </div>
              {m.attendees.length > 0 && (
                <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: 10, marginBottom: 4 }}>
                  {m.attendees.slice(0, 3).join(', ')}{m.attendees.length > 3 ? ` +${m.attendees.length - 3}` : ''}
                </div>
              )}
              {m.zoomLink && (
                <a href={m.zoomLink} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 5,
                    background: 'var(--rp-gold, #FFCC33)', color: '#0E3470',
                    fontSize: 10, fontWeight: 700, textDecoration: 'none',
                    letterSpacing: '0.04em',
                  }}
                >Join Zoom</a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
