import { NextResponse, type NextRequest } from 'next/server'
import { fetchInvestorProfiles } from '@/lib/data/portalGateway'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const result = await fetchInvestorProfiles({
    page: Number(sp.get('page') || 1),
    limit: Number(sp.get('limit') || 20),
  })
  return NextResponse.json(result)
}
