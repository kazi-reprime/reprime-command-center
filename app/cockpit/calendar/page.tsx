'use client'

import React, { useState, useMemo } from 'react'
import { Card, EmptyState } from '@/components/ui/shared'
import { LoadingState } from '@/components/ui/LiveStatus'
import { useToast } from '@/lib/contexts/ToastContext'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, Video, Star, MapPin, Users, ExternalLink } from 'lucide-react'

interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: string
  end?: string
  isJewish?: boolean
  location?: string
  type?: string
  link?: string | null
  attendees?: string[]
}

export default function CalendarPage() {
  const { addToast } = useToast()

  // Fetch from /api/calendar (returns flat array or error)
  const calendarQ = useQuery<CalendarEvent[]>({
    queryKey: ['calendar-events'],
    queryFn: async () => {
      const res = await fetch('/api/calendar', { cache: 'no-store' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to fetch calendar')
      }
      const data = await res.json()
      // API returns array directly (jewish events + google events)
      return Array.isArray(data) ? data : data.data || []
    },
  })

  const events = calendarQ.data ?? []
  const [filter, setFilter] = useState<'all' | 'today' | 'jewish' | 'zoom'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ─── Group events by date ───────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0]

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      if (filter === 'jewish') return ev.isJewish
      if (filter === 'zoom') {
        const desc = (ev.description || '').toLowerCase()
        return desc.includes('zoom.us') || ev.type === 'zoom' || (ev.link && ev.link.includes('zoom'))
      }
      if (filter === 'today') {
        const evDate = (ev.start || '').split('T')[0]
        return evDate === todayStr
      }
      return true
    })
  }, [events, filter, todayStr])

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of filtered) {
      const dateKey = (ev.start || '').split('T')[0] || 'Unknown'
      if (!map.has(dateKey)) map.set(dateKey, [])
      map.get(dateKey)!.push(ev)
    }
    // Sort each group by start time
    for (const [, evs] of map) {
      evs.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    }
    // Sort date keys
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const jewishCount = events.filter((e) => e.isJewish).length
  const zoomCount = events.filter(
    (e) =>
      (e.description || '').toLowerCase().includes('zoom.us') ||
      e.type === 'zoom' ||
      (e.link && e.link.includes('zoom'))
  ).length

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const formatTime = (isoStr: string) => {
    if (!isoStr || !isoStr.includes('T')) return 'All day'
    return new Date(isoStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatDateLabel = (dateStr: string) => {
    if (dateStr === todayStr) return 'Today'
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow'
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }

  const detectZoomLink = (ev: CalendarEvent): string | null => {
    if (ev.link && ev.link.includes('zoom')) return ev.link
    const desc = ev.description || ''
    const match = desc.match(/https:\/\/[^\s]*zoom\.us\/[^\s]*/i)
    return match ? match[0] : null
  }

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (calendarQ.isLoading) return <LoadingState message="Loading calendar..." />

  if (calendarQ.isError) {
    return (
      <div className="animate-in fade-in duration-500">
        <Card className="rounded-3xl">
          <EmptyState
            icon="📅"
            title="Calendar Unavailable"
            description="Could not connect to Google Calendar. Check your configuration in Settings."
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-sm">
            <Calendar className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Calendar</h1>
            <p className="text-xs font-bold tracking-widest text-text-muted uppercase">
              {events.length} event{events.length !== 1 ? 's' : ''} • {jewishCount} jewish
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'all' as const, label: 'All Events', count: events.length },
          { key: 'today' as const, label: 'Today', count: events.filter((e) => (e.start || '').split('T')[0] === todayStr).length },
          { key: 'jewish' as const, label: '✡️ Jewish', count: jewishCount },
          { key: 'zoom' as const, label: '📹 Zoom', count: zoomCount },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              filter === tab.key
                ? 'bg-accent/10 text-accent border border-blue-200'
                : 'bg-surface text-text-secondary border border-border hover:bg-surface-raised hover:text-text-primary'
            }`}
          >
            {tab.label}
            <span
              className={`ml-2 px-1.5 py-0.5 rounded-md text-xs font-bold ${
                filter === tab.key ? 'bg-accent/20 text-accent-hover' : 'bg-surface-raised text-text-muted'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Events */}
      {filtered.length === 0 ? (
        <Card className="rounded-3xl">
          <EmptyState
            icon="📅"
            title="No events found"
            description={
              filter === 'all'
                ? 'Your calendar is clear. Enjoy your day!'
                : 'No events match the selected filter.'
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([dateStr, dayEvents]) => (
            <div key={dateStr}>
              {/* Date Header */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-px flex-1 ${dateStr === todayStr ? 'bg-blue-200' : 'bg-surface-hover'}`} />
                <span
                  className={`text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full ${
                    dateStr === todayStr
                      ? 'bg-accent/10 text-accent border border-blue-200'
                      : 'bg-surface-raised text-text-muted border border-border'
                  }`}
                >
                  {formatDateLabel(dateStr)}
                </span>
                <div className={`h-px flex-1 ${dateStr === todayStr ? 'bg-blue-200' : 'bg-surface-hover'}`} />
              </div>

              {/* Events for this date */}
              <div className="flex flex-col gap-3">
                {dayEvents.map((ev) => {
                  const isExpanded = expandedId === ev.id
                  const zoomLink = detectZoomLink(ev)
                  const hasAttendees = ev.attendees && ev.attendees.length > 0

                  return (
                    <div
                      key={ev.id}
                      onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                      className={`glass-card rounded-3xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg group relative overflow-hidden ${
                        ev.isJewish ? 'border-l-4 border-l-amber-400' : ''
                      } ${isExpanded ? 'ring-2 ring-blue-200 shadow-lg' : ''}`}
                    >
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br from-blue-50 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                      <div className="relative z-10">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="text-sm font-bold text-text-primary">{ev.summary}</h3>
                              {ev.isJewish && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[10px] font-bold tracking-wider uppercase border border-amber-200">
                                  <Star className="w-3 h-3" />
                                  Jewish
                                </span>
                              )}
                              {zoomLink && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-bold tracking-wider uppercase border border-blue-200">
                                  <Video className="w-3 h-3" />
                                  Zoom
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-text-muted mb-2">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(ev.start)}
                                {ev.end && ev.end !== ev.start && ` – ${formatTime(ev.end)}`}
                              </span>
                              {ev.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate max-w-[200px]">{ev.location}</span>
                                </span>
                              )}
                            </div>

                            {/* Expanded details */}
                            {isExpanded && (
                              <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
                                {ev.description && (
                                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                                    {ev.description}
                                  </p>
                                )}
                                {hasAttendees && (
                                  <div className="flex items-start gap-2 text-xs text-text-muted">
                                    <Users className="w-3 h-3 mt-0.5 shrink-0" />
                                    <span>{ev.attendees!.join(', ')}</span>
                                  </div>
                                )}
                                {zoomLink && (
                                  <a
                                    href={zoomLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/10 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors border border-blue-200 w-fit"
                                  >
                                    <Video className="w-4 h-4" />
                                    Join Zoom Meeting
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Time badge */}
                          <div className="shrink-0 text-right">
                            <div className="text-sm font-bold text-text-primary">
                              {formatTime(ev.start) === 'All day' ? '🌅' : formatTime(ev.start)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
