/**
 * Contacts API — Unified contact search across all sources
 *
 * GET /api/contacts?q=search_term&limit=20
 *
 * Aggregates contacts from: Supabase, Pipedrive, WhatsApp, Gmail
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const limit = Math.min(50, Number(searchParams.get('limit')) || 20)

  const results: Array<{
    id: string
    name: string
    phone?: string
    email?: string
    source: string
    company?: string
  }> = []

  // Source 1: Supabase contacts table
  try {
    const supabase = createServiceClient()
    const query = supabase.from('contacts').select('id, name, phone, email, company').limit(limit)

    if (q) {
      query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company.ilike.%${q}%`)
    }

    const { data } = await query

    if (data) {
      for (const c of data) {
        results.push({
          id: c.id,
          name: c.name || 'Unknown',
          phone: c.phone,
          email: c.email,
          company: c.company,
          source: 'supabase',
        })
      }
    }
  } catch (err) {
    console.warn('[contacts] Supabase query failed:', (err as Error).message)
  }

  // Source 2: Pipedrive (if search query provided)
  if (q && q.length >= 2) {
    try {
      const { searchPersons } = await import('@/lib/pipedrive/client')
      const pdResults = await searchPersons(q, Math.min(limit, 10))
      for (const person of pdResults) {
        // Deduplicate by phone/email
        const exists = results.some(r =>
          (r.phone && person.phones?.[0] && r.phone === person.phones[0]) ||
          (r.email && person.emails?.[0] && r.email === person.emails[0])
        )
        if (!exists) {
          results.push({
            id: `pd-${person.id}`,
            name: person.name,
            phone: person.phones?.[0],
            email: person.emails?.[0],
            source: 'pipedrive',
          })
        }
      }
    } catch {
      // Pipedrive search is best-effort
    }
  }

  return NextResponse.json({
    contacts: results.slice(0, limit),
    count: results.length,
    query: q || undefined,
  })
}
