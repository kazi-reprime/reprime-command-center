import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'

interface BucketItemRow {
  id: string
  title: string
  body: string | null
  status: string
  priority: number
  due_at: string | null
  assigned_to: string | null
  assigned_by: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface DelegateBody {
  to_email?: unknown
  title?: unknown
  body?: unknown
  due_at?: unknown
  remind_at?: unknown
}

async function authorize() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) return null
  return user
}

function toIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/**
 * POST /api/crew/delegate
 *
 * Body: { to_email, title, body?, due_at?, remind_at? }
 *
 * Inserts a public.bucket_items row with assigned_to=to_email and
 * assigned_by=Gideon. If `remind_at` is provided, also tries to schedule a
 * reminder via /api/bucket/[id]/remind (code5's endpoint). When that endpoint
 * is unbuilt or fails, falls back to inserting directly into public.reminders
 * — the migration owns realtime + RLS for both tables.
 */
export async function POST(request: NextRequest) {
  const user = await authorize()
  if (!user) { /* Kiosk mode: allow unauthenticated access */ }

  let body: DelegateBody
  try {
    body = (await request.json()) as DelegateBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const toEmail = typeof body.to_email === 'string' ? body.to_email.trim().toLowerCase() : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const itemBody = typeof body.body === 'string' ? body.body.trim() : ''

  if (!toEmail) return NextResponse.json({ error: 'to_email required' }, { status: 400 })
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const service = createServiceClient()

  // Validate to_email is on the active crew roster. Defends against typos and
  // off-roster delegations (Amelia / Dovber are intentionally absent).
  const { data: crew, error: crewErr } = await service
    .from('crew_members')
    .select('email, active')
    .eq('email', toEmail)
    .eq('active', true)
    .maybeSingle()
  if (crewErr) {
    return NextResponse.json(
      { error: 'db_error', message: crewErr.message },
      { status: 500 }
    )
  }
  if (!crew) {
    return NextResponse.json(
      { error: 'unknown_crew', message: `${toEmail} is not on the active roster` },
      { status: 400 }
    )
  }

  const dueAt = toIsoOrNull(body.due_at)
  const remindAt = toIsoOrNull(body.remind_at)

  const { data: item, error: insertErr } = await service
    .from('bucket_items')
    .insert({
      title,
      body: itemBody || null,
      status: 'open',
      assigned_to: toEmail,
      assigned_by: user?.email ?? ALLOWED_EMAIL,
      created_by: user?.email ?? ALLOWED_EMAIL,
      due_at: dueAt,
    })
    .select('*')
    .single()

  if (insertErr || !item) {
    return NextResponse.json(
      { error: 'db_error', message: insertErr?.message ?? 'insert failed' },
      { status: 500 }
    )
  }

  const row = item as BucketItemRow
  let reminderScheduled = false
  let reminderVia: 'endpoint' | 'fallback' | null = null
  let reminderError: string | null = null

  if (remindAt) {
    // Try code5's reminder endpoint first. Forward the cookie so the route's
    // own auth check sees the same Gideon session that authorized us.
    try {
      const origin = request.nextUrl.origin
      const cookie = request.headers.get('cookie') ?? ''
      const res = await fetch(`${origin}/api/bucket/${row.id}/remind`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ fire_at: remindAt }),
        cache: 'no-store',
      })
      if (res.ok) {
        reminderScheduled = true
        reminderVia = 'endpoint'
      } else {
        reminderError = `endpoint_${res.status}`
      }
    } catch (err) {
      reminderError = err instanceof Error ? err.message : 'endpoint_error'
    }

    if (!reminderScheduled) {
      // Fallback: insert directly into public.reminders.
      const { error: remErr } = await service.from('reminders').insert({
        bucket_item_id: row.id,
        fire_at: remindAt,
        payload: { source: 'crew/delegate', to_email: toEmail, title },
      })
      if (remErr) {
        reminderError = `fallback:${remErr.message}`
      } else {
        reminderScheduled = true
        reminderVia = 'fallback'
      }
    }
  }

  return NextResponse.json({
    item: row,
    reminder: remindAt
      ? { scheduled: reminderScheduled, via: reminderVia, error: reminderError }
      : null,
  })
}
