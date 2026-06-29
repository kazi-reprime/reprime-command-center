import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getChats, getMessages, sendChatMessage } from '@/lib/timelines/client'
import { listRecent, getMessage, parseFromHeader } from '@/lib/google/gmail'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// HOURLY WATCHER. Nobody should have to go looking. Every hour this scans
// WhatsApp (both lines) + email for inbound from people in the roster, keeps
// each person's "awaiting you / handled" state fresh, and — when something NEW
// has come in since the last alert — fires ONE short nudge to the
// "Terminal invitations" WhatsApp group: "🔔 N to respond to: …". Each inbound
// alerts once; replying to it (last message becomes ours) clears it so the
// next message from that person can alert again.
const dig9 = (s: string) => (s || '').replace(/\D/g, '').slice(-9)
const ALERT_CHAT_ID = Number(process.env.CENTER_ALERT_CHAT_ID || '56184407') // group "Terminal invitations"

type Row = { source_row: number; name: string; phone: string | null; email: string | null; last_reply_at: string | null; alerted_at: string | null; awaiting_us: boolean | null }
type Patch = { awaiting_us: boolean; last_from: string; last_reply_text?: string; last_reply_at?: string | null; verified_at: string }

export async function GET() {
  const supabase = createServiceClient()
  const nowIso = new Date().toISOString()

  const { data: roster, error } = await supabase
    .from('roster')
    .select('source_row, name, phone, email, last_reply_at, alerted_at, awaiting_us')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (roster || []) as Row[]
  const byPhone = new Map<string, Row>()
  const byEmail = new Map<string, Row>()
  for (const r of rows) {
    if (r.phone) byPhone.set(dig9(r.phone), r)
    if (r.email) byEmail.set(r.email.toLowerCase().trim(), r)
  }

  const patches = new Map<number, Patch>()
  const errors: string[] = []

  // --- WhatsApp, both lines ---
  for (const panel of ['305', '718'] as const) {
    try {
      const chats = [...(await getChats(panel, 1)), ...(await getChats(panel, 2))]
      for (const c of chats) {
        if (c.is_group || !c.phone) continue
        const r = byPhone.get(dig9(c.phone))
        if (!r) continue
        if (c.unattended) {
          let text = ''
          try { const msgs = await getMessages(c.id); const lastIn = [...msgs].reverse().find((m) => !m.from_me); text = (lastIn?.text || '[media]').slice(0, 400) } catch { /* rate-limited; flag still flips */ }
          patches.set(r.source_row, { awaiting_us: true, last_from: 'them', last_reply_text: text, last_reply_at: c.last_message_timestamp || nowIso, verified_at: nowIso })
        } else if (r.awaiting_us) {
          // We replied — clear it so it can alert again on the next inbound.
          patches.set(r.source_row, { awaiting_us: false, last_from: 'us', verified_at: nowIso })
        }
      }
    } catch (e) { errors.push(`wa_${panel}: ${(e as Error).message.slice(0, 80)}`) }
  }

  // --- Email (last 2 days, capped) ---
  try {
    const recent = await listRecent('me', 2)
    for (const m of recent.slice(0, 40)) {
      try {
        const msg = await getMessage(m.id)
        const from = parseFromHeader(msg.headers['from'])
        const r = byEmail.get(from.address)
        if (!r) continue // not one of our contacts → ignore
        const existing = patches.get(r.source_row)
        // WhatsApp signal (more recent thread) wins if already set this run.
        if (existing && existing.last_from === 'them') continue
        patches.set(r.source_row, { awaiting_us: true, last_from: 'them', last_reply_text: (msg.headers['subject'] ? msg.headers['subject'] + ' — ' : '') + (msg.snippet || '').slice(0, 300), last_reply_at: msg.receivedAt, verified_at: nowIso })
      } catch { /* skip one bad message */ }
    }
  } catch (e) { errors.push(`email: ${(e as Error).message.slice(0, 80)}`) }

  // --- Write patches + decide what's NEW since the last alert ---
  const newlyAwaiting: { row: number; name: string }[] = []
  for (const [source_row, p] of patches) {
    await supabase.from('roster').update(p).eq('source_row', source_row)
    if (!p.awaiting_us) continue
    const r = rows.find((x) => x.source_row === source_row)!
    const replyAt = p.last_reply_at || nowIso
    const isNew = !r.alerted_at || (replyAt > r.alerted_at)
    if (isNew) newlyAwaiting.push({ row: source_row, name: r.name })
  }

  // --- Small alert: only when something new came in ---
  let alerted = 0
  if (newlyAwaiting.length > 0) {
    const names = newlyAwaiting.map((n) => n.name).slice(0, 6)
    const more = newlyAwaiting.length > 6 ? ` +${newlyAwaiting.length - 6} more` : ''
    const text = `🔔 ${newlyAwaiting.length} to respond to: ${names.join(', ')}${more}\nOpen the Command Center → Inbox.`
    try {
      await sendChatMessage(ALERT_CHAT_ID, text)
      // Stamp so we don't re-alert the same inbound next hour.
      for (const n of newlyAwaiting) await supabase.from('roster').update({ alerted_at: nowIso }).eq('source_row', n.row)
      alerted = newlyAwaiting.length
    } catch (e) { errors.push(`alert: ${(e as Error).message.slice(0, 80)}`) }
  }

  return NextResponse.json({ checked: rows.length, updated: patches.size, awaitingNew: newlyAwaiting.length, alerted, errors })
}
