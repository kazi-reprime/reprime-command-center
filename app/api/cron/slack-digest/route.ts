import { NextResponse, type NextRequest } from 'next/server'
import { Redis } from '@upstash/redis'
import { createServiceClient } from '@/lib/supabase/server'
import { postSlack } from '@/lib/slack/client'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/slack-digest — Vercel cron worker (08:00 America/Chicago).
 *
 * Aggregates the last 24h of overnight activity from Supabase and posts a
 * single Slack message via SLACK_WEBHOOK_URL.
 *
 * Sections:
 *   1. New bucket items
 *   2. Reminders that fired
 *   3. New outbound asks awaiting reply
 *   4. New Inforuptcy filings
 *   5. Investors that moved to "cold" (delta vs previous run, persisted in Redis)
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 *   - Missing/wrong header  → 401
 *   - Missing CRON_SECRET   → 503
 *   - Missing SLACK_WEBHOOK_URL but bearer ok → 200 { sent: false, reason: 'no_webhook' }
 *
 * Cron schedule (vercel.json): "0 13 * * *" = 13:00 UTC = 08:00 CDT (DST).
 * In CST (winter) this fires at 07:00 — close enough; we don't want a separate
 * winter cron line and the digest is a soft signal, not a deadline.
 */

const CADENCE_SNAPSHOT_KEY = 'cadence:snapshot:yesterday'
const CADENCE_SNAPSHOT_TTL = 60 * 60 * 25 // 25h — survives until tomorrow's run
const CADENCE_CRON_API_PATH = '/api/cron/investor-cadence'

interface BucketItem {
  id: string
  title: string
  priority: number
  assigned_to: string | null
}

interface ReminderRow {
  id: string
  bucket_item_id: string
  fire_at: string
  fired_at: string
}

interface OutboundAskRow {
  id: string
  recipient_identifier: string
  channel: string
  expected_reply_by: string
}

interface FilingRow {
  case_no: string
  tenant: string
  party_title: string | null
  court: string | null
}

interface CadenceItem {
  pipedrive_id: number
  name: string
  status: 'cold' | 'cooling' | 'warm' | 'hot'
  lastOutboundAt: string | null
  lastInboundAt: string | null
}

