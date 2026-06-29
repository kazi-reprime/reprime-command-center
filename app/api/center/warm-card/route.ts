import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Pre-render an invite's OG card to a STATIC PNG in Supabase storage so the
// WhatsApp link-preview crawler gets an INSTANT image on its first crawl.
//
// Why this exists: the live /invite/<id>/opengraph-image is generated per
// request (edge ImageResponse + 5 Google-Font fetches = 2-4s cold). WhatsApp's
// crawler times out on that cold render and caches the SMALL thumbnail for the
// url forever. By rendering once here and uploading a static PNG (served from
// Supabase's CDN, instant globally), the page's og:image points at a file that
// is always ready → WhatsApp renders the big navy card every time.
//
// Call this AFTER minting an invite and BEFORE sending the WhatsApp/email so the
// static card exists before the link is ever shared.

const BUCKET = 'terminal-cards'

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://project-7e87w.vercel.app').replace(/\/$/, '')
}

export async function POST(request: Request) {
  let id = ''
  try {
    const body = await request.json()
    id = (body?.id || '').toString().trim()
  } catch {
    /* fall through */
  }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = createServiceClient()

  // Only warm cards for invites that actually exist.
  const { data: inv } = await supabase.from('invitations').select('id').eq('id', id).maybeSingle()
  if (!inv) return NextResponse.json({ error: 'invite not found' }, { status: 404 })

  // Render the card via the existing dynamic route (single source of card design).
  const og = await fetch(`${appUrl()}/invite/${id}/opengraph-image`, { cache: 'no-store' })
  if (!og.ok) {
    return NextResponse.json({ error: `render ${og.status}` }, { status: 502 })
  }
  const bytes = Buffer.from(await og.arrayBuffer())
  if (bytes.length < 1000) {
    return NextResponse.json({ error: 'render too small' }, { status: 502 })
  }

  const path = `${id}.png`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'image/png', upsert: true, cacheControl: '31536000' })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ ok: true, url: pub.publicUrl, bytes: bytes.length })
}

// GET helper for manual warming / verification: /api/center/warm-card?id=<uuid>
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') || ''
  return POST(new Request(request.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }))
}
