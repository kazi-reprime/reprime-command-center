import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { centerAuthed, parseLine } from '@/lib/center/auth'

export const dynamic = 'force-dynamic'

const dig9 = (s: string) => (s || '').replace(/\D/g, '').slice(-9)

// POST { text } -> per-line dedup against the invitations table (the memory).
// Returns each candidate with status 'new' | 'already', and match details so
// the UI can highlight repeats in red.
export async function POST(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let text = ''
  try { text = ((await request.json()) as { text?: string }).text || '' } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const candidates = text.split(/\r?\n/).map(parseLine).filter(Boolean) as Array<{ name: string; phone: string; email: string }>
  if (!candidates.length) return NextResponse.json({ candidates: [] })

  const supabase = createServiceClient()
  // Page through ALL invitations with select('*') so a missing/renamed column
  // can never error the whole query (which would empty the dedup). PostgREST
  // caps a single read at 1000 rows, so we range-paginate.
  type Row = Record<string, unknown> & { contact_name?: string | null; contact_first_name?: string | null; contact_email?: string | null; contact_phone?: string | null; status?: string; created_at?: string | null; confirmed_slot_iso?: string | null }
  const existing: Row[] = []
  let dbError: string | null = null
  const PAGE = 1000
  for (let from = 0; from < 50000; from += PAGE) {
    const { data: page, error } = await supabase.from('invitations').select('*').range(from, from + PAGE - 1)
    if (error) { dbError = error.message; break }
    const rows = (page || []) as Row[]
    existing.push(...rows)
    if (rows.length < PAGE) break
  }

  const byPhone = new Map<string, typeof existing[number]>()
  const byEmail = new Map<string, typeof existing[number]>()
  const byName = new Map<string, typeof existing[number]>()
  for (const r of existing) {
    if (r.contact_phone) byPhone.set(dig9(r.contact_phone), r)
    if (r.contact_email) byEmail.set(r.contact_email.toLowerCase().trim(), r)
    const nm = (r.contact_name || r.contact_first_name || '').toLowerCase().trim()
    if (nm) byName.set(nm, r)
  }

  const out = candidates.map((c) => {
    const m =
      (c.phone && byPhone.get(dig9(c.phone))) ||
      (c.email && byEmail.get(c.email.toLowerCase().trim())) ||
      (c.name && byName.get(c.name.toLowerCase().trim())) ||
      null
    if (m) {
      return {
        ...c,
        status: 'already' as const,
        match: {
          when: m.created_at || null,
          inviteStatus: m.status,            // sent | confirmed | queued | cancelled
          booked: !!m.confirmed_slot_iso,
        },
      }
    }
    return { ...c, status: 'new' as const, match: null }
  })

  return NextResponse.json({
    candidates: out,
    summary: { total: out.length, fresh: out.filter((o) => o.status === 'new').length, already: out.filter((o) => o.status === 'already').length },
    debug: { loaded: existing.length, dbError },
  })
}
