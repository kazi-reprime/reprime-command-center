import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { getTodayEvents } from '@/lib/google/calendar'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'
const CACHE_TTL = 120 // 2 min

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

/** ISO instant for "today midnight in America/Chicago" — DST-aware. */
function midnightCTTodayISO(): string {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
  const y = Number(part('year'))
  const m = Number(part('month'))
  const d = Number(part('day'))
  const ctAsUTC = Date.UTC(y, m - 1, d, Number(part('hour')) % 24, Number(part('minute')), Number(part('second')))
  const offsetMs = ctAsUTC - now.getTime()
  const ctMidnightAsUTC = Date.UTC(y, m - 1, d, 0, 0, 0)
  return new Date(ctMidnightAsUTC - offsetMs).toISOString()
}

function ctDateKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

interface EveningItem {
  id: string
  who: string
  detail: string
}

interface EveningResponse {
  date: string
  greeting: string
  handled: { replies_closed_today: number; meetings_today: number }
  open: {
    unread_total: number
    overdue_followups: number
    open_tasks: number
    expiring_invitations: number
  }
  loose_ends: EveningItem[]
  degraded?: boolean
}

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cacheKey = `briefing:evening:${ctDateKey()}:v1`
  const redis = getRedis()
  if (redis) {
    try {
      const cached = await redis.get<EveningResponse>(cacheKey)
      if (cached) return NextResponse.json(cached)
    } catch (err) {
      console.error('[briefing/evening] cache read failed', err)
    }
  }

  const svc = createServiceClient()
  const nowIso = new Date().toISOString()
  const midnight = midnightCTTodayISO()
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Chicago',
  })

  let degraded = false
  const fail = (label: string, err: unknown) => {
    degraded = true
    console.error(`[briefing/evening] ${label} failed`, err)
  }

  const [
    meetingsRes,
    unreadRes,
    overdueRes,
    repliedTodayRes,
    openTasksRes,
    expiringRes,
    looseRes,
  ] = await Promise.allSettled([
    getTodayEvents(),
    svc
      .from('whatsapp_threads')
      .select('unread_count')
      .gt('unread_count', 0)
      .or('is_blocked.is.null,is_blocked.eq.false'),
    svc
      .from('outbound_asks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .lt('expected_reply_by', nowIso),
    svc
      .from('outbound_asks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'replied')
      .gte('closed_at', midnight),
    svc.from('bucket_items').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    svc
      .from('invitations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('expires_at', nowIso),
    svc
      .from('whatsapp_threads')
      .select('id, contact_name, phone, last_message_preview')
      .gt('unread_count', 0)
      .or('is_blocked.is.null,is_blocked.eq.false')
      .order('last_message_at', { ascending: false })
      .limit(6),
  ])

  const meetingsToday =
    meetingsRes.status === 'fulfilled' ? meetingsRes.value.length : (fail('meetings', meetingsRes), 0)

  let unreadTotal = 0
  if (unreadRes.status === 'fulfilled' && !unreadRes.value.error) {
    for (const r of (unreadRes.value.data ?? []) as Array<{ unread_count?: number }>) {
      unreadTotal += r.unread_count ?? 0
    }
  } else {
    fail('unread', unreadRes)
  }

  const countOf = (res: PromiseSettledResult<{ count: number | null; error: unknown }>, label: string): number => {
    if (res.status === 'fulfilled' && !res.value.error) return res.value.count ?? 0
    fail(label, res)
    return 0
  }

  const overdueFollowups = countOf(overdueRes as never, 'overdue')
  const repliesClosedToday = countOf(repliedTodayRes as never, 'replied_today')
  const openTasks = countOf(openTasksRes as never, 'open_tasks')
  const expiringInvitations = countOf(expiringRes as never, 'expiring')

  const looseEnds: EveningItem[] = []
  if (looseRes.status === 'fulfilled' && !looseRes.value.error) {
    for (const r of (looseRes.value.data ?? []) as Array<{
      id: string
      contact_name: string | null
      phone: string | null
      last_message_preview: string | null
    }>) {
      looseEnds.push({
        id: r.id,
        who: r.contact_name || r.phone || 'Unknown',
        detail: r.last_message_preview || 'Awaiting your reply.',
      })
    }
  } else {
    fail('loose_ends', looseRes)
  }

  const payload: EveningResponse = {
    date: dateStr,
    greeting: 'Erev tov, Gideon.',
    handled: { replies_closed_today: repliesClosedToday, meetings_today: meetingsToday },
    open: {
      unread_total: unreadTotal,
      overdue_followups: overdueFollowups,
      open_tasks: openTasks,
      expiring_invitations: expiringInvitations,
    },
    loose_ends: looseEnds,
    ...(degraded ? { degraded: true } : {}),
  }

  if (redis && !degraded) {
    try {
      await redis.set(cacheKey, payload, { ex: CACHE_TTL })
    } catch (err) {
      console.error('[briefing/evening] cache write failed', err)
    }
  }

  return NextResponse.json(payload)
}
