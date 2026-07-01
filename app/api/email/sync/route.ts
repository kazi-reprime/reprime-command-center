import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { createServiceClient } from '@/lib/supabase/server'
import {
  configuredAccounts,
  getMessage,
  isInsufficientScopeError,
  listRecent,
  parseFromHeader,
  type GmailAccount,
} from '@/lib/google/gmail'
import {
  scoreEmail,
  subjectMentionsKnownDeal,
  type ScoringInput,
} from '@/lib/scoring/email'
import {
  findPersonByEmail,
  listInvestorTaggedPersons,
  parseInvestorTag,
  PIPEDRIVE_FIELD_KEYS,
  type PipedrivePerson,
} from '@/lib/pipedrive/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SYNC_DAYS = 7
// Scoring assumes the sender is a single from-address. Re-scoring is cheap;
// we still cap per-cron work so a 7-day backlog catches up across runs.
const MAX_SCORE_PER_RUN = 200

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  // No CRON_SECRET configured → allow (matches /api/cron/dispatch-alerts).
  if (!expected) return true
  const header = request.headers.get('authorization') || ''
  return header === `Bearer ${expected}`
}


type InvestorEmailIndex = {
  // lowercased email → true
  emails: Set<string>
}

async function loadInvestorEmailIndex(redis: Redis | null): Promise<InvestorEmailIndex> {
  // Reuse the existing investor-tagged Pipedrive cache key from threads route.
  // Then derive an email-only set for fast lookup.
  const cacheKey = 'pipedrive:investors:tagged:v1'
  type Cached = Array<{
    id: number
    tier: 'A' | 'B' | 'C' | 'D' | null
    role: 'principal' | 'connector' | null
    phones: string[]
    emails?: string[]
  }>
  let cached: Cached | null = null
  if (redis) {
    try {
      cached = await redis.get<Cached>(cacheKey)
    } catch {
      cached = null
    }
  }
  if (!cached) {
    const fresh = await listInvestorTaggedPersons()
    cached = fresh.map((p) => ({
      id: p.id,
      tier: p.tier,
      role: p.role,
      phones: p.phones,
      emails: p.emails,
    }))
    if (redis) {
      try {
        await redis.set(cacheKey, cached, { ex: 3600 })
      } catch {
        /* non-fatal */
      }
    }
  }
  const emails = new Set<string>()
  for (const p of cached) {
    for (const e of p.emails ?? []) {
      const lower = e.trim().toLowerCase()
      if (lower) emails.add(lower)
    }
  }
  return { emails }
}

// Cache per-address Pipedrive resolution within a single run so we don't
// re-search the same sender 20 times across a thread.
async function resolveSender(
  email: string,
  cache: Map<string, { inPipedrive: boolean; isInvestor: boolean }>,
  investorEmails: Set<string>,
): Promise<{ inPipedrive: boolean; isInvestor: boolean }> {
  const lower = email.toLowerCase()
  const hit = cache.get(lower)
  if (hit) return hit

  let inPipedrive = false
  let isInvestor = false
  if (investorEmails.has(lower)) {
    inPipedrive = true
    isInvestor = true
  } else if (lower) {
    try {
      const person = await findPersonByEmail(lower)
      if (person) {
        inPipedrive = true
        const tagValue = (person as PipedrivePerson)[PIPEDRIVE_FIELD_KEYS.TAG]
        const parsed = parseInvestorTag(tagValue)
        if (parsed.isInvestor) isInvestor = true
      }
    } catch {
      /* network/auth glitch — treat as not-found */
    }
  }
  const out = { inPipedrive, isInvestor }
  cache.set(lower, out)
  return out
}

type AccountSyncResult = {
  account: string
  scanned: number
  skipped: number
  scored: number
  surfaced: number
  failures: Array<{ id: string; error: string }>
  // Set when the mailbox's token lacks the gmail.readonly scope.
  consentRequired?: boolean
}

