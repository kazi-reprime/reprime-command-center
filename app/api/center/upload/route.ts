import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { centerAuthed } from '@/lib/center/auth'

export const dynamic = 'force-dynamic'

// Excel / CSV upload ingest for the /outreach follow-through board.
// The UI parses the uploaded sheet into {name, phone, email} rows and POSTs
// them here. We normalize, dedup against the roster AND the invitations table,
// and insert only genuinely-new people as fresh roster rows (board_stage='sent').
// Returns which names were added and which were skipped (with the reason).

const dig9 = (s: string | null | undefined) => (s || '').replace(/\D/g, '').slice(-9)

// Normalize a phone: keep digits, preserve an explicit +972 / +1 country prefix
// when present. Mirrors the lenient shape produced by parseLine() in lib/center/auth.
function normPhone(raw: string | null | undefined): string {
  const s = (raw || '').trim()
  if (!s) return ''
  const hadPlus = s.trimStart().startsWith('+')
  const d = s.replace(/\D/g, '')
  if (d.length < 9) return ''
  if (d.startsWith('972')) return '+' + d
  if (d.startsWith('05') && d.length === 10) return '+972' + d.slice(1)
  if (d.startsWith('5') && d.length === 9) return '+972' + d
  if (d.startsWith('1') && d.length === 11) return '+' + d
  if (d.length === 10) return '+1' + d
  return hadPlus ? '+' + d : d
}

function normEmail(raw: string | null | undefined): string {
  return (raw || '').toLowerCase().trim()
}

type InRow = { name?: string; phone?: string; email?: string }

export async function POST(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { rows?: InRow[] }
  try {
    body = (await request.json()) as { rows?: InRow[] }
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const incoming = Array.isArray(body.rows) ? body.rows : []
  if (incoming.length === 0) {
    return NextResponse.json({ added: [], duplicates: [], total: 0 })
  }

  const supabase = createServiceClient()

  // ── Build dedup index from the existing roster ──────────────────────────────
  const rosterPhones = new Set<string>()
  const rosterEmails = new Set<string>()
  let maxRow = 0
  {
    const { data, error } = await supabase.from('roster').select('source_row, phone, email')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const rows = (data || []) as Array<{ source_row: number | null; phone: string | null; email: string | null }>
    for (const r of rows) {
      if (typeof r.source_row === 'number' && r.source_row > maxRow) maxRow = r.source_row
      const p9 = dig9(r.phone)
      if (p9) rosterPhones.add(p9)
      const e = normEmail(r.email)
      if (e) rosterEmails.add(e)
    }
  }

  // ── Add the invitations table to the dedup index (paged) ────────────────────
  const invitePhones = new Set<string>()
  const inviteEmails = new Set<string>()
  for (let from = 0; from < 50000; from += 1000) {
    const { data } = await supabase
      .from('invitations')
      .select('contact_phone, contact_email')
      .range(from, from + 999)
    const rows = (data || []) as Array<{ contact_phone: string | null; contact_email: string | null }>
    for (const r of rows) {
      const p9 = dig9(r.contact_phone)
      if (p9) invitePhones.add(p9)
      const e = normEmail(r.contact_email)
      if (e) inviteEmails.add(e)
    }
    if (rows.length < 1000) break
  }

  // ── Classify each incoming row ──────────────────────────────────────────────
  const added: string[] = []
  const duplicates: Array<{ name: string; reason: string }> = []
  // also dedup within the same upload batch
  const batchPhones = new Set<string>()
  const batchEmails = new Set<string>()

  type NewRow = { source_row: number; name: string; phone: string | null; email: string | null; board_stage: string; awaiting_us: boolean }
  const toInsert: NewRow[] = []

  for (const r of incoming) {
    const name = (r.name || '').replace(/\s+/g, ' ').trim()
    const phone = normPhone(r.phone)
    const email = normEmail(r.email)
    const p9 = dig9(phone)
    const label = name || phone || email || '(blank)'

    if (!name && !phone && !email) {
      duplicates.push({ name: label, reason: 'empty row' })
      continue
    }
    if (!phone && !email) {
      duplicates.push({ name: label, reason: 'no phone or email' })
      continue
    }

    if ((p9 && rosterPhones.has(p9)) || (email && rosterEmails.has(email))) {
      duplicates.push({ name: label, reason: 'already on the board' })
      continue
    }
    if ((p9 && invitePhones.has(p9)) || (email && inviteEmails.has(email))) {
      duplicates.push({ name: label, reason: 'already invited' })
      continue
    }
    if ((p9 && batchPhones.has(p9)) || (email && batchEmails.has(email))) {
      duplicates.push({ name: label, reason: 'duplicate in this upload' })
      continue
    }

    if (p9) batchPhones.add(p9)
    if (email) batchEmails.add(email)
    maxRow += 1
    toInsert.push({
      source_row: maxRow,
      name: name || label,
      phone: phone || null,
      email: email || null,
      board_stage: 'sent',
      awaiting_us: false,
    })
    added.push(name || label)
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('roster').insert(toInsert)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ added, duplicates, total: incoming.length })
}
