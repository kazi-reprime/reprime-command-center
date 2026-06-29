import { NextResponse } from 'next/server'
import { centerAuthed } from '@/lib/center/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getMessages, resolveChatId, PANEL_ACCOUNT_MAP } from '@/lib/timelines/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// SOURCE-OF-TRUTH RECONCILE. Incremental webhook capture has gaps (outbound was
// under-recorded), so the board could silently drift from WhatsApp. This pulls a
// contact's ACTUAL recent thread from Timelines (getMessages on the resolved chat
// id) and rebuilds the board row + message store from it — both directions — so
// the board mirrors reality regardless of any missed webhook. On any Timelines
// error the contact is left untouched (never wiped).
//
//   POST { source_row }            reconcile ONE contact (used on card-open + tests)
//   POST { limit, scope }          batch: scope 'active' (queue/awaiting/recent) or 'all'

const dig9 = (s: string | null | undefined) => (s || '').replace(/\D/g, '').slice(-9)
const fmtDate = (iso: string | number) => { try { return new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(iso)) } catch { return '' } }
const isHe = (s: string) => /[֐-׿]/.test(s || '')

function mediaMarker(t: string | undefined): string {
  const x = (t || '').toLowerCase()
  if (x === 'ptt' || x === 'audio' || x === 'voice') return '🎤'
  if (x === 'image' || x === 'sticker') return '📷'
  if (x === 'video') return '🎥'
  if (x === 'document' || x === 'file') return '📎'
  return '📎'
}

type Roster = { source_row: number; phone: string | null; board_stage: string | null; thread_json: string | null; awaiting_us: boolean | null; last_reply_at: string | null }

async function reconcileOne(service: ReturnType<typeof createServiceClient>, r: Roster): Promise<{ row: number; ok: boolean; reason?: string; lastFrom?: string; count?: number }> {
  const phone = r.phone || ''
  if (!phone) return { row: r.source_row, ok: false, reason: 'no phone' }
  const last7 = phone.replace(/\D/g, '').slice(-7)

  // Locate the thread + its (maybe stored) chat id and panel.
  const { data: threads } = await service.from('whatsapp_threads').select('id, phone, panel, timelines_chat_id').ilike('phone', `%${last7}%`)
  const th = (threads || []).find((t: { phone: string | null }) => t.phone && dig9(t.phone) === dig9(phone)) as { id: string; panel: string | null; timelines_chat_id: number | null } | undefined
  const panel = (th?.panel === '718' ? '718' : '305') as '305' | '718'

  let chatId = th?.timelines_chat_id || null
  if (!chatId) {
    chatId = await resolveChatId(phone, PANEL_ACCOUNT_MAP[panel])
    if (chatId && th) { try { await service.from('whatsapp_threads').update({ timelines_chat_id: chatId }).eq('id', th.id) } catch { /* non-fatal */ } }
  }
  if (!chatId) return { row: r.source_row, ok: false, reason: 'no chat id' }

  let msgs
  try { msgs = await getMessages(chatId) } catch (e) { return { row: r.source_row, ok: false, reason: 'getMessages: ' + (e as Error).message.slice(0, 60) } }
  // A stale/duplicate chat id can come back empty — re-resolve (now picks the
  // chat that actually has messages) and retry once, then cache the good id.
  if (!msgs || !msgs.length) {
    const fresh = await resolveChatId(phone, PANEL_ACCOUNT_MAP[panel])
    if (fresh && fresh !== chatId) {
      try { msgs = await getMessages(fresh) } catch { /* keep empty */ }
      if (msgs && msgs.length) { chatId = fresh; if (th) { try { await service.from('whatsapp_threads').update({ timelines_chat_id: fresh }).eq('id', th.id) } catch { /* non-fatal */ } } }
    }
  }
  if (!msgs || !msgs.length) return { row: r.source_row, ok: false, reason: 'empty' }

  // Timelines returns newest-first. Take the most recent 25, oldest→newest.
  const recent = msgs.slice(0, 25).reverse()

  // Carry over any durable audio URLs we already stored (match by text), so the
  // ▶ player survives the rebuild.
  let prev: Array<{ text?: string; audio?: string }> = []
  try { prev = r.thread_json ? JSON.parse(r.thread_json) : [] } catch { prev = [] }
  const audioByText = new Map<string, string>()
  for (const p of prev) { if (p.audio && p.text) audioByText.set(p.text.trim(), p.audio) }

  const chain = recent.map((m) => {
    const raw = (m.text || '').trim()
    const text = raw || mediaMarker(m.message_type)
    const entry: { who: string; date: string; text: string; via: string; audio?: string } = {
      who: m.from_me ? 'us' : 'them',
      date: fmtDate((m as { timestamp?: string }).timestamp || ''),
      text: text.slice(0, 400),
      via: 'wa',
    }
    const dur = audioByText.get(text.slice(0, 400)) || audioByText.get(raw)
    if ((m.message_type === 'ptt' || m.message_type === 'audio' || m.message_type === 'voice') && dur) entry.audio = dur
    return entry
  })

  const latest = recent[recent.length - 1]
  const latestText = (latest.text || '').trim() || mediaMarker(latest.message_type)
  const lastFrom = latest.from_me ? 'us' : 'them'
  const awaiting = !latest.from_me
  const latestAt = (() => { try { return new Date((latest as { timestamp?: string }).timestamp || Date.now()).toISOString() } catch { return new Date().toISOString() } })()

  const upd: Record<string, unknown> = {
    thread_json: JSON.stringify(chain),
    last_reply_text: latestText.slice(0, 500),
    last_from: lastFrom,
    awaiting_us: awaiting,
    last_reply_at: latestAt,
    updated_at: new Date().toISOString(),
  }
  if (awaiting && r.board_stage !== 'booked' && r.board_stage !== 'declined') upd.board_stage = 'replied'
  await service.from('roster').update(upd).eq('source_row', r.source_row)

  // Also upsert the real messages into the store so the expanded card + cockpit
  // are correct too (dedupe by timelines_uid).
  if (th) {
    const rows = recent.filter((m) => m.uid).map((m) => ({
      thread_id: th.id, panel, channel_type: 'whatsapp' as const,
      direction: m.from_me ? ('out' as const) : ('in' as const),
      body: (m.text || '').trim() || null,
      media_type: (m.message_type && m.message_type !== 'text') ? (mediaMarker(m.message_type) === '🎤' ? 'audio' : mediaMarker(m.message_type) === '📷' ? 'image' : mediaMarker(m.message_type) === '🎥' ? 'video' : 'document') : null,
      media_url: (m as { attachment_url?: string | null }).attachment_url || null,
      timelines_uid: m.uid,
      from_phone: m.from_me ? null : phone,
      from_name: m.sender_name || null,
      sent_at: (() => { try { return new Date((m as { timestamp?: string }).timestamp || '').toISOString() } catch { return null } })(),
      is_group_message: false,
    }))
    if (rows.length) { try { await service.from('whatsapp_messages').upsert(rows, { onConflict: 'timelines_uid' }) } catch { /* non-fatal */ } }
  }

  return { row: r.source_row, ok: true, lastFrom, count: chain.length }
}

