import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { getTodayEvents } from '@/lib/google/calendar'
import {
  listDeals,
  getStageNameMap,
  pipedriveDealUrl,
  type PipedriveDeal,
} from '@/lib/pipedrive/client'
import {
  computeSuggestedFocus,
  type CalendarBlock,
  type BucketCandidate,
  type SuggestedFocus,
} from '@/lib/center/soft-schedule'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'
const ACTIVE_DEALS_CACHE_TTL = 300 // 5 min
const ACTIVE_DEALS_CACHE_KEY = 'briefing:active-deals:v1'
const TODAY_CACHE_TTL = 60 // 1 min — payload-level cache keyed by CT date
const SECTION_TIMEOUT_MS = 3000

interface ActiveDeal {
  id: number
  title: string
  value: number
  currency: string
  stage: string
  stage_change_time: string | null
  pipedrive_url: string
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

/**
 * Race a promise against a 3s timer. Wraps any rejection so the section
 * resolves to null rather than throwing — caller flips degraded=true on null.
 * Eager: the promise must already be in flight when passed in.
 */
async function withTimeout<T>(p: Promise<T>, label: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const safe = p.catch((err) => {
    console.error(`[briefing] ${label} failed`, err)
    return null
  }) as Promise<T | null>
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.error(`[briefing] ${label} timed out after ${SECTION_TIMEOUT_MS}ms`)
      resolve(null)
    }, SECTION_TIMEOUT_MS)
  })
  try {
    return await Promise.race([safe, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function fetchActiveDeals(): Promise<ActiveDeal[]> {
  const redis = getRedis()
  if (redis) {
    try {
      const cached = await redis.get<ActiveDeal[]>(ACTIVE_DEALS_CACHE_KEY)
      if (cached) return cached
    } catch (err) {
      console.error('[briefing] active_deals cache read failed', err)
    }
  }

  // Pipedrive returns up to ~500 deals per page; sort=stage_change_time DESC
  // surfaces freshly-moved deals first. Asking for a generous limit and then
  // slicing gives us resilience to deals missing stage_change_time.
  let raw: PipedriveDeal[] = []
  try {
    raw = await listDeals({
      status: 'open',
      limit: 50,
      sort: 'stage_change_time DESC',
    })
  } catch (err) {
    console.error('[briefing] active_deals fetch failed', err)
    return []
  }

  let stageMap = new Map<number, string>()
  try {
    stageMap = await getStageNameMap()
  } catch (err) {
    console.error('[briefing] stages fetch failed', err)
  }

  const sorted = raw
    .filter((d) => d.status === 'open')
    .sort((a, b) => {
      const at = a.stage_change_time ? new Date(a.stage_change_time).getTime() : 0
      const bt = b.stage_change_time ? new Date(b.stage_change_time).getTime() : 0
      return bt - at
    })
    .slice(0, 10)

  const items: ActiveDeal[] = sorted.map((d) => ({
    id: d.id,
    title: d.title,
    value: d.value ?? 0,
    currency: d.currency ?? 'USD',
    stage: stageMap.get(d.stage_id) ?? `Stage ${d.stage_id}`,
    stage_change_time: d.stage_change_time ?? null,
    pipedrive_url: pipedriveDealUrl(d.id),
  }))

  if (redis) {
    try {
      await redis.set(ACTIVE_DEALS_CACHE_KEY, items, { ex: ACTIVE_DEALS_CACHE_TTL })
    } catch (err) {
      console.error('[briefing] active_deals cache write failed', err)
    }
  }
  return items
}

interface BriefingMeeting {
  id: string
  title: string
  startTime: string
  endTime: string
  zoomLink: string | null
}

interface BriefingThread {
  id: string
  contact_name: string | null
  phone: string | null
  panel: string | null
  channel_type: string | null
  is_investor: boolean
  unread_count: number
  last_message_at: string | null
  last_message_preview: string | null
}

interface TenantFiling {
  case_no: string
  tenant: string
  party_title: string | null
  court: string | null
  filed_at: string | null
  first_seen_at: string
}

type UnreadByPanel = { '305': number; '718': number; investors: number }

type ExpiringRow = {
  id: string
  contact_name: string | null
  contact_email: string | null
  expires_at: string
}

interface BriefingResponse {
  date: string
  meetings: {
    count: number
    first: BriefingMeeting | null
    nextUp: BriefingMeeting | null
    items: BriefingMeeting[]
  }
  unread: {
    total: number
    by_panel: UnreadByPanel
  }
  recent_investors: BriefingThread[]
  expiring_invitations: {
    count: number
    items: ExpiringRow[]
  }
  pending_followups: BriefingThread[]
  active_deals: ActiveDeal[]
  tenant_filings_today: TenantFiling[]
  suggested_focus: SuggestedFocus[]
  degraded?: boolean
}

/**
 * Returns the ISO instant for "today midnight in America/Chicago" — DST-aware,
 * works in both CDT and CST. Used to bucket inforuptcy_filings rows that
 * landed since the last cron run.
 */
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
  const ctAsUTC = Date.UTC(
    y,
    m - 1,
    d,
    Number(part('hour')) % 24,
    Number(part('minute')),
    Number(part('second')),
  )
  const offsetMs = ctAsUTC - now.getTime()
  const ctMidnightAsUTC = Date.UTC(y, m - 1, d, 0, 0, 0)
  return new Date(ctMidnightAsUTC - offsetMs).toISOString()
}

/**
 * CT-local YYYY-MM-DD for the cache key. Pinned to the user's wall-clock day
 * so a midnight rollover invalidates the cache without us doing anything.
 */
function ctDateKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function findNextUpId(events: BriefingMeeting[]): string | null {
  const now = Date.now()
  let bestId: string | null = null
  let bestDelta = Infinity
  for (const ev of events) {
    const t = new Date(ev.startTime).getTime()
    if (Number.isNaN(t)) continue
    const delta = t - now
    if (delta >= -5 * 60_000 && delta < bestDelta) {
      bestDelta = delta
      bestId = ev.id
    }
  }
  return bestId
}

async function fetchMeetings(): Promise<BriefingMeeting[]> {
  const events = await getTodayEvents()
  return events
    .map((e) => ({
      id: e.id,
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      zoomLink: e.zoomLink,
    }))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
}

async function fetchUnreadByPanel(
  svc: ReturnType<typeof createServiceClient>,
): Promise<UnreadByPanel> {
  const out: UnreadByPanel = { '305': 0, '718': 0, investors: 0 }
  const { data: rows, error } = await svc
    .from('whatsapp_threads')
    .select('panel, channel_type, is_investor, unread_count')
    .gt('unread_count', 0)
    .or('is_blocked.is.null,is_blocked.eq.false')
  if (error) throw error
  for (const r of (rows ?? []) as Array<{ panel?: string; is_investor?: boolean; unread_count?: number }>) {
    const n = r.unread_count ?? 0
    if (r.is_investor) out.investors += n
    else if (r.panel === '305') out['305'] += n
    else if (r.panel === '718') out['718'] += n
  }
  return out
}

async function fetchRecentInvestors(
  svc: ReturnType<typeof createServiceClient>,
): Promise<BriefingThread[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await svc
    .from('whatsapp_threads')
    .select('id, contact_name, phone, panel, channel_type, is_investor, unread_count, last_message_at, last_message_preview')
    .eq('is_investor', true)
    .or('is_blocked.is.null,is_blocked.eq.false')
    .gte('last_message_at', since)
    .order('last_message_at', { ascending: false })
    .limit(5)
  if (error) throw error
  return (data ?? []) as BriefingThread[]
}

async function fetchExpiringInvitations(
  svc: ReturnType<typeof createServiceClient>,
): Promise<ExpiringRow[]> {
  const horizon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await svc
    .from('invitations')
    .select('id, contact_name, contact_email, expires_at')
    .eq('status', 'sent')
    .lte('expires_at', horizon)
    .gte('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
    .limit(10)
  if (error) throw error
  return (data ?? []) as ExpiringRow[]
}

async function fetchPendingFollowups(
  svc: ReturnType<typeof createServiceClient>,
): Promise<BriefingThread[]> {
  const { data, error } = await svc
    .from('whatsapp_threads')
    .select('id, contact_name, phone, panel, channel_type, is_investor, unread_count, last_message_at, last_message_preview')
    .gt('unread_count', 0)
    .or('is_blocked.is.null,is_blocked.eq.false')
    .order('last_message_at', { ascending: false })
    .limit(5)
  if (error) throw error
  return (data ?? []) as BriefingThread[]
}

async function fetchTenantFilings(
  svc: ReturnType<typeof createServiceClient>,
): Promise<TenantFiling[]> {
  const since = midnightCTTodayISO()
  const { data, error } = await svc
    .from('inforuptcy_filings')
    .select('case_no, tenant, party_title, court, filed_at, first_seen_at')
    .gte('first_seen_at', since)
    .order('first_seen_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as TenantFiling[]
}

async function fetchOpenBucketCandidates(
  svc: ReturnType<typeof createServiceClient>,
): Promise<BucketCandidate[]> {
  const { data, error } = await svc
    .from('bucket_items')
    .select('id, title, priority, created_at')
    .eq('status', 'open')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(3)
  if (error) throw error
  return ((data ?? []) as Array<{ id: string; title: string; priority: number }>).map((r) => ({
    id: r.id,
    title: r.title,
    priority: r.priority,
  }))
}

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 60s payload cache, keyed by CT-local date so midnight rollover busts it.
  const cacheKey = `briefing:today:${ctDateKey()}:v1`
  const redis = getRedis()
  if (redis) {
    try {
      const cached = await redis.get<BriefingResponse>(cacheKey)
      if (cached) return NextResponse.json(cached)
    } catch (err) {
      console.error('[briefing] payload cache read failed', err)
    }
  }

  const svc = createServiceClient()
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Chicago',
  })

  // Kick off every section in parallel; each is timeout-guarded and never
  // throws. A single slow source can no longer block the whole briefing.
  const [
    meetingsResult,
    unreadResult,
    investorsResult,
    expiringResult,
    followupsResult,
    activeDealsResult,
    tenantFilingsResult,
    bucketCandidatesResult,
  ] = await Promise.all([
    withTimeout(fetchMeetings(), 'meetings'),
    withTimeout(fetchUnreadByPanel(svc), 'unread_by_panel'),
    withTimeout(fetchRecentInvestors(svc), 'recent_investors'),
    withTimeout(fetchExpiringInvitations(svc), 'expiring_invitations'),
    withTimeout(fetchPendingFollowups(svc), 'pending_followups'),
    withTimeout(fetchActiveDeals(), 'active_deals'),
    withTimeout(fetchTenantFilings(svc), 'tenant_filings'),
    withTimeout(fetchOpenBucketCandidates(svc), 'bucket_candidates'),
  ])

  let degraded = false
  function unwrap<T>(value: T | null, fallback: T): T {
    if (value === null) {
      degraded = true
      return fallback
    }
    return value
  }

  const meetings = unwrap(meetingsResult, [])
  const unreadByPanel = unwrap(unreadResult, { '305': 0, '718': 0, investors: 0 })
  const recentInvestors = unwrap(investorsResult, [])
  const expiringItems = unwrap(expiringResult, [])
  const pendingFollowups = unwrap(followupsResult, [])
  const activeDeals = unwrap(activeDealsResult, [])
  const tenantFilings = unwrap(tenantFilingsResult, [])
  const bucketCandidates = unwrap(bucketCandidatesResult, [])

  const nextUpId = findNextUpId(meetings)
  const nextUp = meetings.find((m) => m.id === nextUpId) ?? null

  // Pure function — pair top open bucket items with free calendar gaps
  // ≥ 90 min between now and 18:00 CT. Skip on Shabbat. See lib/center/soft-schedule.ts.
  let suggestedFocus: SuggestedFocus[] = []
  try {
    const blocks: CalendarBlock[] = meetings
      .filter((m) => Boolean(m.endTime))
      .map((m) => ({ startTime: m.startTime, endTime: m.endTime }))
    suggestedFocus = computeSuggestedFocus(blocks, bucketCandidates, new Date())
  } catch (err) {
    console.error('[briefing] suggested_focus failed', err)
  }

  const payload: BriefingResponse = {
    date: dateStr,
    meetings: {
      count: meetings.length,
      first: meetings[0] ?? null,
      nextUp,
      items: meetings,
    },
    unread: {
      total: unreadByPanel['305'] + unreadByPanel['718'] + unreadByPanel.investors,
      by_panel: unreadByPanel,
    },
    recent_investors: recentInvestors,
    expiring_invitations: {
      count: expiringItems.length,
      items: expiringItems,
    },
    pending_followups: pendingFollowups,
    active_deals: activeDeals,
    tenant_filings_today: tenantFilings,
    suggested_focus: suggestedFocus,
    ...(degraded ? { degraded: true } : {}),
  }

  // Only cache clean payloads. Degraded responses re-try every request so
  // a transient failure doesn't pin the briefing into a broken state.
  if (redis && !degraded) {
    try {
      await redis.set(cacheKey, payload, { ex: TODAY_CACHE_TTL })
    } catch (err) {
      console.error('[briefing] payload cache write failed', err)
    }
  }

  return NextResponse.json(payload)
}
