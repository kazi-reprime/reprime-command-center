import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/timelines/normalize-phone'

export const dynamic = 'force-dynamic'

// ── Auth ──────────────────────────────────────────────────────────────────────
// The call-log daemon authenticates with:
//   Authorization: Bearer <BB_CALL_SECRET>

function verifyBearer(request: NextRequest): boolean {
  const secret = process.env.BB_CALL_SECRET
  if (!secret) return true
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

// ── Expected payload from the call-log daemon ─────────────────────────────────
// {
//   "event":            "call.completed" | "call.missed",
//   "call_id":          "unique-id-from-callhistory-db",
//   "panel":            "718" | "305",           (optional — default 718)
//   "direction":        "inbound" | "outbound",
//   "from_phone":       "+17185551234",
//   "to_phone":         "+17185505500",
//   "started_at":       "2026-05-03T10:00:00.000Z",
//   "duration_seconds": 125,
//   "status":           "completed" | "missed"
// }

export async function POST(request: NextRequest) {
  if (!verifyBearer(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const event = body.event as string
  if (!event?.startsWith('call.')) {
    return NextResponse.json({ ok: true })
  }

  const panel = (body.panel as string) ?? '718'
  const fromRaw = body.from_phone as string | undefined
  const toRaw = body.to_phone as string | undefined
  if (!fromRaw || !toRaw) {
    console.warn('[call-event] missing from/to', body)
    return NextResponse.json({ error: 'missing phones' }, { status: 400 })
  }

  const from = normalizePhone(fromRaw) ?? fromRaw
  const to = normalizePhone(toRaw) ?? toRaw

  // The contact phone is whichever is NOT our panel number
  const our = panel === '305' ? /3057784861/ : /7185505500/
  const contact = our.test(from.replace(/\D/g, '')) ? to : from

  const row = {
    external_id: body.call_id as string,
    panel,
    direction: (body.direction as string) === 'outbound' ? 'outbound' : 'inbound',
    from_phone: from,
    to_phone: to,
    contact_phone: contact,
    started_at: body.started_at as string | null,
    duration_seconds: typeof body.duration_seconds === 'number' ? body.duration_seconds : null,
    status: (body.status as string) ?? 'completed',
    channel_type: 'call',
  }

  const db = createServiceClient()
  const { error } = await db
    .from('phone_calls')
    .upsert(row, { onConflict: 'external_id' })
  if (error) {
    console.error('[call-event] upsert error', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[call-event]', event, { panel, from, to, duration: row.duration_seconds })
  return NextResponse.json({ ok: true })
}
