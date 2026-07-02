import { NextResponse, type NextRequest } from 'next/server'
import { fetchPortalAutomations } from '@/lib/data/portalGateway'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const result = await fetchPortalAutomations({
    page: Number(sp.get('page') || 1),
    limit: Number(sp.get('limit') || 20),
    status: sp.get('status') || undefined,
  })
  return NextResponse.json(result)
}
