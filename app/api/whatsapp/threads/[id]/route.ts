import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type LaneOverride = 'investor' | 'staff' | 'general' | null

type PatchBody = {
  lane_override?: LaneOverride
  is_archived?: boolean
  is_blocked?: boolean
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== 'g@reprime.com') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if ('lane_override' in body) {
    const v = body.lane_override
    if (v !== null && v !== 'investor' && v !== 'staff' && v !== 'general') {
      return NextResponse.json(
        { error: 'lane_override must be investor | staff | general | null' },
        { status: 400 }
      )
    }
    updates.lane_override = v
  }

  if ('is_archived' in body) {
    updates.is_archived = Boolean(body.is_archived)
  }

  if ('is_blocked' in body) {
    updates.is_blocked = Boolean(body.is_blocked)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_fields_to_update' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('whatsapp_threads')
    .update(updates)
    .eq('id', id)
    .select('id, lane_override, is_archived, is_blocked')
    .single()

  if (error) {
    // The lane_override column doesn't exist yet — the SQL migration at
    // supabase/migrations/2026-06-23-whatsapp-threads-lane-override.sql
    // needs to be applied first via Supabase SQL editor.
    if (/column .* does not exist/i.test(error.message)) {
      return NextResponse.json(
        { error: 'migration_not_applied', message: 'Run 2026-06-23-whatsapp-threads-lane-override.sql in the Supabase SQL editor first.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'db_update_failed', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, thread: data })
}
