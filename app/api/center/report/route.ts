import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { centerAuthed } from '@/lib/center/auth'
import { sendChatMessage } from '@/lib/timelines/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// On-demand report. GET → returns the plain-English status text. POST {send:true}
// → also pushes it to the "Terminal invitations" WhatsApp group.
const dig9 = (s: string) => (s || '').replace(/\D/g, '').slice(-9)
const ALERT_CHAT_ID = Number(process.env.CENTER_ALERT_CHAT_ID || '56184407')

async function buildReport(): Promise<string> {
  const supabase = createServiceClient()
  const { data: roster } = await supabase.from('roster').select('name, phone, email, board_stage, awaiting_us, remind_at')
  const rows = (roster || []) as Array<{ name: string; phone: string | null; email: string | null; board_stage: string; awaiting_us: boolean | null; remind_at: string | null }>

  // engagement from invitations
  const bookedKeys = new Set<string>(); const openedKeys = new Set<string>(); const watchedKeys = new Set<string>()
  for (let from = 0; from < 50000; from += 1000) {
    const { data } = await supabase.from('invitations').select('contact_phone, contact_email, status, confirmed_slot_iso, view_count, first_opened_at, first_video_at').range(from, from + 999)
    const inv = (data || []) as Array<{ contact_phone: string | null; contact_email: string | null; status: string | null; confirmed_slot_iso: string | null; view_count: number | null; first_opened_at: string | null; first_video_at: string | null }>
    for (const r of inv) {
      const ks: string[] = []
      if (r.contact_phone) ks.push('p:' + dig9(r.contact_phone))
      if (r.contact_email) ks.push('e:' + r.contact_email.toLowerCase().trim())
      const booked = r.status === 'confirmed' || !!r.confirmed_slot_iso
      const opened = (r.view_count ?? 0) > 0 || !!r.first_opened_at
      const watched = !!r.first_video_at
      for (const k of ks) { if (booked) bookedKeys.add(k); if (opened) openedKeys.add(k); if (watched) watchedKeys.add(k) }
    }
    if (inv.length < 1000) break
  }
  const keyHit = (set: Set<string>, r: { phone: string | null; email: string | null }) =>
    (r.phone && set.has('p:' + dig9(r.phone))) || (r.email && set.has('e:' + r.email.toLowerCase().trim()))

  const now = Date.now()
  const awaiting = rows.filter((r) => r.awaiting_us === true && !(r.remind_at && new Date(r.remind_at).getTime() > now))
  const booked = rows.filter((r) => r.board_stage === 'booked' || keyHit(bookedKeys, r))
  const opened = rows.filter((r) => keyHit(openedKeys, r))
  const watched = rows.filter((r) => keyHit(watchedKeys, r))
  const noReply = rows.filter((r) => r.board_stage === 'sent')

  const names = (arr: typeof rows, n = 8) => arr.slice(0, n).map((r) => r.name).join(', ') + (arr.length > n ? ` +${arr.length - n} more` : '')
  const d = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  return [
    `TERMINAL — status, ${d} CT`,
    ``,
    `${rows.length} people in play`,
    `${booked.length} booked${booked.length ? ': ' + names(booked) : ''}`,
    `${awaiting.length} waiting on you to reply${awaiting.length ? ': ' + names(awaiting) : ''}`,
    `${noReply.length} sent, no reply yet`,
    `${opened.length} opened the invite · ${watched.length} watched the video`,
  ].join('\n')
}

export async function GET(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try { return NextResponse.json({ text: await buildReport() }) }
  catch (e) { return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 }) }
}

export async function POST(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const text = await buildReport()
    let sent = false
    try { await sendChatMessage(ALERT_CHAT_ID, '📊 ' + text); sent = true } catch { /* report still returns */ }
    return NextResponse.json({ text, sent })
  } catch (e) { return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 }) }
}
