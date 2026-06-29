import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { listInvestorTaggedPersons, type InvestorTaggedPerson } from '@/lib/pipedrive/client'
import { normalizePhone } from '@/lib/timelines/normalize-phone'
import type { DashboardThread, Panel, InvestorTier, InvestorRole } from '@/lib/timelines/types'

export const dynamic = 'force-dynamic'
// Pipedrive paging + Supabase joins can stack to ~10s on cold start.
export const maxDuration = 30

const PIPEDRIVE_INVESTORS_CACHE_KEY = 'pipedrive:investors:tagged:v1'
const PIPEDRIVE_INVESTORS_TTL_SECONDS = 3600 // 1h

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

async function getInvestorTaggedPersonsCached(): Promise<InvestorTaggedPerson[]> {
  const redis = getRedis()
  if (redis) {
    try {
      const cached = await redis.get<InvestorTaggedPerson[]>(PIPEDRIVE_INVESTORS_CACHE_KEY)
      if (cached && Array.isArray(cached)) return cached
    } catch (err) {
      console.warn('[investor-chat-threads] redis read failed', (err as Error).message)
    }
  }
  const fresh = await listInvestorTaggedPersons()
  if (redis) {
    try {
      await redis.set(PIPEDRIVE_INVESTORS_CACHE_KEY, fresh, { ex: PIPEDRIVE_INVESTORS_TTL_SECONDS })
    } catch (err) {
      console.warn('[investor-chat-threads] redis write failed', (err as Error).message)
    }
  }
  return fresh
}

/**
 * GET /api/whatsapp/investor-chat-threads
 *
 * Returns DashboardThread[] for every contact considered an investor —
 * the union of:
 *   - Pipedrive Persons whose TAG starts with `investor` (Pipedrive is the
 *     source of truth going forward; tier/role parsed from TAG)
 *   - Threads tagged via the Supabase `tags` table with `is_investor=true`
 *     (backward compat with the original tagging UI)
 *
 * Pipedrive-tagged investors with no matching whatsapp_threads row are
 * returned as `is_stub: true` so the Investors panel can still show them.
 */
