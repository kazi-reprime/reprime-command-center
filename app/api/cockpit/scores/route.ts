import { NextResponse, type NextRequest } from 'next/server'
import { fetchDealScores } from '@/lib/data/portalGateway'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const result = await fetchDealScores({
    page: Number(sp.get('page') || 1),
    limit: Number(sp.get('limit') || 20),
    tier: sp.get('tier') || undefined,
    minScore: sp.get('minScore') ? Number(sp.get('minScore')) : undefined,
    maxScore: sp.get('maxScore') ? Number(sp.get('maxScore')) : undefined,
  })
  return NextResponse.json(result)
}
