import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { bustBucketCache } from '@/lib/bucket/cache'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'

const VALID_STATUSES = ['open', 'doing', 'done', 'dropped'] as const
type BucketStatus = (typeof VALID_STATUSES)[number]

interface PatchBody {
  status?: BucketStatus
  priority?: number
  due_at?: string | null
  title?: string
  body?: string | null
  assigned_to?: string | null
}

function clampPriority(p: unknown): number {
  const n = typeof p === 'number' ? p : Number(p)
  if (!Number.isFinite(n)) return 3
  return Math.max(1, Math.min(5, Math.round(n)))
}

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/bucket/[id]
 *
 * Single bucket item — used by code3's WindowManager when the
 * BucketItemDetail body opens, and by code5's reminder fetch when a
 * reminder fires and the toast wants to show row context.
 */
export async function GET(_request: NextRequest, ctx: RouteContext) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('bucket_items')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: 'select_failed', message: error.message },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json(data)
}

/**
 * PATCH /api/bucket/[id]
 *
 * Drives the per-row action menu on the BucketColumn:
 *   Done           → { status: 'done' }
 *   Drop           → { status: 'dropped' }
 *   Snooze 2 days  → { due_at: now+2d }
 *   Snooze 3 days  → { due_at: now+3d }
 *   Reprioritize   → { priority: 1..5 }
 *
 * "Remind in 1 hour" lives on a separate code5-owned endpoint:
 * POST /api/bucket/[id]/remind. This handler does NOT manage that.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 })
  }

  let payload: PatchBody
  try {
    payload = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (payload.status !== undefined) {
    if (!(VALID_STATUSES as readonly string[]).includes(payload.status)) {
      return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
    }
    update.status = payload.status
  }
  if (payload.priority !== undefined) {
    update.priority = clampPriority(payload.priority)
  }
  if (payload.due_at !== undefined) {
    update.due_at = payload.due_at
  }
  if (payload.title !== undefined) {
    const t = payload.title.trim()
    if (!t) {
      return NextResponse.json({ error: 'title_blank' }, { status: 400 })
    }
    update.title = t
  }
  if (payload.body !== undefined) {
    update.body = payload.body
  }
  if (payload.assigned_to !== undefined) {
    update.assigned_to = payload.assigned_to
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('bucket_items')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: 'update_failed', message: error.message },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  void bustBucketCache()

  return NextResponse.json(data)
}

/**
 * DELETE /api/bucket/[id]
 *
 * Hard delete. The column's "Drop" action uses PATCH status='dropped'
 * (soft) so the row stays auditable. DELETE is reserved for cleanup.
 */
export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service.from('bucket_items').delete().eq('id', id)
  if (error) {
    return NextResponse.json(
      { error: 'delete_failed', message: error.message },
      { status: 500 }
    )
  }
  void bustBucketCache()
  return NextResponse.json({ ok: true })
}
