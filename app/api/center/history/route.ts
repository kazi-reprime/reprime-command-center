import { NextResponse } from 'next/server'
import { centerAuthed } from '@/lib/center/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getMessages } from '@/lib/timelines/client'
import { esCached } from '@/lib/center/tr-cache'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// The thread, from OUR live store. Every WhatsApp message is pushed into
// whatsapp_messages by the Timelines webhook (always current, media included),
// so we read it from there — fast, complete, no rate-limit — instead of
// polling Timelines. Falls back to a live Timelines/Gmail pull only if a
// person has nothing stored yet. Hebrew gets es/en for the secretary.
const dig = (s: string) => (s || '').replace(/\D/g, '')
const isHe = (s: string) => /[֐-׿]/.test(s || '')
const fmtDate = (ts: string | number | undefined) => { if (!ts) return ''; const d = new Date(ts); return isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(d) }

type Msg = { who: string; date: string; text: string; ts: number; via?: 'wa' | 'email'; audio?: string }

async function storeThread(phone: string): Promise<Msg[]> {
  const supabase = createServiceClient()
  const last7 = dig(phone).slice(-7)
  if (!last7) return []
  const { data: threads } = await supabase.from('whatsapp_threads').select('id, phone').ilike('phone', `%${last7}%`)
  const ids = (threads || []).map((t: { id: number }) => t.id)
  if (!ids.length) return []
  const { data: msgs } = await supabase.from('whatsapp_messages')
    .select('direction, body, media_type, media_url, sent_at').in('thread_id', ids)
    .order('sent_at', { ascending: false }).limit(60)
  const rows = (msgs || []) as Array<{ direction: string; body: string | null; media_type: string | null; media_url: string | null; sent_at: string }>
  return rows.map((m) => {
    const isAudio = m.media_type === 'audio'
    const text = (m.body && m.body.trim()) ? m.body.slice(0, 500) : (isAudio ? '🎤' : (m.media_type ? '📎 ' + m.media_type : '📎 media'))
    // Only surface a player for a DURABLE stored copy — never the expired temp link.
    const audio = (isAudio && m.media_url && m.media_url.includes('/storage/')) ? m.media_url : undefined
    return { who: m.direction === 'out' ? 'us' : 'them', date: fmtDate(m.sent_at), text, ts: new Date(m.sent_at).getTime() || 0, via: 'wa' as const, audio }
  })
}

// Merge two message lists (store + live), dedupe by who+text, sort oldest→newest.
function merge(a: Msg[], b: Msg[]): Msg[] {
  const seen = new Set<string>(); const out: Msg[] = []
  for (const m of [...a, ...b]) {
    const k = m.who + '|' + m.text.replace(/\s+/g, ' ').trim().slice(0, 40)
    if (seen.has(k)) continue
    seen.add(k); out.push(m)
  }
  return out.sort((x, y) => x.ts - y.ts)
}

async function waThreadLive(phone: string): Promise<Msg[]> {
  const TL = process.env.TIMELINES_API_KEY
  if (!TL) return []
  for (const acct of ['+13057784861', '+17185505500']) {
    try {
      const r = await fetch(`https://app.timelines.ai/integrations/api/chats?phone=${encodeURIComponent(phone)}&whatsapp_account_phone=${encodeURIComponent(acct)}`, { headers: { Authorization: 'Bearer ' + TL }, cache: 'no-store' })
      if (!r.ok) continue
      const j = await r.json()
      const chats = (j.data && j.data.chats) || []
      const chat = chats.find((c: { phone?: string; is_group?: boolean }) => !c.is_group && dig(c.phone || '').endsWith(dig(phone).slice(-9))) || chats[0]
      if (!chat) continue
      const msgs = await getMessages(chat.id)
      if (!msgs.length) continue
      // Timelines returns messages NEWEST-FIRST — take the newest 60, not the oldest.
      return msgs.slice(0, 60).map((m) => { const tsv = (m as { timestamp?: string }).timestamp; return { who: m.from_me ? 'us' : 'them', date: fmtDate(tsv), text: (m.text && m.text.trim()) ? m.text.slice(0, 500) : '📎 media', ts: new Date(tsv || 0).getTime() || 0, via: 'wa' as const } })
    } catch { /* next */ }
  }
  return []
}

