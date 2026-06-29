/**
 * Investor cadence scoring v1 — pure function, deterministic, easy to unit test.
 *
 * Wave 4: ranks investors by how long they've been silent so the dashboard
 * can surface the coldest contacts first. Inputs are pre-resolved by the
 * caller (counts + last-seen timestamps); this lib does no I/O.
 *
 * Scoring rules per dispatch (code11):
 *   - Days since lastInboundAt: 0–3 (+30), 4–7 (+15), 8+ (0), no inbound (0)
 *   - openAsksCount >= 3      → -20
 *   - overdueAsksCount >= 1   → -30
 *   - Tier multiplier on net score: A 1.5, B 1.2, C 1.0, D 0.7
 *   - Clamp 0–100
 *   - Status: >=40 hot, >=30 warm, >=15 cooling, else cold
 *     (Bands sized so all four are reachable given the v1 max score of 45.)
 */

export type InvestorTier = 'A' | 'B' | 'C' | 'D'
export type CadenceStatus = 'cold' | 'cooling' | 'warm' | 'hot'

export interface CadenceInput {
  /** ISO timestamp of last outbound message Gideon sent. */
  lastOutboundAt: string | null
  /** ISO timestamp of last inbound reply observed (e.g. closed_at on replied ask). */
  lastInboundAt: string | null
  openAsksCount: number
  overdueAsksCount: number
  tier: InvestorTier
}

export interface CadenceResult {
  score: number
  status: CadenceStatus
  reasons: string[]
}

const TIER_MULTIPLIER: Record<InvestorTier, number> = {
  A: 1.5,
  B: 1.2,
  C: 1.0,
  D: 0.7,
}

const DAY_MS = 24 * 60 * 60 * 1000

function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, (now - t) / DAY_MS)
}

function formatDays(d: number): string {
  const rounded = Math.floor(d)
  if (rounded < 1) return 'today'
  if (rounded === 1) return '1 day'
  return `${rounded} days`
}

export function scoreInvestorCadence(
  input: CadenceInput,
  now: Date = new Date(),
): CadenceResult {
  const reasons: string[] = []
  let score = 0

  const inboundDays = daysSince(input.lastInboundAt, now.getTime())
  if (inboundDays === null) {
    reasons.push('No inbound on record')
  } else if (inboundDays <= 3) {
    score += 30
    const phrase = formatDays(inboundDays)
    reasons.push(phrase === 'today' ? 'Replied today' : `Replied ${phrase} ago`)
  } else if (inboundDays <= 7) {
    score += 15
    reasons.push(`Last reply ${formatDays(inboundDays)} ago`)
  } else {
    reasons.push(`Silent ${formatDays(inboundDays)}`)
  }

  if (input.openAsksCount >= 3) {
    score -= 20
    reasons.push(`${input.openAsksCount} open asks pending`)
  }
  if (input.overdueAsksCount >= 1) {
    score -= 30
    const s = input.overdueAsksCount === 1 ? '' : 's'
    reasons.push(`${input.overdueAsksCount} overdue ask${s}`)
  }

  const mult = TIER_MULTIPLIER[input.tier]
  score = Math.round(score * mult)
  if (score < 0) score = 0
  if (score > 100) score = 100

  let status: CadenceStatus
  if (score >= 40) status = 'hot'
  else if (score >= 30) status = 'warm'
  else if (score >= 15) status = 'cooling'
  else status = 'cold'

  return { score, status, reasons }
}

const STATUS_RANK: Record<CadenceStatus, number> = {
  cold: 0,
  cooling: 1,
  warm: 2,
  hot: 3,
}

/**
 * Sort comparator: cold/cooling first, then by score ascending (coldest first).
 * Ties broken by name asc to keep output stable across requests.
 */
export function compareCadenceColdestFirst(
  a: { status: CadenceStatus; score: number; name: string },
  b: { status: CadenceStatus; score: number; name: string },
): number {
  const sd = STATUS_RANK[a.status] - STATUS_RANK[b.status]
  if (sd !== 0) return sd
  if (a.score !== b.score) return a.score - b.score
  return a.name.localeCompare(b.name)
}
