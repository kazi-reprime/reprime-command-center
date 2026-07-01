import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/timelines/normalize-phone'
import { getMediaType, parseTimelinesTimestamp } from '@/lib/timelines/parse'
import type { Panel, TimelinesChat, TimelinesMessage } from '@/lib/timelines/types'
import { markAskReplied } from '@/lib/secretary/outbound-asks'
import { processVoiceNote } from '@/lib/center/voice-note'

export const dynamic = 'force-dynamic'
// Voice notes get downloaded + transcribed inline, so allow headroom over the
// default. Whisper on a short note is a few seconds; the dedup key guards retries.
export const maxDuration = 60

type WebhookAccount = {
  id?: string | number | null
  phone?: string | null
  jid?: string | null
  email?: string | null
  full_name?: string | null
  account_id?: string | number | null
  [k: string]: unknown
}

/**
 * Actual Timelines.ai webhook schema (captured from a live POST 2026-05-04):
 *
 *   { event_type, chat:{full_name,chat_url,chat_id,is_group,phone},
 *     whatsapp_account:{full_name,email,phone},
 *     message:{text,direction,origin,timestamp,message_uid,
 *              sender:{full_name,phone}, recipient:{full_name,phone},
 *              attachments:[{temporary_download_url,filename,size,mimetype}]} }
 *
 * The dashboard's existing TimelinesChat/TimelinesMessage types are wider —
 * we normalize raw → typed below so downstream handler logic is unchanged.
 */
type RawAttachment = {
  temporary_download_url?: string
  filename?: string
  size?: number
  mimetype?: string
}

type RawTimelinesChat = {
  full_name?: string
  chat_url?: string
  chat_id?: number
  is_group?: boolean
  phone?: string
}

type RawTimelinesMessage = {
  text?: string
  direction?: 'sent' | 'received'
  origin?: string
  timestamp?: string
  message_uid?: string
  sender?: { full_name?: string; phone?: string }
  recipient?: { full_name?: string; phone?: string }
  attachments?: RawAttachment[]
}

type WebhookPayload = {
  event_type?: string
  event?: string
  chat?: RawTimelinesChat
  whatsapp_account?: WebhookAccount
  message?: RawTimelinesMessage
}

/**
 * Normalize Timelines' real schema into our internal TimelinesChat/TimelinesMessage
 * types so resolvePanel + upsert logic don't need to know about the wire format.
 * Returns null if the payload lacks message or chat (event-only pings).
 */
function normalizePayload(raw: WebhookPayload): {
  chat: TimelinesChat
  message: TimelinesMessage
  account: WebhookAccount
} | null {
  if (!raw.message || !raw.chat) return null

  const account = raw.whatsapp_account || {}
  const fromMe = raw.message.direction === 'sent'
  const firstAtt = raw.message.attachments?.[0]
  const mimetype = firstAtt?.mimetype || ''
  const messageType = firstAtt
    ? mimetype.startsWith('image/') ? 'image'
      : mimetype.startsWith('video/') ? 'video'
      : mimetype.startsWith('audio/') ? 'audio'
      : 'document'
    : (raw.message.text ? 'text' : 'unknown')

  const ourPhone = account.phone || ''
  const remoteSender = raw.message.sender?.phone || ''
  const remoteRecipient = raw.message.recipient?.phone || ''

  // For inbound: sender = remote contact, recipient = us
  // For outbound: sender = us, recipient = remote contact
  const senderPhone = fromMe ? ourPhone : remoteSender
  const recipientPhone = fromMe ? remoteRecipient : ourPhone

  const message: TimelinesMessage = {
    uid: raw.message.message_uid || '',
    chat_id: raw.chat.chat_id || 0,
    timestamp: raw.message.timestamp || '',
    sender_phone: senderPhone,
    sender_name: raw.message.sender?.full_name || '',
    recipient_phone: recipientPhone,
    recipient_name: raw.message.recipient?.full_name || '',
    from_me: fromMe,
    text: raw.message.text || '',
    attachment_url: firstAtt?.temporary_download_url || null,
    attachment_filename: firstAtt?.filename || null,
    status: '',
    origin: raw.message.origin || '',
    has_attachment: !!firstAtt,
    message_type: messageType,
    reactions: { users: [], reactions: {}, total: 0 },
    data: {},
  }

  // Group chats have empty chat.phone — synthesize a stable identifier
  // so multiple groups don't collapse into a single thread row.
  const chatPhone = raw.chat.phone && raw.chat.phone.trim().length > 0
    ? raw.chat.phone
    : (raw.chat.is_group && raw.chat.chat_id ? `group:${raw.chat.chat_id}` : '')

  const chat: TimelinesChat = {
    id: raw.chat.chat_id || 0,
    name: raw.chat.full_name || '',
    phone: chatPhone,
    jid: '',
    is_group: !!raw.chat.is_group,
    closed: false,
    read: true,
    labels: [],
    whatsapp_account_id: account.phone || '',
    chat_url: raw.chat.chat_url || '',
    created_timestamp: '',
    last_message_uid: raw.message.message_uid || null,
    last_message_timestamp: raw.message.timestamp || null,
    unattended: false,
    photo: null,
    is_allowed_to_message: true,
    group_members: [],
  }

  return { chat, message, account }
}

