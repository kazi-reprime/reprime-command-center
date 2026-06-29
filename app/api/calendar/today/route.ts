import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { createServerClient } from '@/lib/supabase/server'
import { getTodayEvents } from '@/lib/google/calendar'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'
const CACHE_TTL = 300

type CalendarEvent = Awaited<ReturnType<typeof getTodayEvents>>[number]

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function todayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `calendar:today:${y}-${m}-${d}`
}

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const redis = getRedis()
  const cacheKey = todayKey()

  if (redis) {
    const cached = await redis.get<CalendarEvent[]>(cacheKey)
    if (cached) {
      return NextResponse.json({ events: cached, cached: true })
    }
  }

  let events: CalendarEvent[]
  try {
    events = await getTodayEvents()
  } catch (err) {
    return NextResponse.json(
      { error: 'calendar_error', message: (err as Error).message },
      { status: 502 }
    )
  }

  events.sort((a, b) => {
    const ta = new Date(a.startTime).getTime()
    const tb = new Date(b.startTime).getTime()
    return ta - tb
  })

  if (redis) {
    await redis.set(cacheKey, events, { ex: CACHE_TTL })
  }

  return NextResponse.json({ events, cached: false })
}
