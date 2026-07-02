import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'
const LIMIT_PER_BUCKET = 50

type OutboundAsk = {
  id: string
  sender_identity: string
  recipient_identifier: string
  channel: 'email' | 'whatsapp' | 'imessage' | 'sms'
  body: string | null
  sent_at: string
  expected_reply_by: string
  status: 'open' | 'replied' | 'closed_no_reply' | 'snoozed'
  response_message_id: string | null
  closed_at: string | null
  related_thread_id: string | null
  reminded_at: string | null
}

/**
 * GET /api/secretary/asks
 *
 * Returns three buckets the SecretaryTab renders directly:
 *   awaiting        — status='open', expected_reply_by in the future
 *   overdue         — status='open', expected_reply_by has passed
 *   replied_recent  — status='replied', closed within 7d
 *
 * Each bucket is capped at LIMIT_PER_BUCKET. Pipedrive name resolution is
 * left to the client (it already has caching via /api/pipedrive/resolve).
 */
export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  const service = createServiceClient()
  const now = new Date().toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [awaitingRes, overdueRes, repliedRes] = await Promise.all([
    service
      .from('outbound_asks')
      .select('*')
      .eq('status', 'open')
      .gte('expected_reply_by', now)
      .order('expected_reply_by', { ascending: true })
      .limit(LIMIT_PER_BUCKET),
    service
      .from('outbound_asks')
      .select('*')
      .eq('status', 'open')
      .lt('expected_reply_by', now)
      .order('expected_reply_by', { ascending: true })
      .limit(LIMIT_PER_BUCKET),
    service
      .from('outbound_asks')
      .select('*')
      .eq('status', 'replied')
      .gte('closed_at', sevenDaysAgo)
      .order('closed_at', { ascending: false })
      .limit(LIMIT_PER_BUCKET),
  ])

  const firstErr = awaitingRes.error || overdueRes.error || repliedRes.error
  if (firstErr) {
    return NextResponse.json(
      { error: 'select_failed', message: firstErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    awaiting: (awaitingRes.data ?? []) as OutboundAsk[],
    overdue: (overdueRes.data ?? []) as OutboundAsk[],
    replied_recent: (repliedRes.data ?? []) as OutboundAsk[],
  })
}

/**
 * PATCH /api/secretary/asks
 *
 * Manual desk actions on a follow-up the auto-engine hasn't closed:
 *   { id, action: 'replied' }  → status='replied', closed_at=now (clears the card)
 *   { id, action: 'snooze' }   → expected_reply_by = now + (days|1), stays open
 *                                (moves an overdue card back into "awaiting")
 *
 * The WhatsApp webhook auto-closes asks on inbound reply; this is the human
 * override for email asks and for replies that arrived out-of-band.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  let payload: { id?: string; action?: 'replied' | 'snooze'; days?: number }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { id, action } = payload
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 })
  if (action !== 'replied' && action !== 'snooze') {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  }

  const service = createServiceClient()
  const nowIso = new Date().toISOString()

  const update =
    action === 'replied'
      ? { status: 'replied' as const, closed_at: nowIso }
      : {
          expected_reply_by: new Date(
            Date.now() + Math.max(1, Math.min(payload.days ?? 1, 30)) * 24 * 60 * 60 * 1000
          ).toISOString(),
          reminded_at: null,
        }

  const { data, error } = await service
    .from('outbound_asks')
    .update(update)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, id: data.id, action })
}
