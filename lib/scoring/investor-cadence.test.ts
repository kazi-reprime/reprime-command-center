import { describe, expect, it } from 'vitest'
import {
  scoreInvestorCadence,
  compareCadenceColdestFirst,
  type CadenceInput,
} from './investor-cadence'

const NOW = new Date('2026-05-05T12:00:00.000Z')

function isoDaysAgo(days: number, base: Date = NOW): string {
  return new Date(base.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function input(over: Partial<CadenceInput> = {}): CadenceInput {
  return {
    lastOutboundAt: null,
    lastInboundAt: null,
    openAsksCount: 0,
    overdueAsksCount: 0,
    tier: 'C',
    ...over,
  }
}

describe('scoreInvestorCadence — inbound recency bands', () => {
  it('inbound today (0 days) → +30 base, A tier → 45 hot', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(0), tier: 'A' }),
      NOW,
    )
    expect(r.score).toBe(45)
    expect(r.status).toBe('hot')
    expect(r.reasons.some((x) => x.startsWith('Replied'))).toBe(true)
  })

  it('inbound today renders as "Replied today" (no "ago" suffix)', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(0), tier: 'C' }),
      NOW,
    )
    expect(r.reasons).toContain('Replied today')
    expect(r.reasons.some((x) => x.includes('today ago'))).toBe(false)
  })

  it('inbound 1 day ago renders with "ago" suffix', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(1), tier: 'C' }),
      NOW,
    )
    expect(r.reasons).toContain('Replied 1 day ago')
  })

  it('inbound 3 days ago (boundary of 0–3 band) → +30', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(3), tier: 'C' }),
      NOW,
    )
    expect(r.score).toBe(30)
    expect(r.status).toBe('warm')
  })

  it('inbound 4 days ago → +15 (4–7 band)', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(4), tier: 'C' }),
      NOW,
    )
    expect(r.score).toBe(15)
    expect(r.status).toBe('cooling')
    expect(r.reasons.some((x) => x.startsWith('Last reply'))).toBe(true)
  })

  it('inbound 7 days ago (top of 4–7 band) → +15', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(7), tier: 'C' }),
      NOW,
    )
    expect(r.score).toBe(15)
  })

  it('inbound 8+ days ago → 0 (silent band)', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(8), tier: 'A' }),
      NOW,
    )
    expect(r.score).toBe(0)
    expect(r.status).toBe('cold')
    expect(r.reasons.some((x) => x.startsWith('Silent'))).toBe(true)
  })

  it('inbound 30 days ago → 0', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(30), tier: 'A' }),
      NOW,
    )
    expect(r.score).toBe(0)
  })

  it('null inbound → 0 + "No inbound on record"', () => {
    const r = scoreInvestorCadence(input({ tier: 'A' }), NOW)
    expect(r.score).toBe(0)
    expect(r.status).toBe('cold')
    expect(r.reasons).toContain('No inbound on record')
  })

  it('invalid ISO string treated as no inbound', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: 'not-a-date', tier: 'A' }),
      NOW,
    )
    expect(r.score).toBe(0)
    expect(r.reasons).toContain('No inbound on record')
  })
})

describe('scoreInvestorCadence — open / overdue ask penalties', () => {
  it('2 open asks → no penalty (below threshold)', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(0), tier: 'C', openAsksCount: 2 }),
      NOW,
    )
    expect(r.score).toBe(30)
  })

  it('3 open asks → -20 penalty', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(0), tier: 'C', openAsksCount: 3 }),
      NOW,
    )
    expect(r.score).toBe(10)
    expect(r.reasons.some((x) => x.includes('3 open asks pending'))).toBe(true)
  })

  it('1 overdue ask → -30 penalty (singular wording)', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(0), tier: 'A', overdueAsksCount: 1 }),
      NOW,
    )
    // (30 - 30) * 1.5 = 0
    expect(r.score).toBe(0)
    expect(r.reasons).toContain('1 overdue ask')
  })

  it('multiple overdue asks pluralizes', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(0), tier: 'A', overdueAsksCount: 3 }),
      NOW,
    )
    expect(r.reasons).toContain('3 overdue asks')
  })

  it('combined open + overdue + recent inbound clamps at 0', () => {
    const r = scoreInvestorCadence(
      input({
        lastInboundAt: isoDaysAgo(0),
        tier: 'A',
        openAsksCount: 3,
        overdueAsksCount: 2,
      }),
      NOW,
    )
    // (30 - 20 - 30) * 1.5 = -30 → clamp to 0
    expect(r.score).toBe(0)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.status).toBe('cold')
  })
})

