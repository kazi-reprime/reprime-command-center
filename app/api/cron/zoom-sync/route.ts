/**
 * Cron: Sync Zoom Meetings
 *
 * Called by Vercel Cron or external scheduler every 15 minutes.
 * Syncs upcoming meetings from Zoom to local DB for faster queries.
 */

import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const { syncUpcomingMeetings } = await import('@/lib/zoom/meeting-sync')
    const result = await syncUpcomingMeetings()

    return NextResponse.json({
      ok: true,
      ...result,
      syncedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'sync_failed', message: (err as Error).message },
      { status: 500 },
    )
  }
}