/** Match any string containing our account digits */
function matchPanel(value: string | undefined | null): Panel | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (digits.endsWith('17185505500') || digits === '7185505500') return '718'
  if (digits.endsWith('13057784861') || digits === '3057784861') return '305'
  return null
}

/**
 * Determine panel from all available fields.
 * Timelines.ai's current payload puts account info under a top-level
 * `whatsapp_account` object rather than `chat.whatsapp_account_id`.
 * We probe every plausible location so panel resolution is robust to
 * schema drift.
 */
function resolvePanel(
  chat: TimelinesChat,
  message: TimelinesMessage,
  account: WebhookAccount | undefined
): Panel | null {
  // 0. Top-level whatsapp_account object (current Timelines schema)
  if (account) {
    const fromAccountPhone = matchPanel(account.phone)
    if (fromAccountPhone) return fromAccountPhone
    const fromAccountJid = matchPanel(account.jid)
    if (fromAccountJid) return fromAccountJid
    const fromAccountId = matchPanel(
      typeof account.id === 'number' ? String(account.id) : (account.id as string | null | undefined)
    )
    if (fromAccountId) return fromAccountId
    const fromAccountIdAlt = matchPanel(
      typeof account.account_id === 'number' ? String(account.account_id) : (account.account_id as string | null | undefined)
    )
    if (fromAccountIdAlt) return fromAccountIdAlt
  }

  // 1. Explicit account id on chat (legacy schema)
  const fromAccountId = matchPanel(chat.whatsapp_account_id)
  if (fromAccountId) return fromAccountId

  // 2. Message phones: for outbound our number = sender; for inbound = recipient
  const ourPhone = message.from_me ? message.sender_phone : message.recipient_phone
  const fromPhone = matchPanel(ourPhone)
  if (fromPhone) return fromPhone

  // 3. Try both sender and recipient regardless of direction
  const fromSender = matchPanel(message.sender_phone)
  if (fromSender) return fromSender
  const fromRecipient = matchPanel(message.recipient_phone)
  if (fromRecipient) return fromRecipient

  // 4. Chat JID (sometimes encodes the account phone)
  const fromJid = matchPanel(chat.jid)
  if (fromJid) return fromJid

  return null
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export async function POST(request: Request) {
  let body: string
  let payload: WebhookPayload
  try {
    body = await request.text()
    payload = JSON.parse(body)
  } catch {
    console.error('[webhook] invalid json body')
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // Full raw payload — needed to discover Timelines' exact nested schema.
  // Truncate to 8KB to avoid log bloat on attachment-heavy messages.
  console.log(
    '[webhook] raw',
    body.length > 8192 ? body.slice(0, 8192) + '…(truncated)' : body
  )
  console.log('[webhook] payload keys', Object.keys(payload as Record<string, unknown>))

  const normalized = normalizePayload(payload)

  console.log('[webhook] received', {
    event: payload.event ?? payload.event_type ?? null,
    hasMessage: !!payload.message,
    hasChat: !!payload.chat,
    hasAccount: !!payload.whatsapp_account,
    accountKeys: payload.whatsapp_account ? Object.keys(payload.whatsapp_account) : null,
    messageKeys: payload.message ? Object.keys(payload.message as Record<string, unknown>) : null,
    chatKeys: payload.chat ? Object.keys(payload.chat as Record<string, unknown>) : null,
    normalized: !!normalized,
    messageUid: normalized?.message.uid ?? null,
    chatPhone: normalized?.chat.phone ?? null,
    accountPhone: normalized?.account.phone ?? null,
    fromMe: normalized?.message.from_me ?? null,
    chatIsGroup: normalized?.chat.is_group ?? null,
  })

  if (!normalized) {
    console.log('[webhook] skipped — payload missing message or chat')
    return NextResponse.json({ ok: true, skipped: 'no message or chat' })
  }

  const { chat, message, account } = normalized

  // Check dedup BEFORE setting key — only set after successful write
  const redis = getRedis()
  const redisKey = message.uid ? `webhook:${message.uid}` : null
  if (redis && redisKey) {
    try {
      const existing = await redis.get(redisKey)
      // BUG 3b: log dedup key and whether it already exists
      console.log('[webhook] dedup key', redisKey, 'exists:', existing !== null)
      if (existing) {
        return NextResponse.json({ ok: true, deduped: true })
      }
    } catch (err) {
      console.error('[webhook] redis read failed', { uid: message.uid, error: (err as Error).message })
      // Continue without dedup rather than blocking write
    }
  }

  const panel = resolvePanel(chat, message, account)
  console.log('[webhook] panel inference', {
    whatsapp_account_id: chat.whatsapp_account_id,
    account_phone: account?.phone ?? null,
    account_id: account?.id ?? null,
    account_jid: account?.jid ?? null,
    sender_phone: message.sender_phone,
    recipient_phone: message.recipient_phone,
    from_me: message.from_me,
    chat_jid: chat.jid,
    resolved_panel: panel,
  })
  if (!panel) {
    console.log('[webhook] skipped — could not resolve panel', {
      whatsapp_account_id: chat.whatsapp_account_id,
      sender_phone: message.sender_phone,
      recipient_phone: message.recipient_phone,
    })
    return NextResponse.json({ ok: true, skipped: 'unknown account' })
  }

  const service = createServiceClient()
  const rawPhone = chat.phone
  const phone = normalizePhone(rawPhone) || rawPhone
  const lastAt = chat.last_message_timestamp
    ? parseTimelinesTimestamp(chat.last_message_timestamp).toISOString()
    : (message.timestamp ? parseTimelinesTimestamp(message.timestamp).toISOString() : null)

  // Only include columns confirmed to exist in the whatsapp_threads schema
  // (timelines_chat_id excluded — column not in DB; messages lookup uses phone-based search)
  const threadRow = {
    panel,
    channel_type: 'whatsapp' as const,
    phone,
    contact_name: chat.name || null,
    is_group: chat.is_group,
    jid: chat.jid || null,
    last_message_at: lastAt,
    // Numeric Timelines chat id — needed to send a true WhatsApp voice note back
    // (POST /chats/{id}/voice_message). Populates as contacts message us.
    timelines_chat_id: chat.id || null,
  }

  console.log('[webhook] upserting thread', { panel, phone, timelines_chat_id: chat.id, lastAt })

  const { data: thread, error: upsertErr } = await service
    .from('whatsapp_threads')
    .upsert(threadRow, { onConflict: 'panel,phone,channel_type' })
    .select('id')
    .single()

  if (upsertErr || !thread) {
    console.error('[webhook] thread upsert FAILED', {
      panel,
      phone,
      message: upsertErr?.message,
      code: upsertErr?.code,
      details: upsertErr?.details,
      hint: upsertErr?.hint,
    })
    return NextResponse.json(
      { error: 'thread_upsert_failed', message: upsertErr?.message },
      { status: 500 }
    )
  }

  console.log('[webhook] thread upsert OK', { threadId: thread.id, panel, phone })

  const sentAt = message.timestamp
    ? parseTimelinesTimestamp(message.timestamp).toISOString()
    : null

  // Infer media_type from filename extension first, then fall back to message_type
  // (WhatsApp voice notes use message_type='ptt' and have no filename extension)
  let mediaType = getMediaType(message.attachment_filename)
  if (!mediaType && message.has_attachment) {
    const msgType = (message.message_type || '').toLowerCase()
    if (msgType === 'ptt' || msgType === 'audio' || msgType === 'voice') {
      mediaType = 'audio'
    } else if (msgType === 'image' || msgType === 'sticker') {
      mediaType = 'image'
    } else if (msgType === 'video') {
      mediaType = 'video'
    } else if (msgType === 'document' || msgType === 'file') {
      mediaType = 'document'
    } else {
      mediaType = 'document' // generic fallback
    }
  }

  // Timelines sometimes puts voice note URL in message.data rather than attachment_url
  const mediaUrl: string | null =
    message.attachment_url ||
    (message.has_attachment
      ? ((message.data?.url as string | undefined) ||
         (message.data?.audio_url as string | undefined) ||
         (message.data?.download_url as string | undefined) ||
         null)
      : null)

  console.log('[webhook] media', {
    message_type: message.message_type,
    has_attachment: message.has_attachment,
    attachment_url: message.attachment_url,
    attachment_filename: message.attachment_filename,
    resolved_media_type: mediaType,
    resolved_media_url: mediaUrl,
  })

  // ── Voice notes: persist a durable copy + transcribe ────────────────────────
  // Inbound 1:1 audio (the investor-board case): download the note, store it so
  // the ▶ player keeps working after the Timelines link expires, and transcribe
  // it (Whisper, auto Hebrew/English) so the board shows words, not "📎 document".
  let voiceTranscript = ''
  let durableAudioUrl: string | null = null
  if (!message.from_me && !chat.is_group && mediaType === 'audio' && mediaUrl) {
    try {
      const vn = await processVoiceNote({
        srcUrl: mediaUrl,
        uid: message.uid || `${thread.id}-${sentAt}`,
        filename: message.attachment_filename,
      })
      voiceTranscript = vn.transcript
      durableAudioUrl = vn.durableUrl
      console.log('[webhook] voice note', { hasTranscript: !!voiceTranscript, durable: !!durableAudioUrl })
    } catch (e) { console.error('[webhook] voice note non-fatal', (e as Error).message) }
  }
  const effectiveMediaUrl = durableAudioUrl || mediaUrl
  const bodyText = (message.text && message.text.trim()) || voiceTranscript || null

  const messageRow = {
    thread_id: thread.id,
    panel,
    channel_type: 'whatsapp' as const,
    direction: message.from_me ? ('out' as const) : ('in' as const),
    body: bodyText,
    media_url: effectiveMediaUrl,
    media_type: mediaType,
    media_filename: message.attachment_filename,
    timelines_uid: message.uid,
    from_phone: message.sender_phone || null,
    from_name: message.sender_name || null,
    sent_at: sentAt,
    status: message.status || null,
    is_group_message: chat.is_group,
    // raw column does not exist in whatsapp_messages schema — omitted
  }

  // BUG 3c: log full message row so column-name mismatches are immediately visible
  console.log('[webhook] inserting message', JSON.stringify(messageRow))
  console.log('[webhook] upserting message', {
    threadId: thread.id,
    uid: message.uid,
    direction: messageRow.direction,
    sentAt,
    bodyPreview: (message.text || '').slice(0, 40) || null,
  })

  const { error: msgErr } = await service
    .from('whatsapp_messages')
    .upsert(messageRow, { onConflict: 'timelines_uid' })

  // BUG 3d: log insert result whether success or failure
  console.log('[webhook] insert result', { data: !msgErr, error: msgErr ?? null })
  if (msgErr) {
    console.error('[webhook] message upsert FAILED', {
      uid: message.uid,
      threadId: thread.id,
      message: msgErr.message,
      code: msgErr.code,
      details: msgErr.details,
      hint: msgErr.hint,
    })
    return NextResponse.json(
      { error: 'message_upsert_failed', message: msgErr.message },
      { status: 500 }
    )
  }

  console.log('[webhook] message upsert OK', { uid: message.uid, threadId: thread.id })

  // ── Real-time board update ───────────────────────────────────────────────
  // Reflect this message on the /outreach board the instant it lands: update the
  // matching roster row's last message + append to thread_json (so cards/queue
  // show it without waiting for the hourly reconciliation cron). Non-fatal.
  // MUST be awaited — a fire-and-forget promise is killed when the serverless
  // function returns, which is why messages were saved but the board never
  // flipped. Awaiting is cheap (one select + one update) and non-fatal on error.
  if (!chat.is_group && phone) {
    try {
      const l9 = phone.replace(/\D/g, '').slice(-9)
      if (l9) {
        const { data: rows } = await service.from('roster').select('source_row, phone, board_stage, thread_json')
        const match = (rows || []).find((r: { phone: string | null }) => !!r.phone && r.phone.replace(/\D/g, '').slice(-9) === l9) as { source_row: number; board_stage: string | null; thread_json: string | null } | undefined
        if (match) {
          const who = message.from_me ? 'us' : 'them'
          const isAudio = mediaType === 'audio'
          // A transcribed voice note shows its words; an un-transcribed one shows
          // a mic glyph that the board turns into a localized "Voice message".
          const txt = (bodyText || '').trim() || (isAudio ? '🎤' : (mediaType ? '📎 ' + mediaType : ''))
          if (txt) {
            let date = ''
            try { date = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(sentAt || Date.now())) } catch { /* keep '' */ }
            let arr: Array<{ who: string; date: string; text: string; via?: string; audio?: string }> = []
            try { arr = match.thread_json ? JSON.parse(match.thread_json) : [] } catch { arr = [] }
            const entry: { who: string; date: string; text: string; via?: string; audio?: string } = { who, date, text: txt.slice(0, 400), via: 'wa' }
            // Player gets the DURABLE stored url only — never the 15-min temp link.
            if (isAudio && durableAudioUrl) entry.audio = durableAudioUrl
            arr.push(entry)
            if (arr.length > 40) arr = arr.slice(-40)
            const nowIso = new Date().toISOString()
            const inbound = !message.from_me
            // Inbound (them) → flips the board to 'replied' + awaiting us, and
            // stamps last_reply_at so the alert cron can fire. Outbound (us) →
            // clears awaiting us, leaves the stage as-is.
            const upd: Record<string, unknown> = {
              thread_json: JSON.stringify(arr),
              last_reply_text: txt.slice(0, 500),
              last_from: who,
              awaiting_us: inbound,
              last_reply_at: new Date(sentAt || Date.now()).toISOString(),
              updated_at: nowIso,
            }
            if (inbound && match.board_stage !== 'booked' && match.board_stage !== 'declined') upd.board_stage = 'replied'
            await service.from('roster').update(upd).eq('source_row', match.source_row)
            console.log('[webhook] board updated', { source_row: match.source_row, inbound })
          }
        } else {
          console.log('[webhook] board update: no roster match', { l9 })
        }
      }
    } catch (e) { console.error('[webhook] board update non-fatal', (e as Error).message) }
  }

  // Mark dedup key only after successful write
  if (redis && redisKey) {
    try {
      await redis.set(redisKey, '1', { ex: 60 * 60 * 24 })
    } catch (err) {
      console.error('[webhook] redis write failed (non-fatal)', { uid: message.uid, error: (err as Error).message })
    }
  }

  // ── AI priority classification (inbound only, non-fatal) ─────────────────────
  // Only classify inbound text messages — skip outbound, media-only, and group msgs
  if (!message.from_me && !chat.is_group && message.text) {
    void classifyAndFlag(service, thread.id, message.text, chat.name || null).catch(
      (err) => console.error('[webhook] classify non-fatal', (err as Error).message)
    )
  }

  // ── Secretary: close any open outbound ask waiting on this contact ──────────
  // Inbound only; group messages don't close 1:1 asks. Match the most recent
  // open whatsapp ask to the same phone within 7 days. Non-fatal.
  if (!message.from_me && !chat.is_group) {
    void markAskReplied({
      channel: 'whatsapp',
      recipientIdentifier: phone,
      responseMessageId: message.uid || null,
    }).catch((err) =>
      console.error('[webhook] secretary markAskReplied non-fatal', (err as Error).message)
    )
  }

  return NextResponse.json({ ok: true, written: true })
}

// ── Priority classifier ───────────────────────────────────────────────────────

type SupabaseService = ReturnType<typeof createServiceClient>

async function classifyAndFlag(
  service: SupabaseService,
  threadId: string,
  text: string,
  contactName: string | null
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return

  const client = new Anthropic({ apiKey })

  // Cheap classification — Haiku, single token answer
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4,
    system: `You classify inbound messages for a real estate investment firm.
Reply with only the word PRIORITY or NORMAL.
Mark PRIORITY if the message contains ANY of: investment interest, deal inquiry, money/amount, commitment language ("I want to invest", "let's move forward", "ready to"), urgency ("asap", "urgent", "need to talk today"), or a referral opportunity.
Mark NORMAL for everything else.`,
    messages: [
      {
        role: 'user',
        content: contactName
          ? `From: ${contactName}\nMessage: ${text.slice(0, 400)}`
          : `Message: ${text.slice(0, 400)}`,
      },
    ],
  })

  const answer = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text.trim().toUpperCase())
    .join('')

  if (answer.startsWith('PRIORITY')) {
    // Mark the thread as priority — column must exist:
    // ALTER TABLE whatsapp_threads ADD COLUMN IF NOT EXISTS is_priority boolean DEFAULT false;
    await service
      .from('whatsapp_threads')
      .update({ is_priority: true })
      .eq('id', threadId)
    console.log('[webhook] flagged thread as priority', { threadId, contactName })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: 'POST webhooks here' })
}
