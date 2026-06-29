import { NextResponse } from 'next/server'
import { centerAuthed } from '@/lib/center/auth'
import { createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Generate the contact record straight from the database (no transcription).
//   ?view=emails  → Name, Email  (each person's own canonical email only)
//   ?view=full    → Name, Email, Phone, WhatsApp Chat ID, Last Activity, Status
const dig9 = (s: string | null | undefined) => (s || '').replace(/\D/g, '').slice(-9)
const fmtDate = (iso: string | null) => { if (!iso) return ''; try { return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Chicago' }).format(new Date(iso)) } catch { return '' } }

export async function GET(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const view = new URL(request.url).searchParams.get('view') || 'emails'
  const supabase = createServiceClient()

  const { data } = await supabase.from('roster').select('source_row, name, phone, email, board_stage, last_reply_at, awaiting_us').order('source_row', { ascending: true })
  const rows = (data || []) as Array<{ source_row: number; name: string | null; phone: string | null; email: string | null; board_stage: string | null; last_reply_at: string | null; awaiting_us: boolean | null }>

  const aoa: (string | number)[][] = []
  if (view === 'full') {
    const { data: threads } = await supabase.from('whatsapp_threads').select('phone, timelines_chat_id').not('timelines_chat_id', 'is', null)
    const chatByL9 = new Map<string, number>()
    for (const t of (threads || []) as Array<{ phone: string | null; timelines_chat_id: number | null }>) {
      const k = dig9(t.phone); if (k && t.timelines_chat_id && !chatByL9.has(k)) chatByL9.set(k, t.timelines_chat_id)
    }
    aoa.push(['#', 'Name', 'Email', 'Phone', 'WhatsApp Chat ID', 'Last Activity', 'Status'])
    let i = 0
    for (const r of rows) {
      i++
      aoa.push([i, r.name || '', (r.email || '').trim(), r.phone || '', chatByL9.get(dig9(r.phone)) || '', fmtDate(r.last_reply_at), r.board_stage || ''])
    }
  } else {
    aoa.push(['#', 'Name', 'Email'])
    let i = 0
    for (const r of rows) { i++; aoa.push([i, r.name || '', (r.email || '').trim()]) }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = view === 'full'
    ? [{ wch: 4 }, { wch: 32 }, { wch: 36 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 12 }]
    : [{ wch: 4 }, { wch: 34 }, { wch: 38 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, view === 'full' ? 'Tracking' : 'Emails')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reprime-contacts-${view}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
