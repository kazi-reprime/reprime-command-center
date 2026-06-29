import { NextResponse } from 'next/server'
import { centerAuthed } from '@/lib/center/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Email-audit endpoint for the Spanish secretary. Returns every roster row
// flagged by the SQL audit (HIGH = wrong-person email, REVIEW = nickname /
// company mailbox). POST applies her fix in place — updates roster.email and
// clears the flag, and propagates the new email onto any open invitation rows.
//
// HIGH rows are blocked from auto-sends + bookings until cleared (see
// lib/center/engine.ts + app/api/bookings/confirm/route.ts).

export async function GET(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('roster')
    .select('source_row, name, email, phone, board_stage, email_audit_flag, email_audit_note')
    .not('email_audit_flag', 'is', null)
    .order('email_audit_flag', { ascending: true }) // 'high' before 'review'
    .order('source_row', { ascending: true })
  if (error) return NextResponse.json({ error: error.message, rows: [] }, { status: 500 })
  return NextResponse.json({ rows: data || [] })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: { source_row?: number; new_email?: string | null; action?: 'fix' | 'clear' | 'skip' }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }
  const supabase = createServiceClient()
  const row = Number(body.source_row)
  if (!row) return NextResponse.json({ error: 'source_row required' }, { status: 400 })

  if (body.action === 'clear' || body.action === 'skip') {
    // Mark "verified — leave as is" (clear / skip both clear the flag).
    const { error } = await supabase.from('roster').update({ email_audit_flag: null, email_audit_note: null }).eq('source_row', row)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('invitations').update({ email_audit_flag: null }).eq('contact_email', (await supabase.from('roster').select('email').eq('source_row', row).maybeSingle()).data?.email || '')
    return NextResponse.json({ ok: true, cleared: true })
  }

  // Action = fix: update the email + clear the flag + propagate to open invitations
  const newEmail = (body.new_email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(newEmail)) return NextResponse.json({ error: 'invalid email' }, { status: 400 })

  const before = await supabase.from('roster').select('email').eq('source_row', row).maybeSingle()
  const oldEmail = (before.data?.email || '').trim().toLowerCase()

  const { error: upRoster } = await supabase
    .from('roster')
    .update({ email: newEmail, email_audit_flag: null, email_audit_note: null })
    .eq('source_row', row)
  if (upRoster) return NextResponse.json({ error: upRoster.message }, { status: 500 })

  if (oldEmail) {
    await supabase
      .from('invitations')
      .update({ contact_email: newEmail, email_audit_flag: null })
      .eq('contact_email', oldEmail)
      .in('status', ['sent', 'queued', 'sending', 'confirmed'])
  }

  return NextResponse.json({ ok: true, source_row: row, email: newEmail })
}
