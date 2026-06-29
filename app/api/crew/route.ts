import { NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'

export interface CrewMemberRow {
  email: string
  display_name: string
  role: string
  phone: string | null
  is_principal: boolean
  is_investor_side_only: boolean
  active: boolean
  created_at: string
}

async function authorize() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) return null
  return user
}

/**
 * GET /api/crew — list active crew, principal first, then alphabetical by
 * display_name. Roster lock 2026-05-05 owns the seed; this route never
 * inserts/updates crew_members.
 */
export async function GET() {
  const user = await authorize()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('crew_members')
    .select('*')
    .eq('active', true)
    .order('is_principal', { ascending: false })
    .order('display_name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ crew: (data || []) as CrewMemberRow[] })
}
