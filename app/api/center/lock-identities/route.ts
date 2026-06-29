import { NextResponse } from 'next/server'
import { centerAuthed } from '@/lib/center/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getChats, PANEL_ACCOUNT_MAP } from '@/lib/timelines/client'
import type { Panel } from '@/lib/timelines/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ONE-TIME (re-runnable) IDENTITY LOCK. Pulls the full WhatsApp chat list per
// line and binds each of the ~206 roster contacts to their EXACT Timelines chat
// id, stored on their thread. After this, every reconcile/track keys off a known
// chat — deterministic — instead of guessing by phone match at read time. Paged
// + paced so it stays under the Timelines rate limit; re-run to fill any pages
// that errored.

const l9 = (s: string | null | undefined) => (s || '').replace(/\D/g, '').slice(-9)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Roster contacts to wire (have a phone).
  const { data: roster } = await service.from('roster').select('source_row, name, phone').not('phone', 'is', null)
  const wantByL9 = new Map<string, { source_row: number; name: string | null; phone: string }>()
  for (const r of (roster || []) as Array<{ source_row: number; name: string | null; phone: string }>) {
    const k = l9(r.phone); if (k) wantByL9.set(k, { source_row: r.source_row, name: r.name, phone: r.phone })
  }

  // Existing threads (to UPDATE in place rather than create duplicates).
  const { data: threads } = await service.from('whatsapp_threads').select('id, phone, timelines_chat_id').eq('channel_type', 'whatsapp')
  const threadByL9 = new Map<string, { id: string; timelines_chat_id: number | null }>()
  for (const t of (threads || []) as Array<{ id: string; phone: string | null; timelines_chat_id: number | null }>) {
    const k = l9(t.phone); if (k && !threadByL9.has(k)) threadByL9.set(k, { id: t.id, timelines_chat_id: t.timelines_chat_id })
  }

  // Collect chat ids per phone from BOTH lines (keep the most-recent chat per phone).
  const found = new Map<string, { id: number; ts: number; panel: Panel }>()
  const pages: Record<string, number> = {}
  const errs: string[] = []
  for (const panel of ['305', '718'] as Panel[]) {
    pages[panel] = 0
    for (let page = 1; page <= 13; page++) {
      let batch
      try { batch = await getChats(panel, page) } catch (e) { errs.push(`${panel} p${page}: ${(e as Error).message.slice(0, 50)}`); break }
      pages[panel] = page
      for (const c of batch) {
        if (c.is_group) continue
        const k = l9(c.phone); if (!k) continue
        const ts = c.last_message_timestamp ? new Date(c.last_message_timestamp).getTime() || 0 : 0
        const cur = found.get(k)
        if (!cur || ts > cur.ts) found.set(k, { id: c.id, ts, panel })
      }
      if (batch.length < 50) break
      await sleep(1200) // pace under the rate limit
    }
  }

  // Bind each matched roster contact to its chat id.
  let locked = 0, created = 0
  const unmatched: string[] = []
  for (const [k, want] of wantByL9) {
    const hit = found.get(k)
    if (!hit) { unmatched.push(want.name || want.phone); continue }
    const th = threadByL9.get(k)
    try {
      if (th) {
        await service.from('whatsapp_threads').update({ timelines_chat_id: hit.id, panel: hit.panel }).eq('id', th.id)
      } else {
        await service.from('whatsapp_threads').insert({ panel: hit.panel, channel_type: 'whatsapp', phone: want.phone, contact_name: want.name, is_group: false, timelines_chat_id: hit.id })
        created++
      }
      locked++
    } catch (e) { errs.push(`bind ${want.phone}: ${(e as Error).message.slice(0, 40)}`) }
  }

  return NextResponse.json({
    ok: true, roster: wantByL9.size, chatsFound: found.size,
    locked, created, stillUnmatched: unmatched.length,
    pages, errors: errs.slice(0, 10),
  })
}
