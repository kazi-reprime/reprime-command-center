import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface InvitationRecord {
  id: string
  status: 'sent' | 'confirmed' | 'expired' | 'cancelled'
  meeting_type: 'terminal' | 'meeting' | null
  created_at: string
  expires_at: string | null
  confirmed_slot_iso: string | null
  view_count: number | null
  first_opened_at: string | null
  last_opened_at: string | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pipedriveId = searchParams.get('pipedrive_id')
  if (!pipedriveId) return NextResponse.json({ invitation: null })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('invitations')
    .select('id, status, meeting_type, created_at, expires_at, confirmed_slot_iso, view_count, first_opened_at, last_opened_at')
    .eq('contact_pipedrive_id', parseInt(pipedriveId, 10))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ invitation: null })
  return NextResponse.json({ invitation: data as InvitationRecord | null })
}
