import { NextResponse, type NextRequest } from 'next/server'
import { fetchListings } from '@/lib/data/portalGateway'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const result = await fetchListings({
    page: Number(sp.get('page') || 1),
    limit: Number(sp.get('limit') || 20),
    type: sp.get('type') || undefined,
    state: sp.get('state') || undefined,
    minPrice: sp.get('minPrice') ? Number(sp.get('minPrice')) : undefined,
    maxPrice: sp.get('maxPrice') ? Number(sp.get('maxPrice')) : undefined,
    search: sp.get('search') || undefined,
    sort: sp.get('sort') || undefined,
  })
  return NextResponse.json(result)
}
