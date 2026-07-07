import { NextResponse } from 'next/server'
import { getTodayEvents } from '@/lib/google/calendar'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!process.env.GOOGLE_REFRESH_TOKEN || !process.env.GOOGLE_OAUTH_CLIENT_ID) {
    return NextResponse.json({ 
      data: [], 
      source: 'unavailable', 
      warning: 'Google Calendar not configured. Please set GOOGLE_REFRESH_TOKEN.' 
    })
  }

  try {
    const events = await getTodayEvents()
    // Map to Cockpit format
    const mapped = events.map(e => ({
      id: e.id,
      title: e.title,
      start: e.startTime,
      end: e.endTime,
      location: e.location || '',
      type: e.zoomLink ? 'zoom' : e.hangoutLink ? 'meet' : 'other',
      link: e.zoomLink || e.hangoutLink || null,
      attendees: e.attendees
    }))
    return NextResponse.json({ data: mapped, source: 'live_google' })
  } catch (error) {
    console.error('[api/cockpit/calendar] failed:', error)
    return NextResponse.json({ 
      data: [], 
      source: 'unavailable', 
      error: String(error) 
    }, { status: 500 })
  }
}
