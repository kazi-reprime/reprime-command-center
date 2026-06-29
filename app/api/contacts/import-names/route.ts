import { NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/timelines/normalize-phone'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'

// ── CSV helpers ──────────────────────────────────────────────────────────────

function parseCsvRow(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields.map((f) => f.trim())
}

const PHONE_KEYS = new Set(['phone', 'phone number', 'phone_number', 'number', 'mobile', 'cell', 'whatsapp'])
const NAME_KEYS  = new Set(['name', 'contact name', 'contact_name', 'full name', 'full_name', 'display name', 'display_name'])

function normalizeHeader(h: string): string {
  return h.replace(/^﻿/, '').trim().toLowerCase()
}

interface ParsedRow { phone: string; name: string }

function parseCsv(text: string): { rows: ParsedRow[]; headers: string[] } {
  const stripped = text.replace(/^﻿/, '')
  const lines = stripped.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { rows: [], headers: [] }

  const rawHeaders = parseCsvRow(lines[0])
  const headers = rawHeaders.map(normalizeHeader)

  let phoneIdx = headers.findIndex((h) => PHONE_KEYS.has(h))
  let nameIdx  = headers.findIndex((h) => NAME_KEYS.has(h))

  // Fallback: if no named header row, try positional (col0=phone, col1=name)
  const startLine = (phoneIdx !== -1 || nameIdx !== -1) ? 1 : 0
  if (startLine === 0) {
    phoneIdx = 0
    nameIdx  = 1
  }

  const rows: ParsedRow[] = []
  for (let i = startLine; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i])
    const phone = cells[phoneIdx] ?? ''
    const name  = cells[nameIdx]  ?? ''
    if (!phone && !name) continue
    rows.push({ phone, name })
  }
  return { rows, headers: rawHeaders }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_form_data' }, { status: 400 })
  }

  const file = formData.get('csv')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'csv file required' }, { status: 400 })
  }

  const text = await file.text()
  const { rows, headers } = parseCsv(text)

  if (rows.length === 0) {
    return NextResponse.json(
      {
        error: 'no_rows',
        message: 'No usable rows found. CSV needs a phone column and a name column.',
        detected_headers: headers,
        raw_preview: text.slice(0, 300),
      },
      { status: 400 }
    )
  }

  const service = createServiceClient()
  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const { phone: rawPhone, name: rawName } = rows[i]
    const lineNo = i + 2
    const name = rawName.trim()
    if (!name) { skipped++; continue }

    const phone = normalizePhone(rawPhone)
    if (!phone) {
      errors.push(`row ${lineNo}: invalid phone "${rawPhone}"`)
      skipped++
      continue
    }

    const { error: updateErr, count } = await service
      .from('whatsapp_threads')
      .update({ contact_name: name })
      .eq('phone', phone)
      .select('id')

    if (updateErr) {
      errors.push(`row ${lineNo}: ${phone} — ${updateErr.message}`)
    } else {
      // count might be null when PostgREST doesn't return it; treat any non-error as success
      const n = typeof count === 'number' ? count : 1
      if (n > 0) updated++
      else skipped++ // phone not in DB yet
    }
  }

  console.log('[import-names]', { total: rows.length, updated, skipped, errors: errors.length })

  return NextResponse.json({
    total: rows.length,
    updated,
    skipped,
    errors: errors.slice(0, 20), // cap at 20 for response size
  })
}