export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== 'g@reprime.com') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  // ── Path 1: Existing Supabase thread_tags-based investor flag ─────────────
  const { data: tagJoins } = await service
    .from('thread_tags')
    .select('thread_id, tags!inner(is_investor)')
    .eq('tags.is_investor', true)

  const tagBasedThreadIds = Array.from(
    new Set(((tagJoins as { thread_id: string }[] | null) || []).map((r) => r.thread_id))
  )

  // ── Path 2: Pipedrive TAG-based investor flag (new — source of truth) ─────
  let pipedriveInvestors: InvestorTaggedPerson[] = []
  try {
    pipedriveInvestors = await getInvestorTaggedPersonsCached()
  } catch (err) {
    console.error('[investor-chat-threads] Pipedrive list failed — falling back to thread_tags only', {
      message: (err as Error).message,
    })
  }
  const pipedriveContactIds = new Set(pipedriveInvestors.map((p) => p.id))
  const pipedriveByContactId = new Map(pipedriveInvestors.map((p) => [p.id, p]))
  // Also index by normalized phone — for matching threads that don't yet have pipedrive_contact_id set
  const pipedriveByPhone = new Map<string, InvestorTaggedPerson>()
  for (const p of pipedriveInvestors) {
    for (const ph of p.phones) {
      const norm = normalizePhone(ph)
      if (norm) pipedriveByPhone.set(norm, p)
    }
  }

  // ── Fetch threads matching either path ────────────────────────────────────
  const threadFilters: string[] = []
  if (tagBasedThreadIds.length > 0) {
    threadFilters.push(`id.in.(${tagBasedThreadIds.join(',')})`)
  }
  if (pipedriveContactIds.size > 0) {
    threadFilters.push(`pipedrive_contact_id.in.(${Array.from(pipedriveContactIds).join(',')})`)
  }

  // Build Supabase query — OR across the two filters
  type ThreadRow = {
    id: string
    panel: Panel
    channel_type: 'whatsapp'
    phone: string
    contact_name: string | null
    is_group: boolean
    jid: string | null
    last_message_at: string | null
    last_message_preview: string | null
    unread_count: number | null
    pipedrive_contact_id: number | null
    is_priority: boolean | null
  }
  let rows: ThreadRow[] = []
  if (threadFilters.length > 0) {
    const query = service
      .from('whatsapp_threads')
      .select(
        'id, panel, channel_type, phone, contact_name, is_group, jid, last_message_at, last_message_preview, unread_count, pipedrive_contact_id, is_priority'
      )
      .or(threadFilters.join(','))
      .or('is_blocked.is.null,is_blocked.eq.false')
      .order('last_message_at', { ascending: false, nullsFirst: false })
    const { data, error } = await query
    if (error) {
      console.error('[investor-chat-threads] thread fetch failed', { message: error.message })
      return NextResponse.json({ error: 'db_select_failed', message: error.message }, { status: 500 })
    }
    rows = (data as ThreadRow[] | null) ?? []
  }

  // Also try matching by phone for Pipedrive-investor threads where pipedrive_contact_id wasn't set
  if (pipedriveByPhone.size > 0) {
    const phones = Array.from(pipedriveByPhone.keys())
    const { data: phoneMatched, error: phoneErr } = await service
      .from('whatsapp_threads')
      .select(
        'id, panel, channel_type, phone, contact_name, is_group, jid, last_message_at, last_message_preview, unread_count, pipedrive_contact_id, is_priority'
      )
      .in('phone', phones)
      .or('is_blocked.is.null,is_blocked.eq.false')
    if (!phoneErr && phoneMatched) {
      const haveIds = new Set(rows.map((r) => r.id))
      for (const r of phoneMatched as ThreadRow[]) {
        if (!haveIds.has(r.id)) rows.push(r)
      }
    }
  }

  // ── Build response ────────────────────────────────────────────────────────
  const threads: DashboardThread[] = []
  const seenPipedriveIds = new Set<number>()

  for (const t of rows) {
    let tier: InvestorTier | null = null
    let role: InvestorRole | null = null
    let pipedriveId = t.pipedrive_contact_id

    // Resolve tier/role: prefer the Pipedrive Person already linked
    let person: InvestorTaggedPerson | undefined
    if (pipedriveId && pipedriveByContactId.has(pipedriveId)) {
      person = pipedriveByContactId.get(pipedriveId)
    } else if (pipedriveByPhone.has(t.phone)) {
      person = pipedriveByPhone.get(t.phone)
      if (!pipedriveId && person) pipedriveId = person.id
    }
    if (person) {
      tier = person.tier
      role = person.role
      seenPipedriveIds.add(person.id)
    }

    threads.push({
      id: t.id,
      panel: t.panel,
      channel_type: 'whatsapp',
      phone: t.phone,
      contact_name: t.contact_name ?? person?.name ?? null,
      is_group: t.is_group,
      jid: t.jid,
      last_message_at: t.last_message_at,
      last_message_preview: t.last_message_preview,
      unread_count: t.unread_count ?? 0,
      pipedrive_contact_id: pipedriveId,
      is_investor: true,
      investor_tier: tier,
      investor_role: role,
      is_priority: t.is_priority ?? false,
    })
  }

  // Add stub records for Pipedrive investors with no thread match
  for (const p of pipedriveInvestors) {
    if (seenPipedriveIds.has(p.id)) continue
    const phone = p.phones[0] ?? ''
    threads.push({
      id: `pipedrive:${p.id}`,
      panel: '305', // synthetic — no thread to belong to; default to 305
      channel_type: 'whatsapp',
      phone: normalizePhone(phone) || phone,
      contact_name: p.name,
      is_group: false,
      jid: null,
      last_message_at: null,
      last_message_preview: null,
      unread_count: 0,
      pipedrive_contact_id: p.id,
      is_investor: true,
      investor_tier: p.tier,
      investor_role: p.role,
      is_stub: true,
      is_priority: false,
    })
  }

  // Sort: real threads (with last_message_at) first, then stubs alphabetically by name
  threads.sort((a, b) => {
    if (a.is_stub && !b.is_stub) return 1
    if (!a.is_stub && b.is_stub) return -1
    if (a.is_stub && b.is_stub) return (a.contact_name ?? '').localeCompare(b.contact_name ?? '')
    const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
    const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
    return bt - at
  })

  return NextResponse.json({
    threads,
    diagnostics: {
      pipedrive_investors: pipedriveInvestors.length,
      tag_based_threads: tagBasedThreadIds.length,
      thread_rows: rows.length,
      stubs: threads.filter((t) => t.is_stub).length,
    },
  })
}
