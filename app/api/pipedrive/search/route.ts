import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { searchPersons } from '@/lib/pipedrive/client'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }
  const limit = Math.min(20, Math.max(1, Number.parseInt(searchParams.get('limit') ?? '10', 10) || 10))

  try {
    const results = await searchPersons(q, limit)
    return NextResponse.json({ results })
  } catch (err) {
    return NextResponse.json(
      { error: 'pipedrive_error', message: (err as Error).message },
      { status: 502 }
    )
  }
}
