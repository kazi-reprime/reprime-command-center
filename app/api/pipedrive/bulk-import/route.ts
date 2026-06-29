import { type NextRequest } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import {
  bulkUpsertPersons,
  type BulkProgress,
  type BulkRow,
} from '@/lib/pipedrive/bulk-upsert'
import { pipedriveAdapter } from '@/lib/adapters/pipedriveAdapter'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 min — Vercel Pro cap

const ALLOWED_EMAIL = 'g@reprime.com'
const INLINE_CAP = 1000

type Body = {
  source: 'contact_directory' | 'inline'
  rows?: BulkRow[]
}

interface ContactDirectoryRow {
  canonical_name: string | null
  primary_email: string | null
  primary_phone: string | null
  company: string | null
  is_investor: boolean | null
}

async function loadContactDirectoryRows(): Promise<BulkRow[]> {
  const sb = createServiceClient()
  const out: BulkRow[] = []
  const pageSize = 1000
  let from = 0
  for (let safety = 0; safety < 20; safety++) {
    const { data, error } = await sb
      .from('contact_directory')
      .select('canonical_name, primary_email, primary_phone, company, is_investor')
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`contact_directory read failed: ${error.message}`)
    const rows = (data ?? []) as ContactDirectoryRow[]
    if (rows.length === 0) break
    for (const r of rows) {
      const name = (r.canonical_name ?? '').trim()
      if (!name && !r.primary_email && !r.primary_phone) continue
      out.push({
        name: name || null,
        email: r.primary_email,
        phone: r.primary_phone,
        org: r.company,
        tag: r.is_investor ? 'investor' : null,
      })
    }
    if (rows.length < pageSize) break
    from += pageSize
  }
  return out
}

function sseEvent(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const status = pipedriveAdapter.getStatus();
  if (!status.isConfigured) {
    return new Response(JSON.stringify({ error: 'adapter_offline', message: status.error }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (body.source !== 'contact_directory' && body.source !== 'inline') {
    return new Response(
      JSON.stringify({ error: 'source must be "contact_directory" or "inline"' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let rows: BulkRow[]
  try {
    if (body.source === 'inline') {
      if (!Array.isArray(body.rows)) {
        return new Response(
          JSON.stringify({ error: 'rows[] required when source=inline' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (body.rows.length > INLINE_CAP) {
        return new Response(
          JSON.stringify({ error: `inline rows capped at ${INLINE_CAP}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }
      rows = body.rows
    } else {
      rows = await loadContactDirectoryRows()
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'load_failed', message: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(sseEvent({ event: 'start', total: rows.length, source: body.source }))

      let final: BulkProgress
      try {
        final = await bulkUpsertPersons(rows, {
          progressEvery: 50,
          onProgress: (progress) => {
            controller.enqueue(sseEvent({ event: 'progress', ...progress }))
          },
        })
        controller.enqueue(sseEvent({ event: 'done', ...final }))
      } catch (err) {
        controller.enqueue(
          sseEvent({ event: 'error', message: (err as Error).message })
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
