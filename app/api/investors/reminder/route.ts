import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/investors/reminder
 *
 * Body: { pipedrive_contact_id: number, contact_name?: string, remind_at: ISO, note?: string }
 *
 * Persists an investor_reminders row. The morning briefing job picks pending
 * reminders due that day and surfaces them with the contact + note.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== 'g@reprime.com') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: {
    pipedrive_contact_id?: number
    contact_name?: string
    remind_at?: string
    note?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.pipedrive_contact_id || !body.remind_at) {
    return NextResponse.json(
      { error: 'missing fields', detail: 'pipedrive_contact_id and remind_at are required' },
      { status: 400 }
    )
  }

  const remindAt = new Date(body.remind_at)
  if (isNaN(remindAt.getTime())) {
    return NextResponse.json({ error: 'invalid remind_at' }, { status: 400 })
  }
  if (remindAt.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: 'remind_at must be in the future' }, { status: 400 })
  }

  const service = createServiceClient()
  const row = {
    pipedrive_contact_id: body.pipedrive_contact_id,
    contact_name: body.contact_name?.slice(0, 200) ?? null,
    remind_at: remindAt.toISOString(),
    note: body.note?.slice(0, 1000) ?? null,
    status: 'pending' as const,
    created_by: user.email,
  }
  const { data: inserted, error } = await service
    .from('investor_reminders')
    .insert(row)
    .select('id, remind_at')
    .single()
  if (error) {
    console.error('[/api/investors/reminder] insert failed', error.message)
    return NextResponse.json({ error: 'db_insert_failed', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, reminder: inserted })
}
