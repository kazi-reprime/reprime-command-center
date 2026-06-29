import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { centerAuthed } from '@/lib/center/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { sendFileByPhone, sendVoiceMessage, uploadFile, resolveChatId, PANEL_ACCOUNT_MAP } from '@/lib/timelines/client'
import { storeAndTranscribe } from '@/lib/center/voice-note'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Send a VOICE reply or a FILE attachment from the queue composer, over WhatsApp
// or email, and reflect it on the board. Voice replies go out as a real WhatsApp
// voice note when we know the contact's chat id, else as a playable audio
// attachment; either way they're transcribed (so Gideon can read, not just
// listen) and stored durably with a ▶ player — same as inbound notes.

const dig9 = (s: string | null | undefined) => (s || '').replace(/\D/g, '').slice(-9)
const b64url = (b: string | Buffer) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const encSub = (s: string) => '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?='

export async function POST(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let form: FormData
  try { form = await request.formData() } catch { return NextResponse.json({ error: 'bad_form' }, { status: 400 }) }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'no_file' }, { status: 400 })
  const kind = String(form.get('kind') || 'file')            // 'voice' | 'file'
  const channel = String(form.get('channel') || 'whatsapp')  // 'whatsapp' | 'email'
  const phone = String(form.get('phone') || '')
  const email = String(form.get('email') || '')
  const account = (String(form.get('account') || '305') === '718' ? '718' : '305') as '305' | '718'
  const caption = String(form.get('text') || '')
  const filename = file.name || (kind === 'voice' ? 'voice.ogg' : 'file')
  const mime = file.type || (kind === 'voice' ? 'audio/ogg' : 'application/octet-stream')
  const buf = Buffer.from(await file.arrayBuffer())
  if (!buf.length) return NextResponse.json({ error: 'empty_file' }, { status: 400 })

  const service = createServiceClient()
  const isVoice = kind === 'voice'
  let deliveredAs: 'voice_note' | 'file' | 'email' = 'file'  // how it actually went out

  // 1) Durable copy (+ transcript for voice). Files just get a durable URL.
  let durableUrl: string | null = null
  let transcript = ''
  try {
    if (isVoice) {
      const r = await storeAndTranscribe(buf, `out-${dig9(phone) || Date.now()}-${Date.now()}`, filename, 'voice/out')
      durableUrl = r.durableUrl; transcript = r.transcript
    } else {
      const ext = (filename.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
      const path = `files/out/${(dig9(phone) || 'x')}-${Date.now()}.${ext}`
      const { error } = await service.storage.from('attachments').upload(path, buf, { contentType: mime, upsert: true })
      if (!error) durableUrl = service.storage.from('attachments').getPublicUrl(path).data?.publicUrl || null
    }
  } catch { /* storage/transcribe best-effort */ }

  // 2) Send it.
  try {
    if (channel === 'email') {
      if (!email) return NextResponse.json({ error: 'no_email' }, { status: 400 })
      const auth = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET)
      auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
      const gmail = google.gmail({ version: 'v1', auth })
      const B = 'b_' + Math.abs(buf.length * 2654435761 % 1e9).toString(36)
      const subject = caption.slice(0, 80) || (isVoice ? 'RePrime — voice message' : 'RePrime — file')
      const body = caption || (isVoice ? '(voice message attached)' : '(file attached)')
      const mimeMsg = [
        `From: Gideon Gratsiani <g@reprime.com>`, `To: ${email}`, `Subject: ${encSub(subject)}`,
        'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${B}"`, '',
        `--${B}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', Buffer.from(body, 'utf8').toString('base64'), '',
        `--${B}`, `Content-Type: ${mime}; name="${filename}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${filename}"`, '', buf.toString('base64'), '',
        `--${B}--`, '',
      ].join('\r\n')
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw: b64url(mimeMsg) } })
      deliveredAs = 'email'
    } else {
      if (!phone) return NextResponse.json({ error: 'no_phone' }, { status: 400 })
      // A play-inline voice note requires the voice_message endpoint (chat id) +
      // an ogg/oga/mp3 file (the frontend converts the browser's mp4 to mp3).
      let sent = false
      if (isVoice) {
        // Resolve the chat id: stored on the thread → else a single filtered live
        // lookup (then store it so future replies are instant).
        const last7 = (phone || '').replace(/\D/g, '').slice(-7)
        const { data: th } = await service.from('whatsapp_threads').select('id, timelines_chat_id, phone').ilike('phone', `%${last7}%`)
        const trow = (th || []).find((t: { phone: string | null }) => t.phone && dig9(t.phone) === dig9(phone)) as { id: string; timelines_chat_id: number | null } | undefined
        let chatId = trow?.timelines_chat_id || null
        if (!chatId) {
          chatId = await resolveChatId(phone, PANEL_ACCOUNT_MAP[account])
          if (chatId && trow) { try { await service.from('whatsapp_threads').update({ timelines_chat_id: chatId }).eq('id', trow.id) } catch { /* non-fatal */ } }
        }
        if (chatId && /ogg|mpeg|mp3/i.test(mime)) {
          try { await sendVoiceMessage(chatId, buf, filename, mime); sent = true; deliveredAs = 'voice_note' } catch { /* fall back below */ }
        }
      }
      if (!sent) {
        const fileUid = await uploadFile(buf, filename, mime)
        await sendFileByPhone({ phone, fileUid, text: caption, whatsappAccountPhone: PANEL_ACCOUNT_MAP[account] })
        deliveredAs = 'file'
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 })
  }

  // 3) Reflect on the board + store the message. Best-effort.
  const text = (transcript || caption || (isVoice ? '🎤' : ('📎 ' + filename))).slice(0, 500)
  try {
    const last9 = dig9(phone)
    // whatsapp_messages (for the expanded card / cockpit)
    if (phone) {
      const last7 = (phone || '').replace(/\D/g, '').slice(-7)
      const { data: threads } = await service.from('whatsapp_threads').select('id, phone, panel').ilike('phone', `%${last7}%`)
      const th = (threads || []).find((t: { phone: string | null }) => t.phone && dig9(t.phone) === last9) || (threads || [])[0]
      if (th) {
        await service.from('whatsapp_messages').insert({
          thread_id: (th as { id: string }).id, panel: account, channel_type: 'whatsapp', direction: 'out',
          body: transcript || caption || null, media_url: durableUrl, media_type: isVoice ? 'audio' : 'document',
          media_filename: filename, from_name: 'Gideon', sent_at: new Date().toISOString(), is_group_message: false,
        })
      }
    }
    // roster board row
    const { data: roster } = await service.from('roster').select('source_row, phone, email, thread_json')
    const r = (roster || []).find((x: { phone: string | null; email: string | null }) =>
      (x.phone && last9 && dig9(x.phone) === last9) || (x.email && email && x.email.toLowerCase().trim() === email.toLowerCase().trim())) as { source_row: number; thread_json: string | null } | undefined
    if (r) {
      let arr: Array<{ who: string; date: string; text: string; via?: string; audio?: string }> = []
      try { arr = r.thread_json ? JSON.parse(r.thread_json) : [] } catch { arr = [] }
      let date = ''
      try { date = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date()) } catch { /* keep '' */ }
      const entry: { who: string; date: string; text: string; via?: string; audio?: string } = { who: 'us', date, text, via: channel === 'email' ? 'email' : 'wa' }
      if (isVoice && durableUrl) entry.audio = durableUrl
      arr.push(entry)
      if (arr.length > 40) arr = arr.slice(-40)
      await service.from('roster').update({
        thread_json: JSON.stringify(arr), last_reply_text: text, last_from: 'us',
        awaiting_us: false, updated_at: new Date().toISOString(),
      }).eq('source_row', r.source_row)
    }
  } catch { /* non-blocking */ }

  return NextResponse.json({ ok: true, deliveredAs, transcript, audio: durableUrl })
}

// Read-only helper to test chat-id resolution: GET ?resolve=<phone>&account=305
export async function GET(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const u = new URL(request.url)
  const phone = u.searchParams.get('resolve') || ''
  const account = (u.searchParams.get('account') === '718' ? '718' : '305') as '305' | '718'
  if (!phone) return NextResponse.json({ ok: true, hint: 'POST media here; GET ?resolve=<phone> to test chat-id resolution' })
  const chatId = await resolveChatId(phone, PANEL_ACCOUNT_MAP[account])
  return NextResponse.json({ ok: true, phone, account, chatId })
}