async function emailThread(email: string): Promise<Msg[]> {
  try {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET)
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
    const gmail = google.gmail({ version: 'v1', auth })
    // Targeted search for just this person (fast) — not a full-inbox scan.
    const list = await gmail.users.messages.list({ userId: 'me', q: `from:${email} OR to:${email}`, maxResults: 8 })
    const ids = (list.data.messages || []).map((m) => m.id || '').filter(Boolean)
    const out: Msg[] = []
    for (const id of ids) {
      try {
        const m = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'Subject'] })
        const h: Record<string, string> = {}
        for (const x of (m.data.payload?.headers || [])) h[(x.name || '').toLowerCase()] = x.value || ''
        const ts = Number(m.data.internalDate) || 0
        const them = (h.from || '').toLowerCase().includes(email.toLowerCase())
        out.push({ who: them ? 'them' : 'us', date: fmtDate(ts), text: ((h.subject ? h.subject + ' — ' : '') + (m.data.snippet || '')).slice(0, 400), ts, via: 'email' as const })
      } catch { /* skip */ }
    }
    out.sort((a, b) => a.ts - b.ts)
    return out
  } catch { return [] }
}

// Repair any es value that came back empty or still in Hebrew via the SHARED
// translation cache — so the open thread uses the exact same Spanish the board
// shows, and each line is translated at most once across the whole system.
async function forceSpanish(_key: string, lines: string[]): Promise<string[]> {
  return esCached(lines)
}

async function translateChain(chain: Msg[]) {
  // ONLY Hebrew gets translated to Spanish for the secretary. English (and media
  // markers / URLs) pass through untouched so she reads + replies directly in the
  // language that came in — the Hebrew↔Spanish loop exists only because she can't
  // read Hebrew. Mirrors the board's Hebrew-only rule.
  const out = chain.map((c) => ({ ...c, he: isHe(c.text) ? c.text : '', es: isHe(c.text) ? '' : c.text, en: c.text }))
  const heIdx = out.map((c, i) => (isHe(c.text) ? i : -1)).filter((i) => i >= 0)
  if (!heIdx.length) return out
  const es = await forceSpanish('history', heIdx.map((i) => chain[i].text))
  heIdx.forEach((i, k) => { out[i].es = es[k] || chain[i].text })
  return out
}

export async function GET(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const url = new URL(request.url)
  const phone = url.searchParams.get('phone') || ''
  const email = url.searchParams.get('email') || ''

  // Pull BOTH channels and weave them into one time-ordered thread. For a
  // both-channel person you see WhatsApp AND email interleaved, each tagged.
  const parts: Msg[] = []
  let source = 'none'
  if (phone) {
    const [store, live] = await Promise.all([storeThread(phone), waThreadLive(phone)])
    const wa = merge(store, live)
    if (wa.length) { parts.push(...wa); source = 'wa' }
  }
  if (email) {
    const em = await emailThread(email)
    if (em.length) { parts.push(...em); source = source === 'wa' ? 'wa+email' : 'email' }
  }
  const raw = merge(parts, []).slice(-40)
  if (!raw.length) return NextResponse.json({ found: false, chain: [], source })

  const chain = await translateChain(raw)
  // Every thread begins at the invitation — anything before it is irrelevant.
  chain.unshift({ who: 'us', date: '', text: 'Terminal invitation sent', ts: 0, he: '', es: 'Invitación Terminal enviada', en: 'Terminal invitation sent' })
  return NextResponse.json({ found: true, source, chain })
}
