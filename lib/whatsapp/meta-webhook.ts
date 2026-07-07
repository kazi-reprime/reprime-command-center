/**
 * Meta WhatsApp Cloud API Webhook Handler
 *
 * Handles:
 * - Webhook verification (GET with hub.verify_token)
 * - Inbound messages (text, media, voice, reactions, status)
 * - Delivery status updates (sent → delivered → read)
 * - Signature validation using app secret
 */

import crypto from 'crypto'

export interface MetaWebhookMessage {
  id: string
  from: string
  timestamp: string
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'reaction' | 'location' | 'contacts' | 'interactive' | 'button' | 'order'
  text?: { body: string }
  image?: { id: string; mime_type: string; sha256: string; caption?: string }
  audio?: { id: string; mime_type: string; voice?: boolean }
  video?: { id: string; mime_type: string; caption?: string }
  document?: { id: string; mime_type: string; filename?: string; caption?: string }
  sticker?: { id: string; mime_type: string }
  reaction?: { message_id: string; emoji: string }
  location?: { latitude: number; longitude: number; name?: string; address?: string }
  context?: { from: string; id: string }
}

export interface MetaWebhookStatus {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  errors?: Array<{ code: number; title: string; message: string }>
}

export interface MetaWebhookContact {
  profile: { name: string }
  wa_id: string
}

export interface MetaWebhookEntry {
  id: string
  changes: Array<{
    value: {
      messaging_product: string
      metadata: { display_phone_number: string; phone_number_id: string }
      contacts?: MetaWebhookContact[]
      messages?: MetaWebhookMessage[]
      statuses?: MetaWebhookStatus[]
    }
    field: string
  }>
}

export interface MetaWebhookPayload {
  object: string
  entry: MetaWebhookEntry[]
}

// ── Webhook Verification ────────────────────────────────────────────────────

export function verifyWebhook(params: {
  mode: string | null
  token: string | null
  challenge: string | null
}): { valid: boolean; challenge?: string } {
  const verifyToken = process.env.META_WA_VERIFY_TOKEN
  if (!verifyToken) return { valid: false }

  if (params.mode === 'subscribe' && params.token === verifyToken) {
    return { valid: true, challenge: params.challenge || '' }
  }
  return { valid: false }
}

// ── Signature Validation ────────────────────────────────────────────────────

export function validateSignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.META_WA_APP_SECRET
  if (!appSecret) {
    // No app secret configured — allow (dev mode)
    console.warn('[meta-webhook] META_WA_APP_SECRET not set, skipping signature validation')
    return true
  }
  if (!signature) return false

  const expectedSig = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')

  return signature === `sha256=${expectedSig}`
}

// ── Message Normalization ───────────────────────────────────────────────────

export interface NormalizedInboundMessage {
  messageId: string
  from: string
  fromName: string
  timestamp: string
  type: string
  body: string | null
  mediaId: string | null
  mediaType: string | null
  mediaFilename: string | null
  isVoiceNote: boolean
  caption: string | null
  replyTo: string | null
  phoneNumberId: string
  displayPhone: string
}

export function normalizeInboundMessages(payload: MetaWebhookPayload): NormalizedInboundMessage[] {
  const normalized: NormalizedInboundMessage[] = []

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value
      if (!value.messages) continue

      const metadata = value.metadata
      const contactMap = new Map<string, string>()
      for (const c of value.contacts || []) {
        contactMap.set(c.wa_id, c.profile.name)
      }

      for (const msg of value.messages) {
        const fromName = contactMap.get(msg.from) || ''
        let body: string | null = null
        let mediaId: string | null = null
        let mediaType: string | null = null
        let mediaFilename: string | null = null
        let isVoiceNote = false
        let caption: string | null = null

        switch (msg.type) {
          case 'text':
            body = msg.text?.body || null
            break
          case 'image':
            mediaId = msg.image?.id || null
            mediaType = 'image'
            caption = msg.image?.caption || null
            break
          case 'audio':
            mediaId = msg.audio?.id || null
            mediaType = 'audio'
            isVoiceNote = !!msg.audio?.voice
            break
          case 'video':
            mediaId = msg.video?.id || null
            mediaType = 'video'
            caption = msg.video?.caption || null
            break
          case 'document':
            mediaId = msg.document?.id || null
            mediaType = 'document'
            mediaFilename = msg.document?.filename || null
            caption = msg.document?.caption || null
            break
          case 'sticker':
            mediaId = msg.sticker?.id || null
            mediaType = 'sticker'
            break
          case 'reaction':
            body = msg.reaction?.emoji || null
            break
          case 'location':
            body = msg.location ? `📍 ${msg.location.name || ''} (${msg.location.latitude}, ${msg.location.longitude})` : null
            break
        }

        normalized.push({
          messageId: msg.id,
          from: msg.from,
          fromName,
          timestamp: msg.timestamp,
          type: msg.type,
          body: body || caption,
          mediaId,
          mediaType,
          mediaFilename,
          isVoiceNote,
          caption,
          replyTo: msg.context?.id || null,
          phoneNumberId: metadata.phone_number_id,
          displayPhone: metadata.display_phone_number,
        })
      }
    }
  }

  return normalized
}

// ── Status Update Extraction ────────────────────────────────────────────────

export interface NormalizedStatus {
  messageId: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipientId: string
  errorCode?: number
  errorMessage?: string
}

export function extractStatuses(payload: MetaWebhookPayload): NormalizedStatus[] {
  const statuses: NormalizedStatus[] = []

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      for (const status of change.value.statuses || []) {
        statuses.push({
          messageId: status.id,
          status: status.status,
          timestamp: status.timestamp,
          recipientId: status.recipient_id,
          errorCode: status.errors?.[0]?.code,
          errorMessage: status.errors?.[0]?.message,
        })
      }
    }
  }

  return statuses
}

// ── Media Download ──────────────────────────────────────────────────────────

export async function downloadMedia(mediaId: string): Promise<{ url: string; mimeType: string }> {
  const token = process.env.META_WA_ACCESS_TOKEN
  if (!token) throw new Error('META_WA_ACCESS_TOKEN not set')

  // Step 1: Get media URL
  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!metaRes.ok) throw new Error(`Meta media lookup failed: ${metaRes.status}`)

  const metaData = (await metaRes.json()) as { url: string; mime_type: string }
  return { url: metaData.url, mimeType: metaData.mime_type }
}

// ── Send Media Message ──────────────────────────────────────────────────────

export async function sendMediaMessage(params: {
  to: string
  type: 'image' | 'audio' | 'video' | 'document'
  mediaUrl?: string
  mediaId?: string
  caption?: string
  filename?: string
}): Promise<{ messageId: string }> {
  const token = process.env.META_WA_ACCESS_TOKEN!
  const phoneId = process.env.META_WA_PHONE_NUMBER_ID!
  const to = params.to.replace(/^\+/, '')

  const mediaPayload: Record<string, string> = {}
  if (params.mediaUrl) mediaPayload.link = params.mediaUrl
  if (params.mediaId) mediaPayload.id = params.mediaId
  if (params.caption) mediaPayload.caption = params.caption
  if (params.filename) mediaPayload.filename = params.filename

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: params.type,
        [params.type]: mediaPayload,
      }),
    },
  )

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Meta WhatsApp media send ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as { messages?: Array<{ id: string }> }
  return { messageId: data.messages?.[0]?.id || 'sent' }
}
