import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { getAllChats, getMessages, sendMessage, PANEL_ACCOUNT_MAP } from '@/lib/timelines/client'
import { normalizePhone } from '@/lib/timelines/normalize-phone'
import { getMediaType, parseTimelinesTimestamp } from '@/lib/timelines/parse'
import type { DashboardMessage, Panel, TimelinesMessage } from '@/lib/timelines/types'
import { recordOutboundAsk } from '@/lib/secretary/outbound-asks'
import { whatsappAdapter } from '@/lib/adapters/whatsappAdapter'

export const dynamic = 'force-dynamic'

function messageToRow(msg: TimelinesMessage, threadId: string, panel: Panel) {
  const sentAt = msg.timestamp
    ? parseTimelinesTimestamp(msg.timestamp).toISOString()
    : null
  const mediaType = getMediaType(msg.attachment_filename)
  return {
    thread_id: threadId,
    panel,
    channel_type: 'whatsapp' as const,
    direction: msg.from_me ? ('out' as const) : ('in' as const),
    body: msg.text || null,
    media_url: msg.attachment_url,
    media_type: mediaType,
    media_filename: msg.attachment_filename,
    timelines_uid: msg.uid,
    from_phone: msg.sender_phone || null,
    from_name: msg.sender_name || null,
    sent_at: sentAt,
    status: msg.status || null,
    is_group_message: false,
    // raw column does not exist in whatsapp_messages schema — omitted
  }
}

/**
 * Map a Timelines message to the DashboardMessage shape directly, without a DB
 * round-trip. Used by the phone+panel lookup path (cockpit), which has no
 * whatsapp_threads row id to key the DB cache on.
 * @param {TimelinesMessage} msg
 * @param {string} threadId  synthetic id (the phone) — purely for the response
 * @param {Panel} panel
 * @returns {DashboardMessage}
 */
function messageToDashboard(
  msg: TimelinesMessage,
  threadId: string,
  panel: Panel
): DashboardMessage {
  const sentAt = msg.timestamp
    ? parseTimelinesTimestamp(msg.timestamp).toISOString()
    : null
  return {
    id: msg.uid,
    thread_id: threadId,
    panel,
    channel_type: 'whatsapp',
    direction: msg.from_me ? 'out' : 'in',
    body: msg.text || null,
    media_url: msg.attachment_url,
    media_type: getMediaType(msg.attachment_filename),
    media_filename: msg.attachment_filename,
    timelines_uid: msg.uid,
    from_phone: msg.sender_phone || null,
    from_name: msg.sender_name || null,
    sent_at: sentAt,
    status: msg.status || null,
    is_group_message: false,
  }
}

/**
 * Fetch a thread's messages directly from Timelines by phone, mapping straight
 * to DashboardMessage[]. No DB lookup, no upsert — used when the caller has the
 * phone but not the Supabase row id (the cockpit, where thread.id = phone).
 */