describe('scoreInvestorCadence — tier multipliers', () => {
  it('tier A applies 1.5×', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(0), tier: 'A' }),
      NOW,
    )
    expect(r.score).toBe(45) // round(30 * 1.5)
  })

  it('tier B applies 1.2×', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(0), tier: 'B' }),
      NOW,
    )
    expect(r.score).toBe(36) // round(30 * 1.2)
  })

  it('tier C applies 1.0×', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(0), tier: 'C' }),
      NOW,
    )
    expect(r.score).toBe(30)
  })

  it('tier D applies 0.7×', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(0), tier: 'D' }),
      NOW,
    )
    expect(r.score).toBe(21) // round(30 * 0.7)
  })
})

describe('scoreInvestorCadence — status thresholds (all four bands reachable)', () => {
  it('score 0 → cold', () => {
    const r = scoreInvestorCadence(input({ tier: 'A' }), NOW)
    expect(r.status).toBe('cold')
  })

  it('score 21 (tier D, 0d) → cooling (in 15–29 band)', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(0), tier: 'D' }),
      NOW,
    )
    expect(r.score).toBe(21)
    expect(r.status).toBe('cooling')
  })

  it('score 15 (tier C, 4d) → cooling (at threshold 15)', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(4), tier: 'C' }),
      NOW,
    )
    expect(r.score).toBe(15)
    expect(r.status).toBe('cooling')
  })

  it('score 30 (tier C, 0d) → warm (at threshold 30)', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(0), tier: 'C' }),
      NOW,
    )
    expect(r.score).toBe(30)
    expect(r.status).toBe('warm')
  })

  it('score 36 (tier B, 0d) → warm', () => {
    const r = scoreInvestorCadence(
      input({ lastInboundAt: isoDaysAgo(0), tier: 'B' }),
      NOW,
    )
    expect(r.score).toBe(36)
    expect(r.status).toBe('warm')
  })

  it('score 45 (tier A, 0d, zero open asks) → hot — proves hot is reachable', () => {
    const r = scoreInvestorCadence(
      input({
        lastInboundAt: isoDaysAgo(0),
        tier: 'A',
        openAsksCount: 0,
        overdueAsksCount: 0,
      }),
      NOW,
    )
    expect(r.score).toBe(45)
    expect(r.status).toBe('hot')
  })
})

describe('compareCadenceColdestFirst', () => {
  it('cold ranks before cooling', () => {
    const a = { status: 'cold' as const, score: 0, name: 'Z' }
    const b = { status: 'cooling' as const, score: 30, name: 'A' }
    expect(compareCadenceColdestFirst(a, b)).toBeLessThan(0)
  })

  it('within same status, lower score first', () => {
    const a = { status: 'cooling' as const, score: 30, name: 'B' }
    const b = { status: 'cooling' as const, score: 45, name: 'A' }
    expect(compareCadenceColdestFirst(a, b)).toBeLessThan(0)
  })

  it('ties broken by name ascending', () => {
    const a = { status: 'cold' as const, score: 0, name: 'Bruce' }
    const b = { status: 'cold' as const, score: 0, name: 'Adir' }
    expect(compareCadenceColdestFirst(a, b)).toBeGreaterThan(0)
  })

  it('full sort: cold-low → cold-high → cooling-low → cooling-high', () => {
    const list = [
      { status: 'cooling' as const, score: 45, name: 'D' },
      { status: 'cold' as const, score: 21, name: 'B' },
      { status: 'cooling' as const, score: 30, name: 'C' },
      { status: 'cold' as const, score: 0, name: 'A' },
    ]
    const sorted = [...list].sort(compareCadenceColdestFirst)
    expect(sorted.map((x) => x.name)).toEqual(['A', 'B', 'C', 'D'])
  })
})
