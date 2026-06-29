import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { triggerEvent, type Severity } from '@/lib/pagerduty/events'

export const dynamic = 'force-dynamic'

const PD_QUEUE_KEY = 'pagerduty:queue'
const BATCH_LIMIT = 50

interface QueuedAlert {
  summary: string
  severity: Severity
  dedupKey?: string
  customDetails?: Record<string, unknown>
  component?: string
  group?: string
  class?: string
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return true
  const header = request.headers.get('authorization') || ''
  return header === `Bearer ${expected}`
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const redis = getRedis()
  if (!redis) {
    return NextResponse.json({ error: 'upstash_not_configured' }, { status: 503 })
  }

  const now = Date.now()
  const due = (await redis.zrange(PD_QUEUE_KEY, 0, now, {
    byScore: true,
    offset: 0,
    count: BATCH_LIMIT,
  })) as string[]

  if (!due || due.length === 0) {
    return NextResponse.json({ dispatched: 0 })
  }

  let dispatched = 0
  const failures: Array<{ member: string; error: string }> = []

  for (const member of due) {
    let parsed: QueuedAlert | null = null
    try {
      parsed = typeof member === 'string' ? (JSON.parse(member) as QueuedAlert) : (member as unknown as QueuedAlert)
    } catch {
      await redis.zrem(PD_QUEUE_KEY, member)
      failures.push({ member: String(member).slice(0, 200), error: 'unparseable_member' })
      continue
    }
    try {
      await triggerEvent({
        summary: parsed.summary,
        source: 'bookings/cron-dispatch',
        severity: parsed.severity,
        dedupKey: parsed.dedupKey,
        component: parsed.component ?? 'bookings',
        customDetails: parsed.customDetails,
      })
      await redis.zrem(PD_QUEUE_KEY, member)
      dispatched++
    } catch (err) {
      failures.push({ member: String(member).slice(0, 200), error: (err as Error).message })
    }
  }

  return NextResponse.json({ dispatched, failures })
}
