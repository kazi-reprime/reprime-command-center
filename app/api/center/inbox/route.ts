import { NextResponse } from 'next/server'
import { centerAuthed } from '@/lib/center/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getChats, getMessages } from '@/lib/timelines/client'
import { listRecent, getMessage, parseFromHeader } from '@/lib/google/gmail'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// One inbox: every inbound reply FROM PEOPLE WE'VE CONTACTED — WhatsApp (both
// lines) + email — in a single feed, newest first. Filtered to our outreach
// contacts so it's the investor queue, not the noisy raw inbox.
type Item = { channel: 'whatsapp' | 'email'; who: string; handle: string; preview: string; at: string | null; link: string; phone?: string; email?: string; account?: '305' | '718'; subject?: string }
const dig9 = (s: string) => (s || '').replace(/\D/g, '').slice(-9)

export async function GET(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Load our contact universe (emails + phone last-9) so we only surface replies
  // from people in the outreach, not every random inbound.
  const supabase = createServiceClient()
  const emailSet = new Set<string>()
  const phoneSet = new Set<string>()
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await supabase.from('invitations').select('contact_email, contact_phone').range(from, from + 999)
    if (error) break
    const rows = (data || []) as Array<{ contact_email: string | null; contact_phone: string | null }>
    for (const r of rows) { if (r.contact_email) emailSet.add(r.contact_email.toLowerCase().trim()); if (r.contact_phone) phoneSet.add(dig9(r.contact_phone)) }
    if (rows.length < 1000) break
  }

  const items: Item[] = []
  const errors: string[] = []

  for (const panel of ['305', '718'] as const) {
    try {
      const chats = await getChats(panel)
      const waiting = chats
        .filter((c) => !c.is_group && c.unattended && c.phone && phoneSet.has(dig9(c.phone)))
        .sort((a, b) => (b.last_message_timestamp || '').localeCompare(a.last_message_timestamp || ''))
        .slice(0, 20)
      for (const c of waiting) {
        let preview = ''
        try { const msgs = await getMessages(c.id); const lastIn = [...msgs].reverse().find((m) => !m.from_me); preview = (lastIn?.text || '').slice(0, 220) } catch { /* rate-limited */ }
        items.push({ channel: 'whatsapp', who: c.name || c.phone || 'Unknown', handle: `${c.phone || ''} · ${panel}`, preview, at: c.last_message_timestamp, link: c.phone ? `https://wa.me/${c.phone.replace(/\D/g, '')}` : '', phone: c.phone || undefined, account: panel })
      }
    } catch (e) { errors.push(`wa_${panel}: ${(e as Error).message.slice(0, 80)}`) }
  }

  try {
    const recent = await listRecent('me', 5)
    for (const m of recent.slice(0, 40)) {
      try {
        const msg = await getMessage(m.id)
        const fromH = parseFromHeader(msg.headers['from'])
        if (!emailSet.has(fromH.address.toLowerCase().trim())) continue // only replies from our contacts
        items.push({ channel: 'email', who: fromH.name || fromH.address, handle: fromH.address, preview: (msg.headers['subject'] ? msg.headers['subject'] + ' — ' : '') + (msg.snippet || '').slice(0, 200), at: msg.receivedAt, link: `https://mail.google.com/mail/u/0/#inbox/${msg.threadId}`, email: fromH.address, subject: msg.headers['subject'] || undefined })
      } catch { /* skip */ }
    }
  } catch (e) { errors.push(`email: ${(e as Error).message.slice(0, 80)}`) }

  items.sort((a, b) => (b.at || '').localeCompare(a.at || ''))
  return NextResponse.json({ count: items.length, items, errors })
}
