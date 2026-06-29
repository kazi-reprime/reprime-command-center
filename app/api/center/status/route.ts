import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { centerAuthed } from '@/lib/center/auth'

export const dynamic = 'force-dynamic'

// GET -> queue health: how many are still waiting to send, plus the latest
// outcomes so the page can show live progress.
export async function GET(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = createServiceClient()

  const counts: Record<string, number> = {}
  for (const st of ['queued', 'sent', 'confirmed', 'send_failed']) {
    const { count } = await supabase.from('invitations').select('id', { count: 'exact', head: true }).eq('status', st)
    counts[st] = count || 0
  }

  const { data: recent } = await supabase
    .from('invitations')
    .select('contact_name, status, created_at')
    .in('status', ['queued', 'send_failed'])
    .order('created_at', { ascending: true })
    .limit(50)

  return NextResponse.json({ counts, pending: recent || [] })
}
