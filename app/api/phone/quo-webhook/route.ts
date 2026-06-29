import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/timelines/normalize-phone'

export const dynamic = 'force-dynamic'

// ── HMAC verification ─────────────────────────────────────────────────────────
// Quo (formerly OpenPhone) sends:
//   openphone-signature: hmac;<version>;<timestamp>;<base64-digest>
// The digest is HMAC-SHA256 over `<timestamp>.<rawBody>` using the webhook's
// signing key AFTER base64-decoding it, compared as base64.
// A legacy `sha256=<hex>` form is still accepted as a fallback.

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

function verifySignature(rawBody: string, header: string, signingKey: string): boolean {
  try {
    const parts = header.split(';')
    if (parts.length === 4 && parts[0] === 'hmac') {
      const timestamp = parts[2]
      const provided = parts[3]
      const key = Buffer.from(signingKey, 'base64')
      const digest = createHmac('sha256', key).update(`${timestamp}.${rawBody}`).digest('base64')
      return safeEqual(digest, provided)
    }
    // Legacy fallback: sha256=<hex>, key used as UTF-8 over the raw body.
    const sig = header.startsWith('sha256=') ? header.slice(7) : header
    const digest = createHmac('sha256', Buffer.from(signingKey, 'utf8')).update(rawBody).digest('hex')
    return safeEqual(digest, sig)
  } catch {
    return false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// 305 (Quo target) and 563 (current Quo line that forwards w/ 305 caller ID
// during the GV→Quo port). Treat both as the same logical line: panel='305'.
const OUR_305_DIGITS = '3057784861'
const OUR_563_DIGITS = '5637946221'

function isOursOnly(phone: string | undefined | null): boolean {
  if (!phone) return false
  const d = phone.replace(/\D/g, '')
  return d.endsWith(OUR_305_DIGITS) || d.endsWith(OUR_563_DIGITS)
}

function contactPhone(from: string, to: string): string {
  return isOursOnly(from) ? to : from
}

// OpenPhone message/call payloads send `to` as an ARRAY (e.g. ["+13057784861"])
// and `from` as a string. normalizePhone() throws on a non-string, so coerce
// any phone field to its first string value before use.
function firstPhone(v: unknown): string {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : ''
  return typeof v === 'string' ? v : ''
}

/**
 * Read all webhook signing secrets — supports both legacy single-key and the
 * new multi-key mode (each Quo webhook has its own HMAC key).
 *
 * Order:
 *   - QUO_WEBHOOK_SECRETS (comma-separated) — preferred
 *   - QUO_WEBHOOK_SECRET (legacy single value)
 */
function getSigningSecrets(): string[] {
  const multi = process.env.QUO_WEBHOOK_SECRETS
  if (multi) {
    return multi
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  const single = process.env.QUO_WEBHOOK_SECRET
  return single ? [single] : []
}

function verifyAgainstAny(rawBody: string, header: string, secrets: string[]): boolean {
  for (const s of secrets) {
    if (verifySignature(rawBody, header, s)) return true
  }
  return false
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const secrets = getSigningSecrets()
  if (secrets.length === 0) {
    console.error('[quo-webhook] No QUO_WEBHOOK_SECRETS or QUO_WEBHOOK_SECRET configured')
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const sig = request.headers.get('openphone-signature') ?? ''

  if (sig) {
    const valid = verifyAgainstAny(rawBody, sig, secrets)
    if (!valid) {
      console.warn('[quo-webhook] signature mismatch (tried', secrets.length, 'secret(s))')
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const type = payload.type as string
  const obj = payload.object as Record<string, unknown> | undefined
  if (!obj) return NextResponse.json({ ok: true })

  const service = createServiceClient()

  // ── call.completed ─────────────────────────────────────────────────────────
  if (type === 'call.completed') {
    const fromRaw = firstPhone(obj.from)
    const toRaw = firstPhone(obj.to)
    const from = normalizePhone(fromRaw) || fromRaw
    const to = normalizePhone(toRaw) || toRaw
    const contact = normalizePhone(contactPhone(fromRaw, toRaw))

    const row = {
      external_id: obj.id as string,
      panel: '305',
      direction: obj.direction === 'incoming' ? 'inbound' : 'outbound',
      from_phone: from,
      to_phone: to,
      contact_phone: contact,
      started_at: obj.startedAt as string | null,
      ended_at: obj.endedAt as string | null,
      duration_seconds: typeof obj.duration === 'number' ? obj.duration : null,
      status: (obj.status as string) ?? 'completed',
      channel_type: 'call',
      recording_url: (obj as Record<string, Record<string, string>>).recording?.url ?? null,
    }

    const { error } = await service.from('phone_calls').upsert(row, { onConflict: 'external_id' })
    if (error) console.error('[quo-webhook] call upsert error', error.message)
    console.log('[quo-webhook] call.completed', { from, to, duration: obj.duration })
  }

  // ── recording.completed / call.recording.completed ────────────────────────
  // Quo v2 webhook uses "call.recording.completed"; v1 used "recording.completed".
  if (type === 'recording.completed' || type === 'call.recording.completed') {
    const callId = obj.callId as string
    const url = obj.url as string
    const { error } = await service
      .from('phone_calls')
      .update({ recording_url: url })
      .eq('external_id', callId)
    if (error) console.error('[quo-webhook] recording update error', error.message)
    console.log('[quo-webhook] recording.completed for call', callId)
  }

  // ── message.received / message.sent / message.delivered ─────────────────
  // Quo's outbound event is named "message.delivered" in their v2 webhook
  // schema; the v1 alias "message.sent" is preserved for backward compat.
  if (type === 'message.received' || type === 'message.sent' || type === 'message.delivered') {
    const fromRaw = firstPhone(obj.from)
    const toRaw = firstPhone(obj.to)
    const from = normalizePhone(fromRaw) || fromRaw
    const to = normalizePhone(toRaw) || toRaw
    const contact = normalizePhone(contactPhone(fromRaw, toRaw))
    const direction = (obj.direction as string) === 'outgoing' ? 'out' : 'in'
    const body = (obj.body as string) ?? null
    const msgId = obj.id as string
    const createdAt = obj.createdAt as string | null

    // Ensure thread exists
    const threadRow = {
      panel: '305',
      channel_type: 'sms',
      phone: contact ?? from,
      last_message_at: createdAt,
      last_message_preview: body ? body.slice(0, 120) : null,
      unread_count: direction === 'in' ? 1 : 0,
    }
    const { data: thread, error: threadErr } = await service
      .from('whatsapp_threads')
      .upsert(threadRow, { onConflict: 'panel,phone,channel_type' })
      .select('id')
      .single()

    if (threadErr || !thread) {
      console.error('[quo-webhook] thread upsert error', threadErr?.message)
      return NextResponse.json({ ok: true })
    }

    // Insert message
    const msgRow = {
      thread_id: thread.id,
      panel: '305',
      channel_type: 'sms',
      direction,
      body,
      timelines_uid: `quo:${msgId}`,
      sent_at: createdAt,
      status: type === 'message.sent' || type === 'message.delivered' ? 'Sent' : null,
      from_phone: direction === 'in' ? from : to,
    }
    const { error: msgErr } = await service
      .from('whatsapp_messages')
      .upsert(msgRow, { onConflict: 'timelines_uid' })
    if (msgErr) console.error('[quo-webhook] message upsert error', msgErr.message)
    console.log('[quo-webhook]', type, { from, to, body: body?.slice(0, 40) })
  }

  return NextResponse.json({ ok: true })
}
