import { NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/timelines/normalize-phone'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'
const DEFAULT_TAG_COLOR = '#FFCC33'
const DEFAULT_PANEL = '305'

interface BulkResult {
  processed: number
  tagged: number
  created: number
  errors: string[]
}

function parseCsvRow(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields.map((f) => f.trim())
}

const PHONE_HEADER_KEYS = new Set([
  'phone',
  'phone number',
  'phone_number',
  'number',
])
const TAG_HEADER_KEYS = new Set(['tag', 'tags', 'label'])

function normalizeHeader(h: string): string {
  return h.replace(/^ï»¿/, '').trim().toLowerCase()
}

function parseCsv(text: string): {
  rows: { phone: string; tag: string }[]
  headers: string[]
  firstRowSample: string[] | null
} {
  const stripped = text.replace(/^ï»¿/, '')
  const lines = stripped.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length === 0) return { rows: [], headers: [], firstRowSample: null }
  const headers = parseCsvRow(lines[0]).map((h) => h.replace(/^ï»¿/, '').trim())
  const phoneIdx = headers.findIndex((h) => PHONE_HEADER_KEYS.has(normalizeHeader(h)))
  const tagIdx = headers.findIndex((h) => TAG_HEADER_KEYS.has(normalizeHeader(h)))
  if (phoneIdx === -1 || tagIdx === -1) {
    return { rows: [], headers, firstRowSample: null }
  }
  const out: { phone: string; tag: string }[] = []
  let firstRowSample: string[] | null = null
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i])
    if (firstRowSample === null) firstRowSample = cells
    const phone = cells[phoneIdx] ?? ''
    const tag = cells[tagIdx] ?? ''
    if (!phone && !tag) continue
    out.push({ phone, tag })
  }
  return { rows: out, headers, firstRowSample }
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
  const parsed = parseCsv(text)
  console.log('[bulk-upload] parsed', {
    headers: parsed.headers,
    rowCount: parsed.rows.length,
    firstRowSample: parsed.firstRowSample,
  })
  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        error: 'no_rows',
        message:
          'CSV needs a phone column (phone / phone number / number) and a tag column (tag / tags / label) with at least one data row.',
        parsed_headers: parsed.headers,
        raw_preview: text.slice(0, 200),
      },
      { status: 400 }
    )
  }
  const rows = parsed.rows

  const service = createServiceClient()
  const result: BulkResult = { processed: 0, tagged: 0, created: 0, errors: [] }

  const tagCache = new Map<string, string>()
  const ensureTag = async (rawName: string): Promise<string | null> => {
    const name = rawName.trim()
    if (!name) return null
    const key = name.toLowerCase()
    if (tagCache.has(key)) return tagCache.get(key)!

    const { data: existing, error: lookupErr } = await service
      .from('tags')
      .select('id, name')
      .ilike('name', name)
      .limit(1)
      .maybeSingle()
    if (lookupErr) {
      result.errors.push(`tag lookup "${name}": ${lookupErr.message}`)
      return null
    }
    if (existing?.id) {
      tagCache.set(key, existing.id)
      return existing.id
    }

    const { data: created, error: insertErr } = await service
      .from('tags')
      .insert({ name, color: DEFAULT_TAG_COLOR })
      .select('id')
      .single()
    if (insertErr || !created?.id) {
      result.errors.push(`tag create "${name}": ${insertErr?.message ?? 'unknown error'}`)
      return null
    }
    tagCache.set(key, created.id)
    return created.id
  }

  for (let i = 0; i < rows.length; i++) {
    const { phone: rawPhone, tag: rawTag } = rows[i]
    result.processed++
    const lineNo = i + 2

    const phone = normalizePhone(rawPhone)
    if (!phone) {
      result.errors.push(`row ${lineNo}: invalid phone "${rawPhone}"`)
      continue
    }
    if (!rawTag.trim()) {
      result.errors.push(`row ${lineNo}: missing tag for ${phone}`)
      continue
    }

    const tagId = await ensureTag(rawTag)
    if (!tagId) continue

    const { data: threads, error: threadErr } = await service
      .from('whatsapp_threads')
      .select('id, panel')
      .eq('phone', phone)
    if (threadErr) {
      result.errors.push(`row ${lineNo}: thread lookup ${phone}: ${threadErr.message}`)
      continue
    }

    let threadId: string | null = null
    if (threads && threads.length > 0) {
      threadId = threads[0].id as string
    } else {
      const { data: createdThread, error: createErr } = await service
        .from('whatsapp_threads')
        .insert({
          panel: DEFAULT_PANEL,
          phone,
          channel_type: 'whatsapp',
          contact_name: null,
          is_group: false,
        })
        .select('id')
        .single()
      if (createErr || !createdThread?.id) {
        result.errors.push(
          `row ${lineNo}: thread create ${phone}: ${createErr?.message ?? 'unknown'}`
        )
        continue
      }
      threadId = createdThread.id as string
      result.created++
    }

    const { error: tagJoinErr } = await service
      .from('thread_tags')
      .upsert(
        { thread_id: threadId, tag_id: tagId },
        { onConflict: 'thread_id,tag_id', ignoreDuplicates: true }
      )
    if (tagJoinErr) {
      result.errors.push(`row ${lineNo}: tag attach ${phone}: ${tagJoinErr.message}`)
      continue
    }
    result.tagged++
  }

  return NextResponse.json(result)
}
