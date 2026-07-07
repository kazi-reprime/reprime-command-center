/**
 * useZoomMeetings — Real Zoom meeting data fetching
 *
 * Fetches upcoming and past meetings from /api/zoom/meetings.
 * Includes meeting briefs and summaries.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'

interface ZoomMeeting {
  id: number | string
  topic: string
  startTime: string
  duration: number
  joinUrl: string
  status?: string
  participants?: number
  summary?: string
  actionItems?: Array<{ description: string; assignee?: string; priority?: string }>
}

export function useZoomMeetings(type: 'upcoming' | 'past' = 'upcoming') {
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/zoom/meetings?type=${type}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Fetch failed: ${res.status}`)
      }
      const data = await res.json()
      setMeetings(data.meetings || [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [type])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  const createMeeting = useCallback(async (params: {
    topic: string
    start_time: string
    duration?: number
    agenda?: string
  }) => {
    const res = await fetch('/api/zoom/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Create failed')
    }
    const data = await res.json()
    // Refresh the list
    await fetchMeetings()
    return data.meeting
  }, [fetchMeetings])

  // Get the next upcoming meeting
  const nextMeeting = meetings.length > 0
    ? meetings.reduce((closest, m) => {
        const mTime = new Date(m.startTime).getTime()
        const cTime = new Date(closest.startTime).getTime()
        const now = Date.now()
        if (mTime > now && mTime < cTime) return m
        return closest
      }, meetings[0])
    : null

  return {
    meetings,
    loading,
    error,
    refresh: fetchMeetings,
    createMeeting,
    nextMeeting,
    totalMeetings: meetings.length,
  }
}
