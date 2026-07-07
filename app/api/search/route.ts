import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/search?q=<query>
 *
 * Searches across WhatsApp messages, notes, contacts, and deals.
 * Returns results ranked by relevance (basic text matching).
 * Future: upgrade to pgvector semantic search when embeddings are populated.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [], query: query || '' })
    }

    const q = query.trim()
    const service = createServiceClient()

    // Run searches in parallel across multiple tables
    const [messagesResult, notesResult, threadsResult, dealsResult] = await Promise.all([
      // 1. WhatsApp messages (body text search)
      service
        .from('whatsapp_messages')
        .select('id, body, direction, from_name, sent_at, thread_id')
        .ilike('body', `%${q}%`)
        .order('sent_at', { ascending: false })
        .limit(10),

      // 2. Notes (title + body search)
      service
        .from('notes')
        .select('id, title, body, created_at')
        .or(`title.ilike.%${q}%,body.ilike.%${q}%`)
        .order('updated_at', { ascending: false })
        .limit(5),

      // 3. WhatsApp threads (contact name search)
      service
        .from('whatsapp_threads')
        .select('id, contact_name, phone, panel, channel_type, last_message_at, last_message_preview')
        .or(`contact_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(10),

      // 4. Deals (name + address search)
      service
        .from('deals')
        .select('id, name, address, status, created_at')
        .or(`name.ilike.%${q}%,address.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    type SearchResult = {
      id: string
      type: 'message' | 'note' | 'contact' | 'deal'
      source: string
      snippet: string
      date: string | null
      score: number
      meta?: Record<string, unknown>
    }

    const results: SearchResult[] = []

    // Map WhatsApp messages
    if (messagesResult.data) {
      for (const m of messagesResult.data) {
        const body = (m.body || '').toString()
        // Extract snippet around the match
        const lowerBody = body.toLowerCase()
        const idx = lowerBody.indexOf(q.toLowerCase())
        const start = Math.max(0, idx - 40)
        const end = Math.min(body.length, idx + q.length + 80)
        const snippet = (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '')

        results.push({
          id: m.id,
          type: 'message',
          source: 'WhatsApp',
          snippet,
          date: m.sent_at,
          score: 0.8,
          meta: { direction: m.direction, from_name: m.from_name, thread_id: m.thread_id },
        })
      }
    }

    // Map notes
    if (notesResult.data) {
      for (const n of notesResult.data) {
        results.push({
          id: n.id,
          type: 'note',
          source: 'Notes',
          snippet: `${n.title}: ${(n.body || '').slice(0, 120)}`,
          date: n.created_at,
          score: 0.85,
        })
      }
    }

    // Map threads/contacts
    if (threadsResult.data) {
      for (const t of threadsResult.data) {
        results.push({
          id: t.id,
          type: 'contact',
          source: `WhatsApp (${t.panel})`,
          snippet: `${t.contact_name || t.phone} — ${t.last_message_preview || 'No recent message'}`,
          date: t.last_message_at,
          score: 0.9,
          meta: { phone: t.phone, panel: t.panel, channel_type: t.channel_type },
        })
      }
    }

    // Map deals
    if (dealsResult.data) {
      for (const d of dealsResult.data) {
        results.push({
          id: d.id,
          type: 'deal',
          source: 'Deals',
          snippet: `${d.name}${d.address ? ` — ${d.address}` : ''} (${d.status})`,
          date: d.created_at,
          score: 0.75,
        })
      }
    }

    // Sort by score descending, then by date
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const dateA = a.date ? new Date(a.date).getTime() : 0
      const dateB = b.date ? new Date(b.date).getTime() : 0
      return dateB - dateA
    })

    return NextResponse.json({ results, query: q })
  } catch (error) {
    console.error('[search] failed:', error)
    return NextResponse.json(
      { error: 'search_failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