async function fetchMessagesByPhone(
  phone: string,
  panel: Panel
): Promise<DashboardMessage[]> {
  const normalized = normalizePhone(phone) ?? phone
  const last9 = normalized.replace(/\D/g, '').slice(-9)

  // PRIMARY: serve from the canonical webhook-fed store (whatsapp_messages),
  // which holds ALL channels for this contact+line — WhatsApp (Timelines),
  // SMS (Quo), and iMessage (BlueBubbles). The previous Timelines-only path
  // returned empty / a wrong-number match for SMS+iMessage threads, which is
  // why switching channels showed "random" messages. We resolve EVERY thread
  // row for this phone+panel and merge their messages so a contact's full
  // cross-channel history shows together ("one human, one thread").
  const service = createServiceClient()
  try {
    const { data: threads } = await service
      .from('whatsapp_threads')
      .select('id, phone')
      .eq('panel', panel)
    const ids = (threads ?? [])
      .filter((t: { id: string; phone: string | null }) => {
        if (!t.phone) return false
        if (t.phone === phone || normalizePhone(t.phone) === normalized) return true
        return last9.length >= 7 && t.phone.replace(/\D/g, '').slice(-9) === last9
      })
      .map((t: { id: string }) => t.id)

    if (ids.length > 0) {
      const { data: rows } = await service
        .from('whatsapp_messages')
        .select('*')
        .in('thread_id', ids)
        .order('sent_at', { ascending: true, nullsFirst: true })
        .limit(300)
      if (rows && rows.length > 0) return rows as unknown as DashboardMessage[]
    }
  } catch (err) {
    console.warn('[messages/GET] store read failed (phone path)', {
      phone, panel, error: (err as Error).message?.slice(0, 160),
    })
  }

  // FALLBACK: live Timelines (WhatsApp only) for a thread not yet in the store.
  let messages: TimelinesMessage[] = []
  try {
    const allChats = await getAllChats(panel)
    const matchingChat = allChats.find(
      (c) => normalizePhone(c.phone) === normalized || c.phone === phone
    )
    if (matchingChat) {
      messages = await getMessages(matchingChat.id)
    } else {
      console.warn('[messages/GET] no matching Timelines chat for phone', { phone, panel, totalChats: allChats.length })
    }
  } catch (err) {
    console.warn('[messages/GET] Timelines failed (phone path)', { phone, panel, error: (err as Error).message?.slice(0, 200) })
  }
  return messages
    .map((m) => messageToDashboard(m, phone, panel))
    .sort((a, b) => {
      const ta = a.sent_at ? new Date(a.sent_at).getTime() : 0
      const tb = b.sent_at ? new Date(b.sent_at).getTime() : 0
      return ta - tb
    })
}

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== 'g@reprime.com') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const status = whatsappAdapter.getStatus();
  if (!status.isConfigured) {
    return NextResponse.json({ error: 'adapter_offline', message: status.error }, { status: 503 })
  }

  // Phone + panel path (cockpit): cockpit thread.id is the phone, not the
  // Supabase row id. Fetch directly from Timelines and skip the row lookup.
  // The thread_id path below is unchanged (the main dashboard uses it).
  const phoneParam = request.nextUrl.searchParams.get('phone')
  const panelParam = request.nextUrl.searchParams.get('panel')
  if (phoneParam) {
    if (panelParam !== '305' && panelParam !== '718') {
      return NextResponse.json({ error: 'panel must be 305 or 718' }, { status: 400 })
    }
    const messages = await fetchMessagesByPhone(phoneParam, panelParam)
    return NextResponse.json({ messages })
  }

  const threadId = request.nextUrl.searchParams.get('thread_id')
  if (!threadId) {
    return NextResponse.json({ error: 'thread_id or phone required' }, { status: 400 })
  }

  const service = createServiceClient()
  // BUG 3/5: Do NOT select timelines_chat_id — column not in DB.
  // Use phone-based lookup to find Timelines chat ID instead.
  const { data: thread, error: threadErr } = await service
    .from('whatsapp_threads')
    .select('id, panel, phone, is_group')
    .eq('id', threadId)
    .single()

  // Stub investor-tagged contacts (no real WA thread yet) and any other case
  // where the requested thread doesn't exist in DB → return empty array, not
  // 404. Lets the UI render an empty conversation pane cleanly instead of an
  // error toast.
  if (threadErr || !thread) {
    return NextResponse.json({ messages: [] satisfies DashboardMessage[] })
  }

  const panel: Panel = thread.panel
  const isGroup: boolean = thread.is_group
  const threadPhone: string = thread.phone

  // Find the matching Timelines chat by phone so we can fetch its messages
  let messages: TimelinesMessage[] = []
  try {
    const allChats = await getAllChats(panel)
    const matchingChat = allChats.find(
      (c) => normalizePhone(c.phone) === threadPhone || c.phone === threadPhone
    )
    if (matchingChat) {
      messages = await getMessages(matchingChat.id)
    } else {
      console.warn('[messages/GET] no matching Timelines chat for phone', { threadPhone, panel, totalChats: allChats.length })
    }
  } catch (err) {
    const msg = (err as Error).message ?? ''
    // Always fall back to DB cache — Timelines being down/quota/auth should never blank the thread
    console.warn('[messages/GET] Timelines failed — serving DB cache', { threadPhone, panel, error: msg.slice(0, 200) })
  }

  const rows = messages.map((m) => {
    const row = messageToRow(m, threadId, panel)
    return { ...row, is_group_message: isGroup }
  })

  if (rows.length > 0) {
    const { error: upsertErr } = await service
      .from('whatsapp_messages')
      .upsert(rows, { onConflict: 'timelines_uid' })
    if (upsertErr) {
      console.error('[messages/GET] upsert failed', { message: upsertErr.message, code: upsertErr.code })
      return NextResponse.json(
        { error: 'db_upsert_failed', message: upsertErr.message },
        { status: 500 }
      )
    }
  }

  const { data: stored, error: selectErr } = await service
    .from('whatsapp_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('sent_at', { ascending: true, nullsFirst: true })

  if (selectErr) {
    return NextResponse.json(
      { error: 'db_select_failed', message: selectErr.message },
      { status: 500 }
    )
  }

  const result: DashboardMessage[] = (stored || []).map(
    (m: DashboardMessage) => ({
      id: m.id,
      thread_id: m.thread_id,
      panel: m.panel,
      channel_type: m.channel_type,
      direction: m.direction,
      body: m.body,
      media_url: m.media_url,
      media_type: m.media_type,
      media_filename: m.media_filename,
      timelines_uid: m.timelines_uid,
      from_phone: m.from_phone,
      from_name: m.from_name,
      sent_at: m.sent_at,
      status: m.status,
      is_group_message: m.is_group_message,
    })
  )

  return NextResponse.json({ messages: result })
}

