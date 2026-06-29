import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { processInvite } from '@/lib/center/engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Per-minute cron: take the OLDEST queued invitation, send it (WhatsApp + email,
// day-spread slots, dedup guards), flip status to 'sent'. One per run keeps us
// ban-safe under WhatsApp's limits. Failures flip to 'send_failed' (visible in
// the Command Center) rather than blocking the queue.
export async function GET() {
  const supabase = createServiceClient()
  const { data: rows } = await supabase
    .from('invitations')
    .select('id, contact_name, contact_first_name, contact_email, contact_phone')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)

  const inv = rows && rows[0]
  if (!inv) return NextResponse.json({ drained: 0, note: 'queue empty' })

  // Claim it first (flip to 'sending') so overlapping cron runs don't double-send.
  const { data: claimed } = await supabase
    .from('invitations')
    .update({ status: 'sending' })
    .eq('id', inv.id)
    .eq('status', 'queued')
    .select('id')
  if (!claimed || !claimed.length) return NextResponse.json({ drained: 0, note: 'already claimed' })

  let result = ''
  let ok = true
  try {
    result = await processInvite(inv)
    if (/FAIL/.test(result) && !/sent/.test(result)) ok = false
  } catch (e) {
    result = 'ERROR ' + (e as Error).message.slice(0, 120)
    ok = false
  }
  await supabase.from('invitations').update({ status: ok ? 'sent' : 'send_failed' }).eq('id', inv.id)

  return NextResponse.json({ drained: 1, contact: inv.contact_name, result })
}
