import { NextResponse, type NextRequest } from 'next/server'
import { Redis } from '@upstash/redis'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const BATCH_LIMIT = 100
const DEDUPE_TTL_SECONDS = 300

/**
 * POST /api/bucket/fire-reminders — Vercel cron worker (every minute).
 *
 * Selects up to 100 reminders where fire_at <= now() and fired_at is null,
 * stamps fired_at = now() on each, and lets Supabase Realtime deliver the
 * UPDATE to the toast subscriber on the kiosk.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}. If CRON_SECRET is unset the
 * endpoint refuses to run rather than silently fanning out reminders.
 *
 * Dedupe: per-row Upstash key `reminder:fired:${id}` TTL 300s. Guards
 * against the cron being double-invoked within a minute.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'cron_secret_not_configured' },
      { status: 503 }
    )
  }
  const header = request.headers.get('authorization') || ''
  if (header !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const nowIso = new Date().toISOString()

  const { data: due, error: selectError } = await service
    .from('reminders')
    .select('id, bucket_item_id, fire_at, payload')
    .lte('fire_at', nowIso)
    .is('fired_at', null)
    .order('fire_at', { ascending: true })
    .limit(BATCH_LIMIT)
  if (selectError) {
    console.error('[fire-reminders] select failed', selectError.message)
    return NextResponse.json(
      { error: 'db_select_failed', detail: selectError.message },
      { status: 500 }
    )
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ fired: 0 })
  }

  const redis = getRedis()
  let fired = 0
  const failures: Array<{ id: string; error: string }> = []

  for (const row of due) {
    if (redis) {
      const key = `reminder:fired:${row.id}`
      const claim = await redis.set(key, nowIso, {
        nx: true,
        ex: DEDUPE_TTL_SECONDS,
      })
      if (claim !== 'OK') {
        continue
      }
    }

    const { error: updateError } = await service
      .from('reminders')
      .update({ fired_at: nowIso })
      .eq('id', row.id)
      .is('fired_at', null)
    if (updateError) {
      failures.push({ id: row.id, error: updateError.message })
      continue
    }
    fired++
  }

  return NextResponse.json({ fired, failures })
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}
