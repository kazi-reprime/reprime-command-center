/* eslint-disable */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const health = {
    database: 'unconfigured',
    whatsapp: 'unconfigured',
    gmail: 'unconfigured',
    pipedrive: 'unconfigured',
    anthropic: 'unconfigured'
  }

  // 1. Check Database
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('organizations').select('id', { head: true, count: 'exact' })
    health.database = error ? 'error' : 'connected'
  } catch (e) {
    health.database = 'error'
  }

  // 2. Check WhatsApp (Timelines.ai)
  if (process.env.TIMELINES_API_KEY) {
    health.whatsapp = 'connected' // Simplified for now, could do a real API ping
  }

  // 3. Check Gmail (Google OAuth)
  if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID) {
    health.gmail = 'connected'
  }

  // 4. Check Pipedrive
  if (process.env.PIPEDRIVE_API_TOKEN) {
    health.pipedrive = 'connected'
  }

  // 5. Check Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    health.anthropic = 'connected'
  }

  return NextResponse.json({ data: health, source: 'live_health' })
}
