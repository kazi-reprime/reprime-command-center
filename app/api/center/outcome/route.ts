import { NextResponse } from 'next/server'
import { centerAuthed } from '@/lib/center/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Write an outcome from the queue back to the roster memory. booked / no.
export async function POST(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let b: { row?: number; outcome?: string }
  try { b = await request.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }
  if (!b.row) return NextResponse.json({ error: 'row_required' }, { status: 400 })

  const stage = b.outcome === 'booked' ? 'booked' : b.outcome === 'no' ? 'declined' : null
  if (!stage) return NextResponse.json({ error: 'bad_outcome' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase.from('roster')
    .update({ board_stage: stage, awaiting_us: false, outcome: b.outcome === 'booked' ? 'Booked via queue' : 'Not interested', verified_at: new Date().toISOString() })
    .eq('source_row', b.row)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
