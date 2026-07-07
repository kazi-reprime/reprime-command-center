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
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans">
      {/* Header */}
      <div className="px-4 py-3 flex justify-between items-center">
        <div>
          <div className="text-blue-600 text-xs font-black uppercase tracking-widest">
            📅 {now.toLocaleDateString('en-US', { weekday: 'short' })} · {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
          {hebrew && (
            <div className="text-slate-400 text-[10px] mt-1 font-bold tracking-wider">
              {hebrew.date}
              {hebrew.candles && <span> · 🕯 {hebrew.candles}</span>}
              {hebrew.havdalah && <span> · ✡ {hebrew.havdalah}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pb-3 border-b border-slate-100">
        {(['today', 'tomorrow', 'week'] as TabView[]).map(t => (
          <button 
            key={t} 
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg border-none cursor-pointer text-[10px] font-black uppercase tracking-widest transition-colors ${
              tab === t 
                ? 'bg-blue-50 text-blue-600 shadow-sm' 
                : 'bg-transparent text-slate-400 hover:bg-slate-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Events */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {briefing.isLoading && (
          <div className="p-4 text-center text-slate-400 text-xs font-bold">
            Loading calendar...
          </div>
        )}
        {briefing.isError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold shadow-sm">
            ⚠️ Calendar failed to load. Check Google Calendar credentials.
          </div>
        )}
        {!briefing.isLoading && meetings.length === 0 && (
          <div className="p-4 text-center text-slate-400 text-xs font-bold">
            No meetings today
          </div>
        )}
        {meetings.map(m => {
          const isCurrent = isCurrentMeeting(m)
          const isNext = isUpcoming(m)
          
          let cardClasses = 'p-3 rounded-xl shadow-sm transition-all border-l-4 '
          if (isCurrent) {
            cardClasses += 'bg-red-50 border border-red-100 border-l-red-500'
          } else if (isNext) {
            cardClasses += 'bg-amber-50 border border-amber-100 border-l-amber-500'
          } else {
            cardClasses += 'bg-slate-50 border border-slate-100 border-l-blue-400'
          }

          return (
            <div key={m.id} className={cardClasses}>
              <div className="flex justify-between items-start mb-1">
                <span className="text-slate-500 text-[10px] font-black tracking-widest">
                  {formatTime(m.startTime)}
                </span>
                {isCurrent && (
                  <span className="text-[9px] px-2 py-0.5 rounded-md bg-red-500 text-white font-black uppercase tracking-widest">NOW</span>
                )}
                {isNext && !isCurrent && (
                  <span className="text-[9px] px-2 py-0.5 rounded-md bg-amber-500 text-white font-black uppercase tracking-widest">STARTS SOON</span>
                )}
              </div>
              
              <div className={`text-sm font-bold mb-1 leading-tight ${isCurrent ? 'text-red-900' : isNext ? 'text-amber-900' : 'text-slate-800'}`}>
                {m.title}
              </div>
              
              {(m.attendees?.length ?? 0) > 0 && (
                <div className="text-slate-500 text-[10px] mb-2 font-medium">
                  {(m.attendees ?? []).slice(0, 3).join(', ')}{(m.attendees?.length ?? 0) > 3 ? ` +${(m.attendees?.length ?? 0) - 3}` : ''}
                </div>
              )}
              
              {m.zoomLink && (
                <a 
                  href={m.zoomLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`inline-block px-3 py-1.5 rounded-lg text-[10px] font-black no-underline tracking-widest uppercase transition-colors ${
                    isCurrent 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                      : isNext 
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  Join Zoom
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