export async function POST(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: { source_row?: number; limit?: number; scope?: string } = {}
  try { body = await request.json() } catch { /* defaults */ }
  const service = createServiceClient()

  // Single contact.
  if (typeof body.source_row === 'number') {
    const { data } = await service.from('roster').select('source_row, phone, board_stage, thread_json, awaiting_us, last_reply_at').eq('source_row', body.source_row).limit(1)
    const r = ((data || [])[0] as Roster | undefined)
    if (!r) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    const res = await reconcileOne(service, r)
    return NextResponse.json({ ok: true, mode: 'one', result: res })
  }

  return runBatch(service, body.limit, body.scope)
}

// Cron entry (no session) — keeps active conversations mirrored in the background.
// Small rolling batch so it never trips the Timelines rate limit.
export async function GET() {
  const service = createServiceClient()
  return runBatch(service, 12, 'active')
}

async function runBatch(service: ReturnType<typeof createServiceClient>, limitIn?: number, scopeIn?: string) {
  // Least-recently-reconciled first so repeated runs cycle through everyone.
  const limit = Math.min(60, Math.max(1, limitIn || 30))
  const scope = scopeIn === 'all' ? 'all' : 'active'
  // `any` on the builder: chaining many Supabase filters makes the TS type
  // recursion blow up ("excessively deep"); the runtime is unaffected.
  let q = service.from('roster').select('source_row, phone, board_stage, thread_json, awaiting_us, last_reply_at') as any
  q = q.not('phone', 'is', null)
  // Only contacts who have had real WhatsApp activity (last_reply_at set) — skip
  // invitees who never messaged on WhatsApp (nothing to mirror, wastes API calls).
  if (scope === 'active') { q = q.neq('board_stage', 'booked'); q = q.neq('board_stage', 'declined'); q = q.not('last_reply_at', 'is', null) }
  q = q.order('updated_at', { ascending: true, nullsFirst: true }).limit(limit)
  const { data } = await q
  const rows = (data || []) as Roster[]

  const results: Array<{ row: number; ok: boolean; reason?: string }> = []
  for (const r of rows) {
    const res = await reconcileOne(service, r)
    // On a skip (no chat / no phone) bump updated_at so the row cycles to the
    // back and the batch advances instead of re-trying the same dead ends.
    if (!res.ok) { try { await service.from('roster').update({ updated_at: new Date().toISOString() }).eq('source_row', r.source_row) } catch { /* non-fatal */ } }
    results.push({ row: res.row, ok: res.ok, reason: res.reason })
  }
  const okN = results.filter((x) => x.ok).length
  return NextResponse.json({ ok: true, mode: 'batch', scope, attempted: results.length, reconciled: okN, failed: results.length - okN, results })
}
