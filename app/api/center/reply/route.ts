import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { centerAuthed } from '@/lib/center/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMessage, PANEL_ACCOUNT_MAP } from '@/lib/timelines/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Send an approved reply from the queue — WhatsApp (either line) or email —
// without leaving the Command Center. After sending, clear awaiting_us on the
// matching roster person so they drop off the "you owe a reply" list.
const dig9 = (s: string) => (s || '').replace(/\D/g, '').slice(-9)
const b64url = (b: string | Buffer) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const encSub = (s: string) => '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?='

export async function POST(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let b: { channel?: string; phone?: string; email?: string; text?: string; subject?: string; account?: string }
  try { b = await request.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }
  const text = (b.text || '').trim()
  if (!text) return NextResponse.json({ error: 'empty' }, { status: 400 })

  try {
    if (b.channel === 'email') {
      if (!b.email) return NextResponse.json({ error: 'no_email' }, { status: 400 })
      const auth = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET)
      auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
      const gmail = google.gmail({ version: 'v1', auth })
      const subject = b.subject || 'RePrime — Gideon Gratsiani'
      const headers = [`From: Gideon Gratsiani <g@reprime.com>`, `To: ${b.email}`, `Subject: ${encSub(subject)}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64'].join('\r\n')
      const raw = b64url(headers + '\r\n\r\n' + Buffer.from(text, 'utf8').toString('base64'))
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    } else {
      if (!b.phone) return NextResponse.json({ error: 'no_phone' }, { status: 400 })
      const account = (b.account === '718' ? '718' : '305') as '305' | '718'
      await sendMessage({ phone: b.phone, text, whatsappAccountPhone: PANEL_ACCOUNT_MAP[account] })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 })
  }

  // Clear awaiting_us on the matching roster row (best-effort).
  try {
    const supabase = createServiceClient()
    const now = new Date().toISOString()
    if (b.email) await supabase.from('roster').update({ awaiting_us: false, last_from: 'us', verified_at: now }).eq('email', b.email)
    if (b.phone) {
      const { data } = await supabase.from('roster').select('source_row, phone')
      for (const r of (data || []) as Array<{ source_row: number; phone: string | null }>) {
        if (r.phone && dig9(r.phone) === dig9(b.phone)) await supabase.from('roster').update({ awaiting_us: false, last_from: 'us', verified_at: now }).eq('source_row', r.source_row)
      }
    }
  } catch { /* non-blocking */ }

  return NextResponse.json({ ok: true })
}
