/**
 * Meta WhatsApp Cloud API Webhook Route
 *
 * GET  — Webhook verification (hub.verify_token challenge)
 * POST — Inbound messages + delivery statuses from Meta
 *
 * Uses the same thread/message upsert pipeline as the Timelines webhook
 * so both providers feed the same unified inbox.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { Redis } from '@upstash/redis'
import { createServiceClient } from '@/lib/supabase/server'
import {
  verifyWebhook,
  validateSignature,
  normalizeInboundMessages,
  extractStatuses,
  type MetaWebhookPayload,
} from '@/lib/whatsapp/meta-webhook'
import { normalizePhoneNumber } from '@/lib/whatsapp/contact-resolver'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

/**
 * Resolve which panel (305 or 718) this Meta phone number belongs to.
 * Meta's phone_number_id maps to a specific WhatsApp Business number.
 */
function resolveMetaPanel(phoneNumberId: string, displayPhone: string): '305' | '718' {
  const digits = displayPhone.replace(/\D/g, '')
  if (digits.endsWith('7185505500') || digits.includes('718')) return '718'
  // Default to 305
  return '305'
}

// ── GET: Webhook Verification ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const result = verifyWebhook({ mode, token, challenge })

  if (result.valid) {
    console.log('[meta-webhook] verification successful')
    return new NextResponse(result.challenge, { status: 200 })
  }

  console.warn('[meta-webhook] verification failed', { mode, hasToken: !!token })
  return NextResponse.json({ error: 'verification_failed' }, { status: 403 })
}

// ── POST: Inbound Messages + Statuses ───────────────────────────────────────

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Validate signature
  const signature = request.headers.get('x-hub-signature-256')
  if (!validateSignature(rawBody, signature)) {
    console.warn('[meta-webhook] invalid signature')
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let payload: MetaWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // Must be a WhatsApp Business Account notification
  if (payload.object !== 'whatsapp_business_account') {
    return NextResponse.json({ ok: true, skipped: 'not_whatsapp' })
  }

  const redis = getRedis()
  const service = createServiceClient()

  // ── Process inbound messages ──────────────────────────────────────────

  const messages = normalizeInboundMessages(payload)

  for (const msg of messages) {
    // Dedup check
    const dedupKey = `meta-webhook:${msg.messageId}`
    if (redis) {
      try {
        const existing = await redis.get(dedupKey)
        if (existing) {
          console.log('[meta-webhook] deduped', msg.messageId)
          continue
        }
      } catch { /* continue without dedup */ }
    }

    const phone = normalizePhoneNumber(msg.from)
    const panel = resolveMetaPanel(msg.phoneNumberId, msg.displayPhone)
    const sentAt = new Date(parseInt(msg.timestamp) * 1000).toISOString()

    console.log('[meta-webhook] inbound', {
      from: phone,
      panel,
      type: msg.type,
      hasBody: !!msg.body,
      hasMedia: !!msg.mediaId,
    })

    // Upsert thread
    const threadRow = {
      panel,
      channel_type: 'whatsapp' as const,
      phone,
      contact_name: msg.fromName || null,
      is_group: false,
      last_message_at: sentAt,
      last_message_preview: (msg.body || `📎 ${msg.type}`).slice(0, 200),
    }

    const { data: thread, error: upsertErr } = await service
      .from('whatsapp_threads')
      .upsert(threadRow, { onConflict: 'panel,phone,channel_type' })
      .select('id, unread_count')
      .single()

    if (upsertErr || !thread) {
      console.error('[meta-webhook] thread upsert failed', upsertErr?.message)
      continue
    }

    // Increment unread count
    const currentUnread = (thread as { unread_count?: number }).unread_count || 0
    await service
      .from('whatsapp_threads')
      .update({ unread_count: currentUnread + 1 })
      .eq('id', thread.id)

    // Insert message
    const messageRow = {
      thread_id: thread.id,
      panel,
      channel_type: 'whatsapp' as const,
      direction: 'in' as const,
      body: msg.body,
      media_url: null as string | null, // Will be populated after media download
      media_type: msg.mediaType,
      media_filename: msg.mediaFilename,
      timelines_uid: `meta:${msg.messageId}`, // Prefix to avoid collision with Timelines UIDs
      from_phone: phone,
      from_name: msg.fromName || null,
      sent_at: sentAt,
      status: 'received',
      is_group_message: false,
    }

    const { error: msgErr } = await service
      .from('whatsapp_messages')
      .upsert(messageRow, { onConflict: 'timelines_uid' })

    if (msgErr) {
      console.error('[meta-webhook] message insert failed', msgErr.message)
    } else {
      console.log('[meta-webhook] message saved', { threadId: thread.id, messageId: msg.messageId })
    }

    // Mark dedup key
    if (redis) {
      try {
        await redis.set(dedupKey, '1', { ex: 86400 })
      } catch { /* non-fatal */ }
    }
  }

  // ── Process delivery statuses ─────────────────────────────────────────

  const statuses = extractStatuses(payload)

  for (const status of statuses) {
    console.log('[meta-webhook] status', {
      messageId: status.messageId,
      status: status.status,
      recipient: status.recipientId,
    })

    // Update message status in DB
    const { error: statusErr } = await service
      .from('whatsapp_messages')
      .update({ status: status.status })
      .eq('timelines_uid', `meta:${status.messageId}`)

    if (statusErr) {
      // Try without meta: prefix (outbound messages may use raw IDs)
      await service
        .from('whatsapp_messages')
        .update({ status: status.status })
        .eq('timelines_uid', status.messageId)
    }

    // Log failed messages for retry/alerting
    if (status.status === 'failed') {
      console.error('[meta-webhook] delivery failed', {
        messageId: status.messageId,
        recipient: status.recipientId,
        error: status.errorMessage,
        code: status.errorCode,
      })
    }
  }

  return NextResponse.json({ ok: true, messages: messages.length, statuses: statuses.length })
}
