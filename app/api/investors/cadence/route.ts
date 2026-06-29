import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import {
  listInvestorTaggedPersons,
  type InvestorTagTier,
  type InvestorTaggedPerson,
} from '@/lib/pipedrive/client'
import {
  scoreInvestorCadence,
  compareCadenceColdestFirst,
  type CadenceStatus,
  type InvestorTier,
} from '@/lib/scoring/investor-cadence'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'
const CACHE_KEY = 'investors:cadence:v1'
const CACHE_TTL = 300 // 5 min
const TOP_N = 50

interface CadenceRow {
  pipedrive_id: number
  name: string
  tier: InvestorTagTier | null
  score: number
  status: CadenceStatus
  reasons: string[]
  lastOutboundAt: string | null
  lastInboundAt: string | null
  openAsksCount: number
  overdueAsksCount: number
}

interface AskRow {
  recipient_identifier: string
  sent_at: string
  expected_reply_by: string
  status: 'open' | 'replied' | 'closed_no_reply' | 'snoozed'
  closed_at: string | null
}

interface Aggregate {
  lastOutboundAt: string | null
  lastInboundAt: string | null
  openAsks: number
  overdueAsks: number
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function buildIdentifierIndex(
  investors: InvestorTaggedPerson[],
): { lookup: Map<string, InvestorTaggedPerson>; identifiers: string[] } {
  const lookup = new Map<string, InvestorTaggedPerson>()
  const identifiers = new Set<string>()
  for (const p of investors) {
    for (const e of p.emails) {
      const raw = e.trim()
      if (!raw) continue
      const lc = raw.toLowerCase()
      lookup.set(lc, p)
      lookup.set(raw, p)
      identifiers.add(lc)
      identifiers.add(raw)
    }
    for (const ph of p.phones) {
      const raw = ph.trim()
      if (!raw) continue
      lookup.set(raw, p)
      identifiers.add(raw)
    }
  }
  return { lookup, identifiers: Array.from(identifiers) }
}

function resolveTier(t: InvestorTagTier | null): InvestorTier {
  // Untagged tier defaults to C (neutral 1.0x). Documented in lib/scoring.
  return (t ?? 'C') as InvestorTier
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
  if (redis) {
    try {
      const cached = await redis.get<CadenceRow[]>(CACHE_KEY)
      if (cached) {
        return NextResponse.json({ items: cached, cached: true })
      }
    } catch (err) {
      console.error('[cadence] cache read failed', err)
    }
  }

  // 1. Pipedrive investors (tag starts with 'investor').
  let investors: InvestorTaggedPerson[] = []
  try {
    investors = await listInvestorTaggedPersons()
  } catch (err) {
    console.error('[cadence] pipedrive fetch failed', err)
    return NextResponse.json(
      { error: 'pipedrive_fetch_failed', detail: (err as Error).message },
      { status: 500 },
    )
  }

  if (investors.length === 0) {
    return NextResponse.json({ items: [], cached: false })
  }

  // 2. Build identifier index for matching outbound_asks → investor.
  const { lookup, identifiers } = buildIdentifierIndex(investors)

  // 3. Pull every outbound_ask whose recipient_identifier hits one of our IDs.
  const aggregates = new Map<number, Aggregate>()
  for (const p of investors) {
    aggregates.set(p.id, {
      lastOutboundAt: null,
      lastInboundAt: null,
      openAsks: 0,
      overdueAsks: 0,
    })
  }

  if (identifiers.length > 0) {
    try {
      const svc = createServiceClient()
      const { data: rows, error } = await svc
        .from('outbound_asks')
        .select('recipient_identifier, sent_at, expected_reply_by, status, closed_at')
        .in('recipient_identifier', identifiers)
      if (error) throw error
      const nowMs = Date.now()
      for (const r of (rows ?? []) as AskRow[]) {
        const rid = r.recipient_identifier?.trim() ?? ''
        if (!rid) continue
        const inv = lookup.get(rid) ?? lookup.get(rid.toLowerCase())
        if (!inv) continue
        const agg = aggregates.get(inv.id)
        if (!agg) continue

        if (!agg.lastOutboundAt || r.sent_at > agg.lastOutboundAt) {
          agg.lastOutboundAt = r.sent_at
        }
        if (r.status === 'replied' && r.closed_at) {
          if (!agg.lastInboundAt || r.closed_at > agg.lastInboundAt) {
            agg.lastInboundAt = r.closed_at
          }
        }
        if (r.status === 'open') {
          agg.openAsks += 1
          if (new Date(r.expected_reply_by).getTime() < nowMs) {
            agg.overdueAsks += 1
          }
        }
      }
    } catch (err) {
      console.error('[cadence] outbound_asks aggregate failed', err)
      // Non-fatal — continue with whatever aggregates we have (all zeroed).
    }
  }

  // 4. Score each investor.
  const items: CadenceRow[] = investors.map((p) => {
    const agg = aggregates.get(p.id)!
    const cadence = scoreInvestorCadence({
      lastOutboundAt: agg.lastOutboundAt,
      lastInboundAt: agg.lastInboundAt,
      openAsksCount: agg.openAsks,
      overdueAsksCount: agg.overdueAsks,
      tier: resolveTier(p.tier),
    })
    return {
      pipedrive_id: p.id,
      name: p.name,
      tier: p.tier,
      score: cadence.score,
      status: cadence.status,
      reasons: cadence.reasons,
      lastOutboundAt: agg.lastOutboundAt,
      lastInboundAt: agg.lastInboundAt,
      openAsksCount: agg.openAsks,
      overdueAsksCount: agg.overdueAsks,
    }
  })

  // 5. Sort coldest-first, take top 50.
  items.sort(compareCadenceColdestFirst)
  const top = items.slice(0, TOP_N)

  if (redis) {
    try {
      await redis.set(CACHE_KEY, top, { ex: CACHE_TTL })
    } catch (err) {
      console.error('[cadence] cache write failed', err)
    }
  }

  return NextResponse.json({ items: top, cached: false })
}
