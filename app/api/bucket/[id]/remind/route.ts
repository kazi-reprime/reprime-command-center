import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MAX_HORIZON_MS = 30 * 24 * 60 * 60 * 1000

/**
 * POST /api/bucket/[id]/remind
 *
 * Body: { fire_at: ISO8601, payload?: object }
 *
 * Schedules a reminder against an existing bucket_item. The fire-reminders
 * cron picks up rows where fire_at <= now() and fired_at is null, marks them
 * fired, and Realtime delivers the change to the toast subscriber.
 *
 * payload.title is the recommended fallback display source while code2's
 * GET /api/bucket/[id] is still in flight.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid bucket_item id' }, { status: 400 })
  }

  let body: { fire_at?: string; payload?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.fire_at) {
    return NextResponse.json(
      { error: 'missing fields', detail: 'fire_at is required' },
      { status: 400 }
    )
  }

  const fireAt = new Date(body.fire_at)
  if (isNaN(fireAt.getTime())) {
    return NextResponse.json({ error: 'invalid fire_at' }, { status: 400 })
  }

  const now = Date.now()
  if (fireAt.getTime() <= now) {
    return NextResponse.json(
      { error: 'fire_at must be in the future' },
      { status: 400 }
    )
  }
  if (fireAt.getTime() - now > MAX_HORIZON_MS) {
    return NextResponse.json(
      { error: 'fire_at must be within 30 days' },
      { status: 400 }
    )
  }

  const service = createServiceClient()

  const { data: parent, error: lookupError } = await service
    .from('bucket_items')
    .select('id')
    .eq('id', id)
    .single()
  if (lookupError || !parent) {
    return NextResponse.json({ error: 'bucket_item not found' }, { status: 404 })
  }

  const { data: inserted, error: insertError } = await service
    .from('reminders')
    .insert({
      bucket_item_id: id,
      fire_at: fireAt.toISOString(),
      payload: body.payload ?? null,
    })
    .select('id, bucket_item_id, fire_at, payload')
    .single()
  if (insertError || !inserted) {
    console.error('[/api/bucket/[id]/remind] insert failed', insertError?.message)
    return NextResponse.json(
      { error: 'db_insert_failed', detail: insertError?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, reminder: inserted })
}
