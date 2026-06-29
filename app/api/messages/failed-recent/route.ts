import { NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'
const WINDOW_MS = 30 * 60 * 1000 // last 30 minutes

interface FailedMessage {
  id: string
  thread_id: string
  panel: string | null
  channel_type: string | null
  body: string | null
  status: string | null
  sent_at: string | null
  from_phone: string | null
}

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const since = new Date(Date.now() - WINDOW_MS).toISOString()

  try {
    const { data, error } = await svc
      .from('whatsapp_messages')
      .select('id, thread_id, panel, channel_type, body, status, sent_at, from_phone')
      .in('status', ['Failed', 'QuotaExceeded'])
      .gte('sent_at', since)
      .order('sent_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: 'db_error', message: error.message }, { status: 502 })
    }

    const items = (data ?? []) as FailedMessage[]
    return NextResponse.json({
      count: items.length,
      since,
      items,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'unexpected', message: (err as Error).message },
      { status: 500 }
    )
  }
}
