import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { centerAuthed } from '@/lib/center/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMessage, PANEL_ACCOUNT_MAP } from '@/lib/timelines/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// The approval queue: the Spanish secretary's Hebrew<->Spanish drafts wait here
// for the English side (Gideon/Shirel) to approve + send. Nothing else needs
// approval — English-side messages (English OR Hebrew) send directly.
const b64url = (b: string | Buffer) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const encSub = (s: string) => '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?='

// GET — pending approvals for the English-only panel. Empty array => panel hides.
export async function GET(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('approvals')
    .select('id, source_row, contact_name, channel, their_es, draft_es, draft_he, created_at')
    .eq('status', 'pending').order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message, approvals: [] }, { status: 500 })
  return NextResponse.json({ approvals: data || [] })
}

export async function POST(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let b: { action?: string; id?: string; source_row?: number; contact_name?: string; channel?: string; their_text?: string; their_es?: string; draft_es?: string; draft_he?: string }
  try { b = await request.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }
  const supabase = createServiceClient()

  // CREATE — Spanish side sends a Hebrew<->Spanish draft for approval.
  if (b.action === 'create') {
    const { data, error } = await supabase.from('approvals').insert({
      source_row: b.source_row ?? null, contact_name: b.contact_name || '', channel: b.channel || 'whatsapp',
      their_text: b.their_text || '', their_es: b.their_es || '', draft_es: b.draft_es || '', draft_he: b.draft_he || '',
      worked_by: 'spanish', status: 'pending',
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: data?.id })
  }

  // REJECT — drop it from the queue.
  if (b.action === 'reject') {
    if (!b.id) return NextResponse.json({ error: 'no_id' }, { status: 400 })
    await supabase.from('approvals').update({ status: 'rejected', decided_at: new Date().toISOString() }).eq('id', b.id)
    return NextResponse.json({ ok: true })
  }

  // APPROVE — send the Hebrew draft on the contact's channel, then mark sent.
  if (b.action === 'approve') {
    if (!b.id) return NextResponse.json({ error: 'no_id' }, { status: 400 })
    const { data: row } = await supabase.from('approvals').select('*').eq('id', b.id).maybeSingle()
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const r = row as { source_row: number | null; channel: string; draft_he: string; draft_es: string }
    const text = (r.draft_he || r.draft_es || '').trim()
    if (!text) return NextResponse.json({ error: 'empty_draft' }, { status: 400 })

    // Look up the contact's phone/email from the roster.
    let phone = '', email = ''
    if (r.source_row != null) {
      const { data: c } = await supabase.from('roster').select('phone, email').eq('source_row', r.source_row).maybeSingle()
      if (c) { phone = (c as { phone: string | null }).phone || ''; email = (c as { email: string | null }).email || '' }
    }
    try {
      if (r.channel === 'email' && email) {
        const auth = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET)
        auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
        const gmail = google.gmail({ version: 'v1', auth })
        const headers = [`From: Gideon Gratsiani <g@reprime.com>`, `To: ${email}`, `Subject: ${encSub('RePrime — Gideon Gratsiani')}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64'].join('\r\n')
        await gmail.users.messages.send({ userId: 'me', requestBody: { raw: b64url(headers + '\r\n\r\n' + Buffer.from(text, 'utf8').toString('base64')) } })
      } else if (phone) {
        await sendMessage({ phone, text, whatsappAccountPhone: PANEL_ACCOUNT_MAP['305'] })
      } else {
        return NextResponse.json({ error: 'no_destination' }, { status: 400 })
      }
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 })
    }
    await supabase.from('approvals').update({ status: 'sent', decided_at: new Date().toISOString() }).eq('id', b.id)
    if (r.source_row != null) await supabase.from('roster').update({ awaiting_us: false, last_from: 'us' }).eq('source_row', r.source_row)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'bad_action' }, { status: 400 })
}
