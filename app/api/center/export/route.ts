import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { centerAuthed } from '@/lib/center/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// On-demand CSV export of the whole board — one row per roster contact, always
// current. The server's GOOGLE_REFRESH_TOKEN has no Sheets write scope, so a
// cron cannot push into the existing Google Sheet directly. Until that token is
// re-authed with Sheets scope, THIS export (plus the live board) is the
// always-current source of truth: download it any time and it reflects the
// database as of that second.
//
// Columns: Name, Channel, Status, Phone, Email, Last update, Full conversation.
// "Full conversation" comes from the roster's thread_json (a JSON array of
// { who, date, text } kept current by the WhatsApp webhook) and always begins
// with "Terminal invitation sent".

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  sent: 'Sent, no reply yet',
  opened: 'Opened the invite',
  replied: 'Replied — needs you',
  booked: 'Booked',
  confirmed: 'Booked',
  declined: 'Declined',
  send_failed: 'Send failed',
  unknown: '',
}

// CSV field escaping: wrap in quotes, double any inner quotes. Handles commas,
// newlines, and Hebrew/Spanish text safely.
const csv = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return '"' + s.replace(/"/g, '""') + '"'
}

type RosterRow = {
  name: string | null
  phone: string | null
  email: string | null
  board_stage: string | null
  awaiting_us: boolean | null
  thread_json: string | null
}

type ThreadMsg = { who: string; date: string; text: string }

export async function GET(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const supabase = createServiceClient()

    const { data: roster, error } = await supabase
      .from('roster')
      .select('name, phone, email, board_stage, awaiting_us, thread_json')
      .order('source_row', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const rows = (roster || []) as RosterRow[]

    const lines = ['Name,Channel,Status,Phone,Email,Last update,Full conversation']
    for (const r of rows) {
      // Conversation: parse thread_json, always lead with the invitation line.
      let thread: ThreadMsg[] = []
      try { thread = r.thread_json ? (JSON.parse(r.thread_json) as ThreadMsg[]) : [] } catch { thread = [] }
      const convoParts = ['Terminal invitation sent']
      let lastUpdate = ''
      for (const m of thread) {
        const who = m.who === 'us' ? 'Us' : 'Them'
        const text = (m.text || '').trim() || '[media]'
        convoParts.push(`${m.date ? m.date + ' ' : ''}${who}: ${text}`)
        if (m.date) lastUpdate = m.date
      }
      const convo = convoParts.join('\n')

      const stage = (r.board_stage || '').toLowerCase()
      const status = STATUS_LABEL[stage] !== undefined
        ? STATUS_LABEL[stage]
        : (r.awaiting_us ? 'Waiting on you to reply' : (r.board_stage || ''))

      // Channel: how we reach them. Phone → WhatsApp, else Email.
      const channel = r.phone ? 'WhatsApp' : (r.email ? 'Email' : '')

      lines.push([
        csv(r.name || ''),
        csv(channel),
        csv(status),
        csv(r.phone || ''),
        csv(r.email || ''),
        csv(lastUpdate),
        csv(convo),
      ].join(','))
    }

    // BOM so Excel opens Hebrew/Spanish UTF-8 cleanly.
    const body = '﻿' + lines.join('\r\n')
    const stamp = new Date().toISOString().slice(0, 10)
    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="terminal-board-${stamp}.csv"`,
        'cache-control': 'no-store',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 })
  }
}