function daysSinceLabel(it: CadenceItem): string {
  const ts = it.lastInboundAt ?? it.lastOutboundAt
  if (!ts) return 'no contact on record'
  const ms = Date.now() - new Date(ts).getTime()
  const days = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
  return `${days}d silent`
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

async function fetchNewlyColdInvestors(
  redis: Redis | null,
  origin: string,
  cronSecret: string,
): Promise<{ items: CadenceItem[]; newlyCold: CadenceItem[] }> {
  let items: CadenceItem[] = []
  let newlyCold: CadenceItem[] = []

  if (origin) {
    try {
      const res = await fetch(`${origin}${CADENCE_CRON_API_PATH}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          'content-type': 'application/json',
        },
        body: '{}',
        cache: 'no-store',
      })
      if (res.ok) {
        const json = (await res.json()) as { items?: CadenceItem[] }
        items = json.items ?? []
      } else {
        console.error(
          '[slack-digest] cadence fetch non-ok',
          res.status,
          (await res.text()).slice(0, 200),
        )
      }
    } catch (err) {
      console.error('[slack-digest] cadence fetch failed', err)
    }
  }

  if (!redis) {
    return { items, newlyCold }
  }

  try {
    const previousMap =
      (await redis.get<Record<string, string>>(CADENCE_SNAPSHOT_KEY)) ?? {}
    if (items.length > 0) {
      const currentMap: Record<string, string> = {}
      for (const it of items) {
        currentMap[String(it.pipedrive_id)] = it.status
      }
      newlyCold = items.filter((it) => {
        const prev = previousMap[String(it.pipedrive_id)]
        return it.status === 'cold' && prev && prev !== 'cold'
      })
      await redis.set(CADENCE_SNAPSHOT_KEY, currentMap, {
        ex: CADENCE_SNAPSHOT_TTL,
      })
    }
  } catch (err) {
    console.error('[slack-digest] cadence delta failed', err)
  }

  return { items, newlyCold }
}

function formatDigest(parts: {
  bucketItems: BucketItem[]
  firedReminders: ReminderRow[]
  newAsks: OutboundAskRow[]
  filings: FilingRow[]
  newlyCold: CadenceItem[]
}): { text: string; blocks: unknown[] } {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Chicago',
  })

  const lines: string[] = [`*Overnight digest — ${dateStr}*`]

  if (parts.bucketItems.length > 0) {
    lines.push(`\n*New bucket items (${parts.bucketItems.length})*`)
    for (const b of parts.bucketItems.slice(0, 10)) {
      const owner = b.assigned_to ? ` → ${b.assigned_to}` : ''
      lines.push(`• [P${b.priority}] ${b.title}${owner}`)
    }
    if (parts.bucketItems.length > 10) {
      lines.push(`…and ${parts.bucketItems.length - 10} more`)
    }
  }

  if (parts.firedReminders.length > 0) {
    lines.push(`\n*Reminders fired (${parts.firedReminders.length})*`)
    for (const r of parts.firedReminders.slice(0, 10)) {
      lines.push(`• ${r.bucket_item_id.slice(0, 8)} at ${r.fired_at}`)
    }
  }

  if (parts.newAsks.length > 0) {
    lines.push(`\n*Outbound asks awaiting reply (${parts.newAsks.length})*`)
    for (const a of parts.newAsks.slice(0, 10)) {
      lines.push(`• ${a.channel}: ${a.recipient_identifier} (due ${a.expected_reply_by})`)
    }
  }

  if (parts.filings.length > 0) {
    lines.push(`\n*New Inforuptcy filings (${parts.filings.length})*`)
    for (const f of parts.filings.slice(0, 10)) {
      const court = f.court ? ` — ${f.court}` : ''
      lines.push(`• ${f.tenant}: ${f.case_no}${court}`)
    }
  }

  if (parts.newlyCold.length > 0) {
    lines.push(`\n*Investors gone cold (${parts.newlyCold.length})*`)
    for (const c of parts.newlyCold.slice(0, 10)) {
      lines.push(`• ${c.name} — ${daysSinceLabel(c)}`)
    }
  }

  if (lines.length === 1) {
    lines.push('\nNothing overnight. Quiet night.')
  }

  const text = lines.join('\n')
  const blocks = [
    { type: 'section', text: { type: 'mrkdwn', text } },
  ]
  return { text, blocks }
}

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'cron_secret_not_configured' },
      { status: 503 },
    )
  }
  const header = request.headers.get('authorization') || ''
  if (header !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const counts = {
    bucket_items: 0,
    fired_reminders: 0,
    new_asks: 0,
    filings: 0,
    newly_cold: 0,
  }

  // 1. New bucket items in last 24h.
  let bucketItems: BucketItem[] = []
  try {
    const { data, error } = await service
      .from('bucket_items')
      .select('id, title, priority, assigned_to')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    bucketItems = (data ?? []) as BucketItem[]
    counts.bucket_items = bucketItems.length
  } catch (err) {
    console.error('[slack-digest] bucket_items failed', err)
  }

  // 2. Reminders fired in last 24h.
  let firedReminders: ReminderRow[] = []
  try {
    const { data, error } = await service
      .from('reminders')
      .select('id, bucket_item_id, fire_at, fired_at')
      .gte('fired_at', since)
      .order('fired_at', { ascending: false })
      .limit(50)
    if (error) throw error
    firedReminders = (data ?? []) as ReminderRow[]
    counts.fired_reminders = firedReminders.length
  } catch (err) {
    console.error('[slack-digest] reminders failed', err)
  }

  // 3. New outbound asks awaiting reply.
  let newAsks: OutboundAskRow[] = []
  try {
    const { data, error } = await service
      .from('outbound_asks')
      .select('id, recipient_identifier, channel, expected_reply_by')
      .gte('sent_at', since)
      .eq('status', 'open')
      .order('sent_at', { ascending: false })
      .limit(50)
    if (error) throw error
    newAsks = (data ?? []) as OutboundAskRow[]
    counts.new_asks = newAsks.length
  } catch (err) {
    console.error('[slack-digest] outbound_asks failed', err)
  }

  // 4. New Inforuptcy filings (first_seen in last 24h).
  let filings: FilingRow[] = []
  try {
    const { data, error } = await service
      .from('inforuptcy_filings')
      .select('case_no, tenant, party_title, court')
      .gte('first_seen_at', since)
      .order('first_seen_at', { ascending: false })
      .limit(50)
    if (error) throw error
    filings = (data ?? []) as FilingRow[]
    counts.filings = filings.length
  } catch (err) {
    console.error('[slack-digest] inforuptcy_filings failed', err)
  }

  // 5. Investors that moved to cold since previous digest run.
  const redis = getRedis()
  const origin = request.nextUrl?.origin ?? ''
  const { newlyCold } = await fetchNewlyColdInvestors(redis, origin, expected)
  counts.newly_cold = newlyCold.length

  const { text, blocks } = formatDigest({
    bucketItems,
    firedReminders,
    newAsks,
    filings,
    newlyCold,
  })

  const result = await postSlack({ text, blocks })

  return NextResponse.json({
    sent: result.sent,
    reason: result.reason,
    counts,
  })
}
