import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { triggerEvent } from '@/lib/pagerduty/events'

export const dynamic = 'force-dynamic'

const PAGE_LIMIT = 100

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return true
  const header = request.headers.get('authorization') || ''
  return header === `Bearer ${expected}`
}

/**
 * Hourly cron — flips reminded_at on every open ask whose expected_reply_by
 * has passed but has not yet been reminded. Optionally fires a single
 * PagerDuty rollup event so the kiosk gets a heads-up.
 *
 * Vercel cron schedule (registered in vercel.json): "0 * * * *".
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const now = new Date().toISOString()

  const { data: due, error: selErr } = await service
    .from('outbound_asks')
    .select('id, recipient_identifier, channel, sent_at, expected_reply_by')
    .eq('status', 'open')
    .is('reminded_at', null)
    .lt('expected_reply_by', now)
    .order('expected_reply_by', { ascending: true })
    .limit(PAGE_LIMIT)

  if (selErr) {
    return NextResponse.json(
      { error: 'select_failed', message: selErr.message },
      { status: 500 }
    )
  }

  const ids = (due ?? []).map((r) => r.id)
  if (ids.length === 0) {
    return NextResponse.json({ reminded: 0 })
  }

  const { error: updErr } = await service
    .from('outbound_asks')
    .update({ reminded_at: now })
    .in('id', ids)

  if (updErr) {
    return NextResponse.json(
      { error: 'update_failed', message: updErr.message },
      { status: 500 }
    )
  }

  // One rollup PagerDuty event per cron tick — we don't want N pages for N
  // overdue asks. Non-fatal: if PD is misconfigured, we still flipped the rows.
  try {
    await triggerEvent({
      summary: `${ids.length} outbound ask${ids.length === 1 ? '' : 's'} overdue`,
      source: 'secretary/poll-overdue',
      severity: 'warning',
      dedupKey: `secretary-overdue-${new Date().toISOString().slice(0, 13)}`,
      component: 'secretary',
      customDetails: {
        sample: (due ?? []).slice(0, 5).map((r) => ({
          recipient: r.recipient_identifier,
          channel: r.channel,
          expected_reply_by: r.expected_reply_by,
        })),
      },
    })
  } catch (err) {
    console.error('[secretary/poll-overdue] pagerduty non-fatal', (err as Error).message)
  }

  return NextResponse.json({ reminded: ids.length })
}
