/**
 * Cron: Process Due Scheduled Messages
 *
 * Called by Vercel Cron or external scheduler every minute.
 * Processes any scheduled messages that are past their delivery time.
 */

import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const { processDueMessages } = await import('@/lib/whatsapp/scheduler')
    const result = await processDueMessages()

    return NextResponse.json({
      ok: true,
      ...result,
      processedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'cron_failed', message: (err as Error).message },
      { status: 500 },
    )
  }
}
