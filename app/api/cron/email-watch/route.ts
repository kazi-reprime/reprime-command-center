import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { listRecent, getMessage, parseFromHeader } from '@/lib/google/gmail'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Lean EMAIL watcher — runs every 2 min (vercel.json). Reads the most recent
// mail in g@reprime.com, matches senders to the roster, and flips the contact
// board to "awaiting you" the moment an investor replies by email. Writing the
// roster row triggers Supabase Realtime, so the board rings + surfaces it
// instantly. Decoupled from the (currently failing) Timelines getChats so the
// WhatsApp issue can't take email down. WhatsApp itself is handled in real time
// by /api/whatsapp/webhook.

export async function GET() {
  const supabase = createServiceClient()
  const nowIso = new Date().toISOString()

  const { data: roster, error } = await supabase
    .from('roster')
    .select('source_row, email, board_stage, last_reply_at, thread_json')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type RC = { source_row: number; board_stage: string | null; last_reply_at: string | null; thread_json: string | null }
  const byEmail = new Map<string, RC>()
  for (const r of (roster || []) as Array<RC & { email: string | null }>) {
    if (r.email) byEmail.set(r.email.toLowerCase().trim(), r)
  }

  // Append an email to the board thread so the secretary sees BOTH sides — she
  // doesn't have Gideon's phone, so any reply HE sends from his own inbox must
  // surface here too, not just inbound. Returns the new thread_json string.
  const fmtDate = (iso: string) => { try { return new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(iso)) } catch { return '' } }
  const pushThread = (tj: string | null, who: string, text: string, at: string): string => {
    let arr: Array<{ who: string; date: string; text: string; via?: string }> = []
    try { arr = tj ? JSON.parse(tj) : [] } catch { arr = [] }
    arr.push({ who, date: fmtDate(at), text: text.slice(0, 400), via: 'email' })
    if (arr.length > 40) arr = arr.slice(-40)
    return JSON.stringify(arr)
  }

  // Our own sending addresses — an email FROM one of these to a contact is an
  // OUTBOUND reply (clears "awaiting you"), not an inbound one.
  const OURS = new Set(['g@reprime.com', 'g@floridastatetrust.com', 'g@reprime-terminal.com'])

  let matched = 0
  const errors: string[] = []
  try {
    const recent = await listRecent('me', 2) // g@reprime.com (GOOGLE_REFRESH_TOKEN), last 2 days
    for (const m of recent.slice(0, 60)) {
      try {
        const msg = await getMessage(m.id)
        const fromAddr = (parseFromHeader(msg.headers['from']).address || '').toLowerCase().trim()
        const at: string = msg.receivedAt || nowIso
        const text = ((msg.headers['subject'] ? msg.headers['subject'] + ' — ' : '') + (msg.snippet || '')).slice(0, 500)
        // OUTBOUND (we emailed a contact) → show it on the board (so she sees the
        // reply Gideon sent from his own inbox) + clear "awaiting you".
        if (OURS.has(fromAddr)) {
          const toAddr = (parseFromHeader(msg.headers['to']).address || '').toLowerCase().trim()
          const rc = byEmail.get(toAddr)
          if (rc && (!rc.last_reply_at || at > rc.last_reply_at)) {
            await supabase.from('roster').update({ awaiting_us: false, last_from: 'us', last_reply_text: text, last_reply_at: at, thread_json: pushThread(rc.thread_json, 'us', text, at), updated_at: nowIso }).eq('source_row', rc.source_row)
            rc.last_reply_at = at; rc.thread_json = pushThread(rc.thread_json, 'us', text, at); matched++
          }
          continue
        }
        // INBOUND (a contact emailed us) → flag awaiting you + show the reply.
        const r = byEmail.get(fromAddr)
        if (!r) continue
        if (r.last_reply_at && at <= r.last_reply_at) continue
        const upd: Record<string, unknown> = {
          awaiting_us: true,
          last_from: 'them',
          last_reply_text: text,
          last_reply_at: at,
          thread_json: pushThread(r.thread_json, 'them', text, at),
          updated_at: nowIso,
        }
        if (r.board_stage !== 'booked' && r.board_stage !== 'declined') upd.board_stage = 'replied'
        await supabase.from('roster').update(upd).eq('source_row', r.source_row)
        r.last_reply_at = at; r.thread_json = upd.thread_json as string; matched++
      } catch (e) { errors.push(`msg: ${(e as Error).message.slice(0, 60)}`) }
    }
  } catch (e) { errors.push(`list: ${(e as Error).message.slice(0, 80)}`) }

  return NextResponse.json({ ok: true, matched, errors })
}
