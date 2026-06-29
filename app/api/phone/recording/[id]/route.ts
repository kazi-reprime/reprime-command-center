import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Proxies Quo call recording URLs so the browser never touches the Quo API key.
// GET /api/phone/recording/[id]  (id = phone_calls.id UUID)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth — dashboard user only
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== 'g@reprime.com') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Look up recording URL
  const service = createServiceClient()
  const { data: call, error } = await service
    .from('phone_calls')
    .select('recording_url')
    .eq('id', id)
    .single()

  if (error || !call?.recording_url) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const apiKey = process.env.QUO_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'QUO_API_KEY not configured' }, { status: 500 })
  }

  // Proxy the recording from Quo
  const upstream = await fetch(call.recording_url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream ${upstream.status}` },
      { status: upstream.status }
    )
  }

  const contentType = upstream.headers.get('content-type') ?? 'audio/mpeg'
  const body = await upstream.arrayBuffer()

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
