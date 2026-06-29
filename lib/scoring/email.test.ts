import { describe, expect, it } from 'vitest'
import {
  scoreEmail,
  subjectMentionsKnownDeal,
  ACTIVE_DEAL_TOKENS,
  SURFACE_THRESHOLD,
} from './email'
import type { ScoringInput } from './email'

function input(over: Partial<ScoringInput> = {}): ScoringInput {
  return {
    from: 'someone@example.com',
    subject: '',
    headers: {},
    ...over,
  }
}

describe('scoreEmail — baseline', () => {
  it('zero signals returns score 0 and empty reasons', () => {
    const r = scoreEmail(input())
    expect(r.score).toBe(0)
    expect(r.reasons).toEqual([])
  })

  it('exports SURFACE_THRESHOLD = 5', () => {
    expect(SURFACE_THRESHOLD).toBe(5)
  })
})

describe('scoreEmail — sender signals', () => {
  it('fromIsTaggedInvestor adds +10', () => {
    const r = scoreEmail(input({ fromIsTaggedInvestor: true }))
    expect(r.score).toBe(10)
    expect(r.reasons).toContain('+10 sender is investor')
  })

  it('fromInPipedrive adds +5', () => {
    const r = scoreEmail(input({ fromInPipedrive: true }))
    expect(r.score).toBe(5)
    expect(r.reasons).toContain('+5 sender in Pipedrive')
  })

  it('investor + Pipedrive stack to +15', () => {
    const r = scoreEmail(
      input({ fromIsTaggedInvestor: true, fromInPipedrive: true }),
    )
    expect(r.score).toBe(15)
  })
})

describe('scoreEmail — subject money detection', () => {
  it('"$1.5M" in subject adds +3', () => {
    const r = scoreEmail(input({ subject: 'Watermills offer $1.5M update' }))
    expect(r.reasons).toContain('+3 subject mentions $-amount')
  })

  it('"5K" in subject adds +3', () => {
    const r = scoreEmail(input({ subject: 'wire 5K to escrow' }))
    expect(r.reasons.some((x) => x.startsWith('+3 subject mentions'))).toBe(true)
  })

  it('"$2,500" in subject adds +3', () => {
    const r = scoreEmail(input({ subject: 'invoice $2,500 due' }))
    expect(r.reasons.some((x) => x.startsWith('+3 subject mentions'))).toBe(true)
  })

  it('plain integers without K/M/$ do not add money signal', () => {
    const r = scoreEmail(input({ subject: '1500 random words' }))
    expect(r.reasons.some((x) => x.startsWith('+3 subject mentions'))).toBe(false)
  })
})

describe('scoreEmail — subject deal-keyword detection', () => {
  it('"LOI" adds +4', () => {
    const r = scoreEmail(input({ subject: 'LOI for Saginaw' }))
    expect(r.reasons).toContain('+4 deal keyword in subject')
  })

  it('"NDA" adds +4', () => {
    const r = scoreEmail(input({ subject: 'please sign NDA' }))
    expect(r.reasons).toContain('+4 deal keyword in subject')
  })

  it('"retrade" adds +4 (case-insensitive)', () => {
    const r = scoreEmail(input({ subject: 'Bay Valley Retrade memo' }))
    expect(r.reasons).toContain('+4 deal keyword in subject')
  })

  it('"escrow" adds +4', () => {
    const r = scoreEmail(input({ subject: 'wire to escrow attorney' }))
    expect(r.reasons).toContain('+4 deal keyword in subject')
  })

  it('"Phase I" adds +4', () => {
    const r = scoreEmail(input({ subject: 'Phase I environmental report' }))
    expect(r.reasons).toContain('+4 deal keyword in subject')
  })

  it('"environmental" adds +4', () => {
    const r = scoreEmail(input({ subject: 'environmental concerns' }))
    expect(r.reasons).toContain('+4 deal keyword in subject')
  })

  it('unrelated subject does not trigger deal keyword', () => {
    const r = scoreEmail(input({ subject: 'lunch tomorrow' }))
    expect(r.reasons.some((x) => x.includes('deal keyword'))).toBe(false)
  })
})

describe('scoreEmail — known-deal flag', () => {
  it('subjectMentionsKnownDeal=true adds +6', () => {
    const r = scoreEmail(input({ subjectMentionsKnownDeal: true }))
    expect(r.score).toBe(6)
    expect(r.reasons).toContain('+6 known deal name')
  })
})

