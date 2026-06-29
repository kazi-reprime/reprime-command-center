import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/timelines/normalize-phone'

export const dynamic = 'force-dynamic'

type BlockBody = {
  thread_id?: string
  pipedrive_contact_id?: number
  phone?: string
  email?: string
  reason?: string
  unblock?: boolean
}

const ALLOWED_EMAIL = 'g@reprime.com'

/**
 * Cross-channel block. One call → all threads matching the same Pipedrive
 * contact ID (or phone, or email) get is_blocked=true. Future inbound from
 * the same person resolves to a blocked entry in `blocked_contacts` and is
 * filtered before render.
 *
 * Body: thread_id (preferred — looks up Pipedrive ID + phone), OR
 *       pipedrive_contact_id, OR phone, OR email. Plus optional reason.
 *       Pass unblock:true to reverse.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: BlockBody
  try { body = (await request.json()) as BlockBody }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const service = createServiceClient()
  const unblock = body.unblock === true

  // Resolve identifiers — start from thread_id if given (pulls phone + Pipedrive id)
  let pipedriveId: number | null = body.pipedrive_contact_id ?? null
  let phone: string | null = body.phone ? (normalizePhone(body.phone) || body.phone) : null
  const email = body.email ? body.email.trim().toLowerCase() : null

  if (body.thread_id) {
    const { data: thread } = await service
      .from('whatsapp_threads')
      .select('phone, pipedrive_contact_id, contact_name')
      .eq('id', body.thread_id)
      .maybeSingle()
    if (thread) {
      phone = phone || thread.phone || null
      pipedriveId = pipedriveId || thread.pipedrive_contact_id || null
    }
  }

  if (!pipedriveId && !phone && !email) {
    return NextResponse.json({ error: 'no_identifier' }, { status: 400 })
  }

  // Build the OR filter clause for matching threads across panels
  const orClauses: string[] = []
  if (pipedriveId) orClauses.push(`pipedrive_contact_id.eq.${pipedriveId}`)
  if (phone) orClauses.push(`phone.eq.${phone}`)
  const orQuery = orClauses.join(',')

  // Update is_blocked across all matching threads
  if (orQuery) {
    const { error: updateErr, count } = await service
      .from('whatsapp_threads')
      .update({ is_blocked: !unblock }, { count: 'exact' })
      .or(orQuery)
    if (updateErr) {
      return NextResponse.json(
        { error: 'thread_update_failed', message: updateErr.message },
        { status: 500 }
      )
    }
    console.log('[block]', unblock ? 'unblocked' : 'blocked', 'threads:', count, { pipedriveId, phone, email })
  }

  // Maintain blocked_contacts ledger (or remove from ledger if unblock)
  if (unblock) {
    const filters: string[] = []
    if (pipedriveId) filters.push(`pipedrive_contact_id.eq.${pipedriveId}`)
    if (phone) filters.push(`phone.eq.${phone}`)
    if (email) filters.push(`email.eq.${email}`)
    if (filters.length > 0) {
      await service
        .from('blocked_contacts')
        .update({ unblocked_at: new Date().toISOString() })
        .or(filters.join(','))
    }
  } else {
    const ledgerRow = {
      pipedrive_contact_id: pipedriveId,
      phone,
      email,
      reason: body.reason || null,
    }
    // Upsert by whatever unique column is present — Supabase upsert needs onConflict;
    // if any of these constraints conflict, the row already exists.
    if (pipedriveId) {
      await service.from('blocked_contacts').upsert(ledgerRow, { onConflict: 'pipedrive_contact_id' })
    } else if (phone) {
      await service.from('blocked_contacts').upsert(ledgerRow, { onConflict: 'phone' })
    } else if (email) {
      await service.from('blocked_contacts').upsert(ledgerRow, { onConflict: 'email' })
    }
  }

  return NextResponse.json({
    ok: true,
    action: unblock ? 'unblocked' : 'blocked',
    pipedrive_contact_id: pipedriveId,
    phone,
    email,
  })
}
