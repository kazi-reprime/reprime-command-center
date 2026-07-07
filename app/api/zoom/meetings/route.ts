/**
 * Zoom Meetings API Route
 *
 * GET  /api/zoom/meetings              → upcoming meetings
 * GET  /api/zoom/meetings?type=past    → past meetings with summaries
 * POST /api/zoom/meetings              → create a new meeting
 *
 * Calls Zoom API directly (not through gateway) since Zoom is a single-provider
 * service and the gateway capability routing adds unnecessary indirection.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

async function getZoomAccessToken(): Promise<string | null> {
  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET

  if (!accountId || !clientId || !clientSecret) return null

  try {
    const res = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=account_credentials&account_id=${accountId}`,
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.access_token || null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = (searchParams.get('type') || 'upcoming') as 'upcoming' | 'past'

  // Strategy 1: Try Zoom API directly
  const token = await getZoomAccessToken()

  if (token) {
    try {
      const endpoint = type === 'past'
        ? 'https://api.zoom.us/v2/past_meetings'
        : 'https://api.zoom.us/v2/users/me/meetings'

      const res = await fetch(`${endpoint}?page_size=20&type=${type === 'past' ? 'past' : 'upcoming'}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({
          meetings: data.meetings || [],
          type,
          source: 'zoom_api',
        })
      }
    } catch (err) {
      console.warn('[zoom/meetings] Zoom API failed, falling back:', (err as Error).message)
    }
  }

  // Strategy 2: Fall back to Supabase (synced meetings)
  try {
    const supabase = createServiceClient()
    const now = new Date().toISOString()

    const query = supabase
      .from('zoom_meetings')
      .select('*')
      .order('start_time', { ascending: type === 'upcoming' })
      .limit(20)

    if (type === 'upcoming') {
      query.gte('start_time', now)
    } else {
      query.lt('start_time', now)
    }

    const { data, error } = await query

    if (error) {
      // Table might not exist yet — return empty
      if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
        return NextResponse.json({ meetings: [], type, source: 'none', note: 'Run DB migration to enable zoom_meetings' })
      }
      throw error
    }

    return NextResponse.json({
      meetings: data || [],
      type,
      source: 'supabase',
    })
  } catch (err) {
    console.error('[zoom/meetings] All strategies failed:', (err as Error).message)
    // Strategy 3: Return Google Calendar meetings as fallback
    try {
      const { getTodayEvents } = await import('@/lib/google/calendar')
      const events = await getTodayEvents()
      const zoomMeetings = events
        .filter((e: { zoomLink: string | null }) => e.zoomLink)
        .map((e: { id: string; title: string; startTime: string; endTime: string; zoomLink: string | null; attendees: string[] }) => ({
          id: e.id,
          topic: e.title,
          start_time: e.startTime,
          end_time: e.endTime,
          join_url: e.zoomLink,
          attendees: e.attendees,
          source: 'calendar',
        }))
      return NextResponse.json({ meetings: zoomMeetings, type, source: 'google_calendar' })
    } catch {
      return NextResponse.json({ meetings: [], type, source: 'none' })
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic, start_time, duration, agenda } = body as {
      topic: string
      start_time: string
      duration?: number
      agenda?: string
    }

    if (!topic || !start_time) {
      return NextResponse.json({ error: 'topic and start_time required' }, { status: 400 })
    }

    const token = await getZoomAccessToken()
    if (!token) {
      return NextResponse.json(
        { error: 'Zoom not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.' },
        { status: 503 },
      )
    }

    const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic,
        type: 2, // Scheduled meeting
        start_time,
        duration: duration || 30,
        agenda: agenda || '',
        settings: {
          join_before_host: true,
          waiting_room: false,
          auto_recording: 'cloud',
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json(
        { error: 'meeting_creation_failed', message: `Zoom ${res.status}: ${errText.slice(0, 200)}` },
        { status: 502 },
      )
    }

    const meeting = await res.json()
    return NextResponse.json({ success: true, meeting })
  } catch (err) {
    console.error('[zoom/meetings] POST failed', (err as Error).message)
    return NextResponse.json(
      { error: 'meeting_create_error', message: (err as Error).message },
      { status: 500 },
    )
  }
}