describe('scoreEmail — calendar / Gmail signals', () => {
  it('hasICS adds +2', () => {
    const r = scoreEmail(input({ hasICS: true }))
    expect(r.score).toBe(2)
    expect(r.reasons).toContain('+2 calendar invite')
  })

  it('gmailImportant adds +1', () => {
    const r = scoreEmail(input({ gmailImportant: true }))
    expect(r.score).toBe(1)
    expect(r.reasons).toContain('+1 marked important by Gmail')
  })
})

describe('scoreEmail — negative signals', () => {
  it('list-unsubscribe header subtracts 5', () => {
    const r = scoreEmail(
      input({ headers: { 'list-unsubscribe': '<mailto:u@x.com>' } }),
    )
    expect(r.score).toBe(-5)
    expect(r.reasons).toContain('-5 List-Unsubscribe header')
  })

  it('"out of office" subject subtracts 3', () => {
    const r = scoreEmail(input({ subject: 'Out of Office reply' }))
    expect(r.reasons).toContain('-3 auto-reply / OOO')
  })

  it('"auto-reply" subject subtracts 3', () => {
    const r = scoreEmail(input({ subject: 'Auto-Reply: Re: meeting' }))
    expect(r.reasons).toContain('-3 auto-reply / OOO')
  })

  it('"vacation response" subject subtracts 3', () => {
    const r = scoreEmail(input({ subject: 'Vacation Response' }))
    expect(r.reasons).toContain('-3 auto-reply / OOO')
  })

  it('auto-submitted header subtracts 3', () => {
    const r = scoreEmail(
      input({ subject: 'normal subject', headers: { 'auto-submitted': 'auto-replied' } }),
    )
    expect(r.reasons).toContain('-3 auto-reply / OOO')
  })

  it('"newsletter" subject subtracts 2', () => {
    const r = scoreEmail(input({ subject: 'Monthly Newsletter' }))
    expect(r.reasons).toContain('-2 bulk-marketing hint')
  })

  it('"weekly digest" subject subtracts 2', () => {
    const r = scoreEmail(input({ subject: 'weekly digest' }))
    expect(r.reasons).toContain('-2 bulk-marketing hint')
  })

  it('"sponsored" subject subtracts 2', () => {
    const r = scoreEmail(input({ subject: 'Sponsored offer' }))
    expect(r.reasons).toContain('-2 bulk-marketing hint')
  })
})

describe('scoreEmail — composite cases vs SURFACE_THRESHOLD', () => {
  it('investor + LOI + known deal surfaces (>= 5)', () => {
    const r = scoreEmail(
      input({
        fromIsTaggedInvestor: true,
        subject: 'LOI Watermills',
        subjectMentionsKnownDeal: true,
      }),
    )
    // 10 + 4 + 6 = 20
    expect(r.score).toBe(20)
    expect(r.score).toBeGreaterThanOrEqual(SURFACE_THRESHOLD)
  })

  it('plain Pipedrive sender alone hits threshold exactly', () => {
    const r = scoreEmail(input({ fromInPipedrive: true }))
    expect(r.score).toBe(5)
    expect(r.score).toBeGreaterThanOrEqual(SURFACE_THRESHOLD)
  })

  it('newsletter from non-tagged sender stays below threshold', () => {
    const r = scoreEmail(
      input({
        subject: 'Weekly Newsletter',
        headers: { 'list-unsubscribe': '<...>' },
      }),
    )
    // -2 + -5 = -7
    expect(r.score).toBe(-7)
    expect(r.score).toBeLessThan(SURFACE_THRESHOLD)
  })

  it('OOO from investor still nets positive (10 - 3 = 7)', () => {
    const r = scoreEmail(
      input({ fromIsTaggedInvestor: true, subject: 'Out of office' }),
    )
    expect(r.score).toBe(7)
  })
})

describe('subjectMentionsKnownDeal helper', () => {
  it('detects "Watermills"', () => {
    expect(subjectMentionsKnownDeal('Watermills closing update')).toBe(true)
  })

  it('detects case-insensitively', () => {
    expect(subjectMentionsKnownDeal('bay valley retrade')).toBe(true)
  })

  it('returns false on unrelated subject', () => {
    expect(subjectMentionsKnownDeal('lunch with mom')).toBe(false)
  })

  it('exports a non-empty deal-token list', () => {
    expect(ACTIVE_DEAL_TOKENS.length).toBeGreaterThan(0)
    expect(ACTIVE_DEAL_TOKENS).toContain('Watermills')
  })

  it('detects every active token', () => {
    for (const token of ACTIVE_DEAL_TOKENS) {
      expect(subjectMentionsKnownDeal(`update on ${token} today`)).toBe(true)
    }
  })
})
