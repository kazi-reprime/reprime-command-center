import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Zoom webhook receiver (Gideon 2026-06-25). Handles Zoom's CRC endpoint
// validation + recording.completed / meeting.ended events for the post-Zoom
// pipeline: recording -> your Google Drive (named by RP-serial), AI summary +
// next-steps -> investor card, attendance -> attended / no-show.
//
// Requires ZOOM_WEBHOOK_SECRET_TOKEN (the Secret Token from the Zoom app's
// Event Subscription page). Until that env is set, the validation handshake
// returns 503 and live events are captured raw into zoom_events so nothing is
// ever lost while the credentials are still being wired.

export async function POST(request: Request) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || ''
  const raw = await request.text()
  let body: { event?: string; payload?: Record<string, unknown> } = {}
  try { body = JSON.parse(raw || '{}') } catch { /* ignore */ }

  // 1) Zoom endpoint URL validation (CRC): echo HMAC-SHA256(plainToken, secret).
  if (body?.event === 'endpoint.url_validation') {
    const plainToken = String((body.payload as { plainToken?: string } | undefined)?.plainToken || '')
    if (!secret) return NextResponse.json({ error: 'ZOOM_WEBHOOK_SECRET_TOKEN not set' }, { status: 503 })
    const encryptedToken = crypto.createHmac('sha256', secret).update(plainToken).digest('hex')
    return NextResponse.json({ plainToken, encryptedToken })
  }

  // 2) Verify the signature so only Zoom can post real events.
  if (secret) {
    const ts = request.headers.get('x-zm-request-timestamp') || ''
    const sig = request.headers.get('x-zm-signature') || ''
    const expected = 'v0=' + crypto.createHmac('sha256', secret).update(`v0:${ts}:${raw}`).digest('hex')
    if (sig && sig !== expected) return NextResponse.json({ error: 'bad signature' }, { status: 401 })
  }

  // 3) Capture every event so nothing is lost before full processing is wired.
  const service = createServiceClient()
  try {
    await service.from('zoom_events').insert({ event: body?.event || 'unknown', payload: body?.payload || {} })
  } catch (e) { console.error('[zoom-webhook] store', (e as Error).message) }

  // 4) Process specific events through the intelligence pipeline
  const eventType = body?.event || 'unknown'

  if (eventType === 'meeting.ended') {
    try {
      const { processMeetingEnded } = await import('@/lib/zoom/webhook-processor')
      await processMeetingEnded(body?.payload as Record<string, unknown>)
      console.log('[zoom-webhook] meeting.ended processed')
    } catch (e) { console.error('[zoom-webhook] meeting.ended processing failed', (e as Error).message) }
  }

  if (eventType === 'recording.completed') {
    try {
      const { processRecordingCompleted } = await import('@/lib/zoom/webhook-processor')
      await processRecordingCompleted(body?.payload as Record<string, unknown>)
      console.log('[zoom-webhook] recording.completed processed')
    } catch (e) { console.error('[zoom-webhook] recording.completed processing failed', (e as Error).message) }
  }

  if (eventType === 'meeting.participant_joined' || eventType === 'meeting.participant_left') {
    try {
      const { processParticipantEvent } = await import('@/lib/zoom/webhook-processor')
      const action = eventType.includes('joined') ? 'joined' : 'left'
      await processParticipantEvent(action, body?.payload as Record<string, unknown>)
    } catch (e) { console.error('[zoom-webhook] participant event failed', (e as Error).message) }
  }

  return NextResponse.json({ ok: true, event: eventType })
}

// GET = a simple liveness probe so the URL resolves before the secret is set.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'zoom-webhook', secretConfigured: !!process.env.ZOOM_WEBHOOK_SECRET_TOKEN })
}
