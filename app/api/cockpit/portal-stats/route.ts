import { NextResponse } from 'next/server'
import { fetchPortalStats } from '@/lib/data/portalGateway'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await fetchPortalStats()
  return NextResponse.json(result)
}
