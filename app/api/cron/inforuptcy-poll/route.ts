// ─── /api/cron/inforuptcy-poll ─────────────────────────────────────────────
// Daily cron (7am CT) that drives lib/inforuptcy/client.ts: search the 6-tenant
// watchlist, diff against existing inforuptcy_filings rows, insert deltas.
// case_no is the PK so re-runs are duplicate-safe.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { searchTenants, type InforuptcyCase } from '@/lib/inforuptcy/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // Vercel Pro ceiling; daily run ≪ 300s in practice.

// 6-tenant watchlist (locked 2026-05-04). Order is arbitrary — Inforuptcy
// search is per-tenant, no rate-limit issues at 6 calls/day.
const WATCHLIST = [
  'Family Dollar Stores',
  'Dollar Tree',
  'Planet Fitness',
  'Tractor Supply',
  'Joann',
  'Big Lots',
]

interface InsertResult {
  newCount: number
  byTenant: Record<string, { found: number; new: number }>
  reauthed: boolean
  errors: string[]
}

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return true // Permissive in local dev when secret unset.
  const header = request.headers.get('authorization') || ''
  return header === `Bearer ${expected}`
}

async function persistDeltas(cases: InforuptcyCase[]): Promise<{ newCount: number; errors: string[] }> {
  if (cases.length === 0) return { newCount: 0, errors: [] }
  const svc = createServiceClient()
  const errors: string[] = []

  // Fetch only the case_no's we just scraped so we can compute deltas without
  // pulling the full table.
  const caseNos = cases.map((c) => c.case_no)
  const { data: existingRows, error: existingErr } = await svc
    .from('inforuptcy_filings')
    .select('case_no')
    .in('case_no', caseNos)
  if (existingErr) {
    errors.push(`existing_lookup_failed: ${existingErr.message}`)
    return { newCount: 0, errors }
  }
  const existing = new Set((existingRows ?? []).map((r: { case_no: string }) => r.case_no))
  const fresh = cases.filter((c) => !existing.has(c.case_no))
  if (fresh.length === 0) return { newCount: 0, errors }

  const rows = fresh.map((c) => ({
    case_no: c.case_no,
    tenant: c.tenant,
    party_title: c.party_title,
    court: c.court,
    filed_at: c.filed_at,
    raw: c.raw,
  }))

  const { error: insertErr } = await svc
    .from('inforuptcy_filings')
    .upsert(rows, { onConflict: 'case_no', ignoreDuplicates: true })
  if (insertErr) {
    errors.push(`insert_failed: ${insertErr.message}`)
    return { newCount: 0, errors }
  }
  return { newCount: fresh.length, errors }
}

async function runPoll(): Promise<InsertResult> {
  const result: InsertResult = {
    newCount: 0,
    byTenant: {},
    reauthed: false,
    errors: [],
  }

  let scraped: { all: InforuptcyCase[]; byTenant: Record<string, number>; reauthed: boolean }
  try {
    scraped = await searchTenants(WATCHLIST)
  } catch (err) {
    result.errors.push(`scrape_failed: ${(err as Error).message}`)
    return result
  }
  result.reauthed = scraped.reauthed
  for (const tenant of WATCHLIST) {
    result.byTenant[tenant] = { found: scraped.byTenant[tenant] ?? 0, new: 0 }
  }

  const persisted = await persistDeltas(scraped.all)
  result.newCount = persisted.newCount
  result.errors.push(...persisted.errors)

  // Per-tenant new-counts: re-query the rows we just upserted to know which
  // tenant got the deltas. Cheap because PK lookup.
  if (persisted.newCount > 0) {
    const since = new Date(Date.now() - 5 * 60_000).toISOString()
    const svc = createServiceClient()
    const { data: freshRows } = await svc
      .from('inforuptcy_filings')
      .select('tenant')
      .gte('first_seen_at', since)
    for (const r of (freshRows ?? []) as Array<{ tenant: string }>) {
      const slot = result.byTenant[r.tenant]
      if (slot) slot.new += 1
    }
  }

  return result
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const result = await runPoll()
  const status = result.errors.length > 0 ? 502 : 200
  return NextResponse.json(result, { status })
}

// GET supported for manual smoke-testing from the browser/cli with the same
// Bearer guard. Vercel Cron uses GET by default, so this is the primary entry.
export async function GET(request: Request) {
  return POST(request)
}
