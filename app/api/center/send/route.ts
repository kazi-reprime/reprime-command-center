import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { centerAuthed } from '@/lib/center/auth'
import { firstName } from '@/lib/center/engine'

export const dynamic = 'force-dynamic'

// POST { candidates: [{name, phone, email}] } -> enqueue each as an invitation
// row with status 'queued'. The per-minute cron (/api/cron/center-drain) sends
// them one at a time (ban-safe). Skips any with neither phone nor email.
// Caller is expected to pass only the NEW ones (UI filters out 'already').
export async function POST(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let candidates: Array<{ name: string; phone: string; email: string }> = []
  try { candidates = ((await request.json()) as { candidates?: typeof candidates }).candidates || [] } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const reachable = candidates.filter((c) => c.phone || c.email)
  if (!reachable.length) return NextResponse.json({ queued: 0, skipped: candidates.length })

  const supabase = createServiceClient()
  const rows = reachable.map((c) => ({
    id: randomUUID(),
    contact_first_name: firstName(c.name) || c.name || null,
    contact_name: c.name || null,
    contact_email: c.email || null,
    contact_phone: c.phone || null,
    proposed_slots: [],
    meeting_type: 'terminal',
    status: 'queued',
    expires_at: new Date(Date.now() + 14 * 864e5).toISOString(),
  }))
  const { error } = await supabase.from('invitations').insert(rows)
  if (error) return NextResponse.json({ error: 'insert_failed', message: error.message }, { status: 500 })

  return NextResponse.json({ queued: rows.length, skipped: candidates.length - reachable.length })
}
