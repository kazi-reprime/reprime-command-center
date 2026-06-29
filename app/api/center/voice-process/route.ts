import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { centerAuthed } from '@/lib/center/auth'
import { processVoiceNote, type VoiceNoteResult } from '@/lib/center/voice-note'
import { getAllChats, getMessages } from '@/lib/timelines/client'
import type { Panel } from '@/lib/timelines/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Backfill + safety net for inbound WhatsApp voice notes. The webhook transcribes
// new notes inline; this catches (a) notes that arrived BEFORE the feature and
// (b) any live transcription that timed out. For each un-transcribed inbound
// audio message from a ROSTER contact: get a live audio link, store a durable
// copy, run Whisper, write the transcript back, and refresh the board row (which
// rings the realtime bell). Roster-only — the board tracks exactly those people.
//
// Modes (POST body):
//   {}                      auto-backfill recent un-transcribed notes
//   {limit:N}               cap how many
//   {uid, chatId}           recover ONE message by re-minting its link via a
//                           single getMessages(chatId) call (avoids the
//                           rate-limited full chat scan)

const dig9 = (s: string | null | undefined) => (s || '').replace(/\D/g, '').slice(-9)
const PLACEHOLDER = /^(📎|🎤)/
const AUDIO_EXT = /\.(oga|ogg|opus|amr|m4a|mka|aac|wav|mp3)$/i

type Msg = { id: string; timelines_uid: string | null; media_url: string | null; media_filename: string | null; media_type: string | null; from_phone: string | null; sent_at: string | null; body: string | null; is_group_message: boolean | null; panel: string | null }
type RosterRow = { source_row: number; board_stage: string | null; thread_json: string | null }
const SELECT = 'id, timelines_uid, media_url, media_filename, media_type, from_phone, sent_at, body, is_group_message, panel'

// Write the transcript + durable audio back to the message and the board row.
async function persist(service: ReturnType<typeof createServiceClient>, m: Msg, vn: VoiceNoteResult, byL9: Map<string, RosterRow>) {
  const transcript = vn.transcript
  await service.from('whatsapp_messages').update({ body: transcript || null, media_url: vn.durableUrl || m.media_url, media_type: 'audio' }).eq('id', m.id)

  const r = byL9.get(dig9(m.from_phone))
  if (r) {
    let arr: Array<{ who: string; date: string; text: string; via?: string; audio?: string }> = []
    try { arr = r.thread_json ? JSON.parse(r.thread_json) : [] } catch { arr = [] }
    arr = arr.filter((e) => !(e.who === 'them' && PLACEHOLDER.test((e.text || '').trim())))
    let date = ''
    try { date = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(m.sent_at || Date.now())) } catch { /* keep '' */ }
    const text = transcript || '🎤'
    const entry: { who: string; date: string; text: string; via?: string; audio?: string } = { who: 'them', date, text: text.slice(0, 400), via: 'wa' }
    // Player gets the DURABLE url only — never the 15-min temp link.
    if (vn.durableUrl) entry.audio = vn.durableUrl
    arr.push(entry)
    if (arr.length > 40) arr = arr.slice(-40)
    const upd: Record<string, unknown> = {
      thread_json: JSON.stringify(arr),
      last_reply_text: text.slice(0, 500),
      last_from: 'them',
      awaiting_us: true,
      last_reply_at: new Date(m.sent_at || Date.now()).toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (r.board_stage !== 'booked' && r.board_stage !== 'declined') upd.board_stage = 'replied'
    await service.from('roster').update(upd).eq('source_row', r.source_row)
    r.thread_json = upd.thread_json as string
  }
  return { uid: m.timelines_uid, hasTranscript: !!transcript, durable: !!vn.durableUrl }
}

export async function POST(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let limit = 25
  let uid: string | null = null
  let chatId: number | null = null
  try {
    const b = await request.json()
    if (b && typeof b.limit === 'number') limit = Math.min(50, Math.max(1, b.limit))
    if (b && typeof b.uid === 'string') uid = b.uid
    if (b && (typeof b.chatId === 'number' || typeof b.chatId === 'string')) chatId = Number(b.chatId)
  } catch { /* defaults */ }

  const service = createServiceClient()
  const { data: roster } = await service.from('roster').select('source_row, phone, board_stage, thread_json')
  const byL9 = new Map<string, RosterRow>()
  for (const r of (roster || []) as Array<RosterRow & { phone: string | null }>) {
    const l9 = dig9(r.phone); if (l9) byL9.set(l9, r)
  }

  // ── Targeted recovery: one message, fresh link via a single getMessages call ──
  if (uid && chatId) {
    const { data } = await service.from('whatsapp_messages').select(SELECT).eq('timelines_uid', uid).limit(1)
    const m = ((data || [])[0] as Msg | undefined)
    if (!m) return NextResponse.json({ ok: false, error: 'message not found' }, { status: 404 })
    let freshUrl: string | null = null
    let freshName: string | null = m.media_filename
    try {
      const msgs = await getMessages(chatId)
      const hit = msgs.find((x) => x.uid === uid)
      if (hit && hit.attachment_url) { freshUrl = hit.attachment_url; freshName = hit.attachment_filename || m.media_filename }
    } catch (e) { return NextResponse.json({ ok: false, error: 'getMessages: ' + (e as Error).message.slice(0, 120) }, { status: 502 }) }
    if (!freshUrl) return NextResponse.json({ ok: false, error: 'message has no audio attachment via Timelines' }, { status: 404 })
    const vn = await processVoiceNote({ srcUrl: freshUrl, uid: m.timelines_uid || m.id, filename: freshName })
    const res = await persist(service, m, vn, byL9)
    return NextResponse.json({ ok: true, mode: 'targeted', result: res })
  }

  // ── Auto backfill: recent un-transcribed inbound audio from roster contacts ───
  const { data: msgs } = await service.from('whatsapp_messages').select(SELECT)
    .eq('direction', 'in').order('sent_at', { ascending: false }).limit(400)
  const candidates = ((msgs || []) as Msg[]).filter((m) => !m.is_group_message && m.media_url
    && (m.media_type === 'audio' || AUDIO_EXT.test(m.media_filename || ''))
    && !(m.body && m.body.trim())
    && dig9(m.from_phone) && byL9.has(dig9(m.from_phone))).slice(0, limit)

  const results: Array<{ uid: string | null; hasTranscript: boolean; durable: boolean; refetched: boolean }> = []
  for (const m of candidates) {
    let vn = await processVoiceNote({ srcUrl: m.media_url as string, uid: m.timelines_uid || m.id, filename: m.media_filename })
    let refetched = false
    // Stored link dead → re-mint via Timelines (one page at a time so we don't
    // burst past the rate limit) and retry.
    if (!vn.durableUrl && !vn.transcript && (m.panel === '718' || m.panel === '305')) {
      const l9 = dig9(m.from_phone)
      try {
        const chats = await getAllChats(m.panel as Panel, 8)
        const chat = chats.find((c) => dig9(c.phone) === l9)
        if (chat) {
          const list = await getMessages(chat.id)
          const hit = list.find((x) => x.uid === m.timelines_uid)
          if (hit && hit.attachment_url) { refetched = true; vn = await processVoiceNote({ srcUrl: hit.attachment_url, uid: m.timelines_uid || m.id, filename: hit.attachment_filename || m.media_filename }) }
        }
      } catch { /* Timelines unavailable (e.g. 429) → leave note for next run */ }
    }
    const res = await persist(service, m, vn, byL9)
    results.push({ ...res, refetched })
  }

  return NextResponse.json({ ok: true, mode: 'auto', processed: results.length, results })
}