// Sync a single mailbox. Every persisted row is tagged with this account's
// REAL email (account.email) in reasons.account_email — never a hardcoded
// address. Throws nothing for per-message errors (collected in failures);
// consentRequired short-circuits scoring for that account only.
async function syncAccount(
  account: GmailAccount,
  supabase: ReturnType<typeof createServiceClient>,
  investorEmails: Set<string>,
): Promise<AccountSyncResult> {
  const base: AccountSyncResult = {
    account: account.email,
    scanned: 0,
    skipped: 0,
    scored: 0,
    surfaced: 0,
    failures: [],
  }

  let listed: Array<{ id: string; threadId: string }> = []
  try {
    listed = await listRecent(account.key, SYNC_DAYS)
  } catch (err) {
    if (isInsufficientScopeError(err)) {
      return { ...base, consentRequired: true }
    }
    return { ...base, failures: [{ id: 'list', error: (err as Error).message }] }
  }

  base.scanned = listed.length
  if (listed.length === 0) return base

  // Pull existing scored ids so we only fetch + re-score what's new.
  const ids = listed.map((m) => m.id)
  const { data: existingRows } = await supabase
    .from('email_scores')
    .select('message_id')
    .in('message_id', ids)
  const alreadyScored = new Set((existingRows || []).map((r) => r.message_id as string))
  base.skipped = alreadyScored.size

  const toScore = listed.filter((m) => !alreadyScored.has(m.id)).slice(0, MAX_SCORE_PER_RUN)
  if (toScore.length === 0) return base

  const senderCache = new Map<string, { inPipedrive: boolean; isInvestor: boolean }>()

  // Score sequentially to keep Pipedrive QPS sane and stay inside maxDuration.
  for (const stub of toScore) {
    try {
      const msg = await getMessage(stub.id, account.key)
      const fromHeader = msg.headers['from'] || ''
      const subjectHeader = msg.headers['subject'] || ''
      const { name: fromName, address: fromAddress } = parseFromHeader(fromHeader)

      let resolution = { inPipedrive: false, isInvestor: false }
      if (fromAddress) {
        resolution = await resolveSender(fromAddress, senderCache, investorEmails)
      }

      const input: ScoringInput = {
        from: fromAddress,
        subject: subjectHeader,
        headers: msg.headers,
        hasICS: msg.hasICS,
        gmailImportant: msg.important,
        fromInPipedrive: resolution.inPipedrive,
        fromIsTaggedInvestor: resolution.isInvestor,
        subjectMentionsKnownDeal: subjectMentionsKnownDeal(subjectHeader),
      }
      const result = scoreEmail(input)
      // Persist received_at, from_name, account_email, important, unread,
      // ics, gmail thread id alongside the reasons array. Schema for v1
      // packs these into the reasons jsonb so we don't need a follow-on
      // migration. The triage route reads them back out the same way.
      const reasonsPayload = {
        list: result.reasons,
        from_name: fromName,
        // Gmail's one-line preview — surfaced to the cockpit email rows.
        snippet: msg.snippet || '',
        received_at: msg.receivedAt,
        account_email: account.email,
        gmail_thread_id: msg.threadId,
        gmail_important: msg.important,
        unread: msg.unread,
        has_ics: msg.hasICS,
        signals: {
          fromInPipedrive: resolution.inPipedrive,
          fromIsTaggedInvestor: resolution.isInvestor,
          subjectMentionsKnownDeal: input.subjectMentionsKnownDeal ?? false,
        },
      }

      const { error: upsertError } = await supabase.from('email_scores').upsert(
        {
          message_id: msg.id,
          thread_id: msg.threadId,
          from_address: fromAddress || 'unknown@unknown',
          subject: subjectHeader,
          score: result.score,
          reasons: reasonsPayload,
          scored_at: new Date().toISOString(),
        },
        { onConflict: 'message_id' },
      )
      if (upsertError) {
        base.failures.push({ id: stub.id, error: upsertError.message })
        continue
      }
      base.scored++
      if (result.score >= 5) base.surfaced++
    } catch (err) {
      if (isInsufficientScopeError(err)) {
        base.consentRequired = true
        return base
      }
      base.failures.push({ id: stub.id, error: (err as Error).message })
    }
  }

  return base
}

async function runSync(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const redis = getRedis()
  const supabase = createServiceClient()

  // Loop over every configured mailbox. With a single token present this is
  // exactly one account (g@floridastatetrust.com), matching today's behavior.
  const accounts = configuredAccounts()
  if (accounts.length === 0) {
    return NextResponse.json(
      {
        error: 'no_accounts_configured',
        message:
          'No Gmail refresh token env vars are set. Configure GOOGLE_REFRESH_TOKEN (and optionally GOOGLE_REFRESH_TOKEN_2).',
      },
      { status: 503 },
    )
  }

  const investorIndex = await loadInvestorEmailIndex(redis)

  const perAccount: AccountSyncResult[] = []
  for (const account of accounts) {
    perAccount.push(await syncAccount(account, supabase, investorIndex.emails))
  }

  const totals = perAccount.reduce(
    (acc, r) => {
      acc.scanned += r.scanned
      acc.skipped += r.skipped
      acc.scored += r.scored
      acc.surfaced += r.surfaced
      return acc
    },
    { scanned: 0, skipped: 0, scored: 0, surfaced: 0 },
  )

  return NextResponse.json({
    ...totals,
    accounts: perAccount.map((r) => ({
      account: r.account,
      scanned: r.scanned,
      skipped: r.skipped,
      scored: r.scored,
      surfaced: r.surfaced,
      consent_required: r.consentRequired ?? false,
      failures: r.failures.slice(0, 10),
    })),
  })
}

// Vercel cron fires GET. Manual smoke from a terminal can hit POST.
// Both paths require Bearer ${CRON_SECRET} (when set).
export const GET = runSync
export const POST = runSync