type SendBody = {
  panel?: string
  thread_id?: string
  phone?: string
  body?: string
  attachment_url?: string
  attachment_filename?: string
  attachment_type?: string
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== 'g@reprime.com') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const status = whatsappAdapter.getStatus();
  if (!status.isConfigured) {
    return NextResponse.json({ error: 'adapter_offline', message: status.error }, { status: 503 })
  }

  let payload: SendBody
  try {
    payload = (await request.json()) as SendBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const panelParam = payload.panel
  if (panelParam !== '718' && panelParam !== '305') {
    return NextResponse.json({ error: 'invalid_panel' }, { status: 400 })
  }
  const panel: Panel = panelParam

  // The cockpit identifies a thread by PHONE (its live data comes straight from
  // Timelines and has no Supabase row id), while the legacy dashboard passes the
  // Supabase row uuid. Accept EITHER: thread_id may be a uuid or a phone, and an
  // explicit `phone` field is also honored. We resolve to the real row below.
  let threadId = typeof payload.thread_id === 'string' ? payload.thread_id : ''
  const phoneHint = typeof payload.phone === 'string' ? payload.phone : ''
  if (!threadId && !phoneHint) {
    return NextResponse.json({ error: 'identifier_required' }, { status: 400 })
  }

  const text = (payload.body ?? '').trim()
  const attachmentUrl = payload.attachment_url || null
  const attachmentFilename = payload.attachment_filename || null
  const attachmentType = payload.attachment_type || null

  if (!text && !attachmentUrl) {
    return NextResponse.json({ error: 'empty_message' }, { status: 400 })
  }

  const service = createServiceClient()
  // Resolve the thread row by uuid (legacy) or by phone+panel (cockpit).
  // BUG 5: Do NOT select timelines_chat_id — sendMessage() needs phone, not chat ID
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  let threadQuery = service.from('whatsapp_threads').select('id, panel, phone, is_group')
  if (threadId && UUID_RE.test(threadId)) {
    threadQuery = threadQuery.eq('id', threadId)
  } else {
    const rawPhone = phoneHint || threadId
    const normalized = normalizePhone(rawPhone) || rawPhone
    threadQuery = threadQuery
      .eq('panel', panel)
      .or(`phone.eq.${normalized},phone.eq.${rawPhone}`)
  }
  const { data: thread, error: threadErr } = await threadQuery.maybeSingle()

  if (threadErr || !thread) {
    return NextResponse.json({ error: 'thread_not_found' }, { status: 404 })
  }
  // From here on, threadId is the resolved Supabase row uuid.
  threadId = thread.id

  if (thread.panel !== panel) {
    return NextResponse.json(
      { error: 'panel_mismatch', message: 'cross-panel send forbidden' },
      { status: 403 }
    )
  }

  const recipientPhone: string | null = thread.phone
  if (!recipientPhone) {
    return NextResponse.json({ error: 'thread_has_no_phone' }, { status: 409 })
  }

  // Block outbound to group chats — Timelines.ai's /messages endpoint requires a
  // real phone, and we only have a synthetic group:{chat_id} identifier. Sending
  // to groups from the dashboard isn't supported until we wire up Timelines'
  // group-send API. Reply from the iPhone WhatsApp directly for now.
  if (thread.is_group || recipientPhone.startsWith('group:') || /^\+?\d+$/.test(recipientPhone) === false) {
    return NextResponse.json(
      {
        error: 'group_send_unsupported',
        message:
          'Sending to group chats from the dashboard is not supported yet. Reply from your iPhone WhatsApp directly.',
      },
      { status: 400 }
    )
  }

  const accountId = PANEL_ACCOUNT_MAP[panel]
  const wireText = attachmentUrl
    ? text
      ? `${text}\n${attachmentUrl}`
      : attachmentUrl
    : text

  const optimisticRow = {
    thread_id: threadId,
    panel,
    channel_type: 'whatsapp' as const,
    direction: 'out' as const,
    body: text || null,
    media_url: attachmentUrl,
    media_type: attachmentType || getMediaType(attachmentFilename),
    media_filename: attachmentFilename,
    timelines_uid: null,
    from_phone: null,
    from_name: null,
    sent_at: new Date().toISOString(),
    status: 'Pending',
    is_group_message: thread.is_group,
  }

  const { data: inserted, error: insertErr } = await service
    .from('whatsapp_messages')
    .insert(optimisticRow)
    .select('*')
    .single()

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: 'db_insert_failed', message: insertErr?.message },
      { status: 500 }
    )
  }

  let sent: TimelinesMessage
  try {
    sent = await sendMessage({
      phone: recipientPhone,
      text: wireText,
      whatsappAccountPhone: accountId,
    })
  } catch (err) {
    const msg = (err as Error).message ?? ''
    const isQuota = msg.includes('403')
    await service
      .from('whatsapp_messages')
      .update({ status: isQuota ? 'QuotaExceeded' : 'Failed' })
      .eq('id', inserted.id)
    return NextResponse.json(
      {
        error: isQuota ? 'timelines_quota_exceeded' : 'timelines_send_failed',
        message: isQuota
          ? 'Timelines API monthly quota exceeded — resets May 1. Message saved; retry tomorrow.'
          : msg,
      },
      { status: isQuota ? 429 : 502 }
    )
  }

  const sentAtIso = sent.timestamp
    ? parseTimelinesTimestamp(sent.timestamp).toISOString()
    : optimisticRow.sent_at

  const { data: updated, error: updateErr } = await service
    .from('whatsapp_messages')
    .update({
      timelines_uid: sent.uid || null,
      status: sent.status || 'Sent',
      sent_at: sentAtIso,
    })
    .eq('id', inserted.id)
    .select('*')
    .single()

  if (updateErr) {
    return NextResponse.json(
      { error: 'db_update_failed', message: updateErr.message },
      { status: 500 }
    )
  }

  const previewBase = text || attachmentFilename || 'attachment'
  const preview = previewBase.length > 80 ? previewBase.slice(0, 79) + '…' : previewBase
  await service
    .from('whatsapp_threads')
    .update({
      last_message_at: sentAtIso,
      last_message_preview: preview,
    })
    .eq('id', threadId)

  // Secretary: record outbound ask once Timelines confirms send. Window=24h.
  // Recipient identifier is the normalized E.164 we sent to; the inbound
  // webhook resolves replies via the same phone match. Non-fatal.
  await recordOutboundAsk({
    recipientIdentifier: recipientPhone,
    channel: 'whatsapp',
    body: text || attachmentFilename || null,
    relatedThreadId: threadId,
    sentAt: new Date(sentAtIso),
  })

  const result: DashboardMessage = {
    id: updated.id,
    thread_id: updated.thread_id,
    panel: updated.panel,
    channel_type: updated.channel_type,
    direction: updated.direction,
    body: updated.body,
    media_url: updated.media_url,
    media_type: updated.media_type,
    media_filename: updated.media_filename,
    timelines_uid: updated.timelines_uid,
    from_phone: updated.from_phone,
    from_name: updated.from_name,
    sent_at: updated.sent_at,
    status: updated.status,
    is_group_message: updated.is_group_message,
  }

  return NextResponse.json(result)
}
