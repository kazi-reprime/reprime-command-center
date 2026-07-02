import { NextResponse, type NextRequest } from 'next/server'
import { fetchBrokers } from '@/lib/data/portalGateway'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const result = await fetchBrokers({
    page: Number(sp.get('page') || 1),
    limit: Number(sp.get('limit') || 20),
    search: sp.get('search') || undefined,
    sort: sp.get('sort') || undefined,
  })
  return NextResponse.json(result)
}
