import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import {
  bustBucketCache,
  isFresh,
  readBucketOpenCache,
  writeBucketOpenCache,
} from '@/lib/bucket/cache'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'

const VALID_STATUSES = ['open', 'doing', 'done', 'dropped'] as const
type BucketStatus = (typeof VALID_STATUSES)[number]

const QUERY_TIMEOUT_MS = 5000

interface CreateBody {
  title?: string
  body?: string | null
  priority?: number
  due_at?: string | null
  source_url?: string | null
  source_type?: string | null
  assigned_to?: string | null
}

function clampPriority(p: unknown): number {
  const n = typeof p === 'number' ? p : Number(p)
  if (!Number.isFinite(n)) return 3
  return Math.max(1, Math.min(5, Math.round(n)))
}

/**
 * Race a thenable against a timer. Returns null on timeout. Never throws —
 * the caller decides what to do with null (return cached value, empty array,
 * or surface a degraded payload).
 */
async function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.error(`[bucket] ${label} timed out after ${ms}ms`)
      resolve(null)
    }, ms)
  })
  try {
    return await Promise.race([Promise.resolve(p), timeoutPromise])
  } catch (err) {
    console.error(`[bucket] ${label} failed`, err)
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * GET /api/bucket?status=open,doing
 *
 * List bucket items for the column. Default returns open + doing so the
 * "in flight" rows render together; ?status=done|dropped returns the
 * archive view. Order: priority ascending, then created_at descending,
 * matching the column's grouped layout.
 *
 * Hot-path cache: ?status=open is the kiosk's most-hit query and gets a
 * 5-min Upstash cache with a 1-hour stale fallback. Other status combos
 * skip the cache and go straight to Supabase under a 5s timeout.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  const raw = request.nextUrl.searchParams.get('status')
  const requested = (raw ? raw.split(',') : ['open', 'doing'])
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is BucketStatus =>
      (VALID_STATUSES as readonly string[]).includes(s)
    )

  const statuses = requested.length > 0 ? requested : ['open', 'doing']
  const isOpenOnly = statuses.length === 1 && statuses[0] === 'open'
  const includeSnoozed =
    request.nextUrl.searchParams.get('include_snoozed') === 'true'

  const service = createServiceClient()

  // Snooze semantics: setting due_at to a future timestamp hides the row
  // until that time (per the action menu's Snooze 2/3 days handlers).
  // Filter applied on EVERY read (both DB + cached) so snoozed rows stay
  // hidden until they come due. include_snoozed=true bypasses for the
  // archive / debugging views.
  const nowIso = new Date().toISOString()
  function hideSnoozed<T extends { due_at: string | null }>(items: T[]): T[] {
    if (includeSnoozed) return items
    return items.filter((it) => !it.due_at || it.due_at <= nowIso)
  }

  if (isOpenOnly) {
    const cached = await readBucketOpenCache<{ due_at: string | null }>()
    if (isFresh(cached)) {
      return NextResponse.json({
        items: hideSnoozed(cached!.items),
        cached: true,
      })
    }

    let q = service
      .from('bucket_items')
      .select('*')
      .eq('status', 'open')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(500)
    if (!includeSnoozed) {
      q = q.or(`due_at.is.null,due_at.lte.${nowIso}`)
    }
    const result = await withTimeout(q, QUERY_TIMEOUT_MS, 'list:open')

    if (result === null) {
      if (cached) {
        return NextResponse.json({
          items: hideSnoozed(cached.items),
          cached: true,
          stale: true,
        })
      }
      return NextResponse.json({ items: [], degraded: true })
    }
    if (result.error) {
      if (cached) {
        return NextResponse.json({
          items: hideSnoozed(cached.items),
          cached: true,
          stale: true,
        })
      }
      return NextResponse.json(
        { error: 'select_failed', message: result.error.message },
        { status: 500 }
      )
    }
    const items = (result.data ?? []) as Array<{ due_at: string | null }>
    // Cache the FULL result (including snoozed) so include_snoozed=true
    // requests can reuse the same cache; filter on read.
    await writeBucketOpenCache(items)
    return NextResponse.json({ items: hideSnoozed(items) })
  }

  let q = service
    .from('bucket_items')
    .select('*')
    .in('status', statuses)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(500)
  if (!includeSnoozed) {
    q = q.or(`due_at.is.null,due_at.lte.${nowIso}`)
  }
  const result = await withTimeout(q, QUERY_TIMEOUT_MS, `list:${statuses.join(',')}`)

  if (result === null) {
    return NextResponse.json({ items: [], degraded: true })
  }
  if (result.error) {
    return NextResponse.json(
      { error: 'select_failed', message: result.error.message },
      { status: 500 }
    )
  }

  // Defense in depth: re-apply hideSnoozed in JS so the multi-status path
  // matches the open-only path. If the DB-level .or() filter ever drops
  // (PostgREST + ISO timestamp edge cases), snoozed rows still won't leak.
  return NextResponse.json({
    items: hideSnoozed(
      (result.data ?? []) as Array<{ due_at: string | null }>
    ),
  })
}

/**
 * POST /api/bucket
 *
 * Create a new bucket item. Title is the only required field — the
 * inline "+ Add to bucket" input on the column ships title-only adds.
 * Other fields are optional and default at the DB level.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  let payload: CreateBody
  try {
    payload = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const title = (payload.title ?? '').trim()
  if (!title) {
    return NextResponse.json({ error: 'title_required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('bucket_items')
    .insert({
      title,
      body: payload.body ?? null,
      priority: clampPriority(payload.priority ?? 3),
      due_at: payload.due_at ?? null,
      source_url: payload.source_url ?? null,
      source_type: payload.source_type ?? 'manual',
      assigned_to: payload.assigned_to ?? null,
      assigned_by: user.email ?? ALLOWED_EMAIL,
      created_by: user.email ?? ALLOWED_EMAIL,
      status: 'open',
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'insert_failed', message: error.message },
      { status: 500 }
    )
  }

  // Fire-and-forget; don't slow the POST if Redis is laggy.
  void bustBucketCache()

  return NextResponse.json(data, { status: 201 })
}
