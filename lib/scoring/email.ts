/**
 * Email scoring v1 — pure function, deterministic, easy to unit test.
 *
 * Build plan §4.C: surface emails Gideon actually needs to see at the top
 * of /center's Inbox column. Hide the 80% junk by default. Threshold to
 * surface is 5; everything below scores but stays out of the top-20.
 *
 * Inputs are pre-resolved by the caller — this lib does no I/O.
 */

export type ScoringInput = {
  /** Sender email address (lowercased recommended). */
  from: string
  /** Subject line as received. */
  subject: string
  /** Lowercase header map (header name → first value). */
  headers?: Record<string, string>
  hasICS?: boolean
  gmailImportant?: boolean
  fromInPipedrive?: boolean
  fromIsTaggedInvestor?: boolean
  subjectMentionsKnownDeal?: boolean
}

export type ScoringResult = {
  score: number
  reasons: string[]
}

/**
 * Active deal-name dictionary v1, sourced from CLAUDE.md "Active deals."
 * Hardcoded for v1; v2 reads from a Pipedrive deal-name index.
 */
export const ACTIVE_DEAL_TOKENS: ReadonlyArray<string> = [
  'Watermills',
  'Bay Valley',
  'IGA Portfolio',
  'Skylark',
  'Palatka',
  'Lake Wales',
  'Magna Electronics',
  'Freeport Plaza',
  'Rochelle Commons',
  '500 West Monroe',
  'Badger Plaza',
  'Packing House',
  "Quillin",
  'Knox Mall',
  'Gyro Capital',
  'Florida retail',
]

const MONEY_RE = /\$\s?\d|(?:\b\d+(?:[.,]\d+)?\s?[KkMm]\b)/
const PROPERTY_KEYWORD_RE =
  /\b(LOI|NDA|retrade|escrow|COE|environmental|Phase\s?I|Phase\s?II)\b/i
const AUTO_REPLY_SUBJ_RE =
  /(out\s*of\s*office|auto[-\s]?reply|autoreply|vacation\s+response|automatic\s+reply)/i
const BULK_HINT_SUBJ_RE = /(newsletter|digest|weekly\s+(update|roundup)|sponsored)/i

/** Whether a subject string mentions an active deal token. */
export function subjectMentionsKnownDeal(subject: string): boolean {
  const lower = subject.toLowerCase()
  return ACTIVE_DEAL_TOKENS.some((d) => lower.includes(d.toLowerCase()))
}

export const SURFACE_THRESHOLD = 5

/** Score one email. Pure: no async, no I/O. */
export function scoreEmail(input: ScoringInput): ScoringResult {
  const reasons: string[] = []
  let score = 0
  const subject = input.subject || ''
  const headers = input.headers || {}

  if (input.fromInPipedrive) {
    score += 5
    reasons.push('+5 sender in Pipedrive')
  }
  if (input.fromIsTaggedInvestor) {
    score += 10
    reasons.push('+10 sender is investor')
  }
  if (MONEY_RE.test(subject)) {
    score += 3
    reasons.push('+3 subject mentions $-amount')
  }
  if (PROPERTY_KEYWORD_RE.test(subject)) {
    score += 4
    reasons.push('+4 deal keyword in subject')
  }
  if (input.subjectMentionsKnownDeal) {
    score += 6
    reasons.push('+6 known deal name')
  }
  if (input.hasICS) {
    score += 2
    reasons.push('+2 calendar invite')
  }
  if (input.gmailImportant) {
    score += 1
    reasons.push('+1 marked important by Gmail')
  }
  if (headers['list-unsubscribe']) {
    score -= 5
    reasons.push('-5 List-Unsubscribe header')
  }
  if (AUTO_REPLY_SUBJ_RE.test(subject) || headers['auto-submitted']) {
    score -= 3
    reasons.push('-3 auto-reply / OOO')
  }
  if (BULK_HINT_SUBJ_RE.test(subject)) {
    score -= 2
    reasons.push('-2 bulk-marketing hint')
  }

  return { score, reasons }
}
