/**
 * Zoom Meetings API Route
 *
 * GET  /api/zoom/meetings              → upcoming meetings
 * GET  /api/zoom/meetings?type=past    → past meetings with summaries
 * POST /api/zoom/meetings              → create a new meeting
 */

import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = (searchParams.get('type') || 'upcoming') as 'upcoming' | 'past'

  try {
    const { gateway } = await import('@/lib/gateway')
    const result = await gateway.listMeetings({ type })

    if (!result.success) {
      return NextResponse.json(
        { error: 'meetings_fetch_failed', message: result.error },
        { status: 502 },
      )
    }

    return NextResponse.json({
      meetings: result.data?.meetings || [],
      type,
    })
  } catch (err) {
    console.error('[zoom/meetings] GET failed', (err as Error).message)
    return NextResponse.json(
      { error: 'meetings_error', message: (err as Error).message },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic, start_time, duration, agenda, attendees } = body as {
      topic: string
      start_time: string
      duration?: number
      agenda?: string
      attendees?: string[]
    }

    if (!topic || !start_time) {
      return NextResponse.json(
        { error: 'topic and start_time required' },
        { status: 400 },
      )
    }

    const { gateway } = await import('@/lib/gateway')
    const result = await gateway.createMeeting({
      topic,
      startTime: start_time,
      duration: duration || 30,
      agenda,
      attendees,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: 'meeting_creation_failed', message: result.error },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success: true,
      meeting: result.data,
    })
  } catch (err) {
    console.error('[zoom/meetings] POST failed', (err as Error).message)
    return NextResponse.json(
      { error: 'meeting_create_error', message: (err as Error).message },
      { status: 500 },
    )
  }
}
