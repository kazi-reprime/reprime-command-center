import { NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'

interface NoteRow {
  id: string
  title: string
  body: string
  is_pinned: boolean
  created_at: string
  updated_at: string
}

async function authorize() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) return null
  return user
}

export async function GET() {
  const user = await authorize()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('notes')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ notes: (data || []) as NoteRow[] })
}

export async function POST(request: Request) {
  const user = await authorize()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { title?: unknown; body?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const noteBody = typeof body.body === 'string' ? body.body : ''
  if (!title) {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('notes')
    .insert({ title, body: noteBody, is_pinned: false })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ note: data as NoteRow })
}

export async function PUT(request: Request) {
  const user = await authorize()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { id?: unknown; title?: unknown; body?: unknown; is_pinned?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id : null
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const patch: Partial<Pick<NoteRow, 'title' | 'body' | 'is_pinned'>> & { updated_at?: string } = {}
  if (typeof body.title === 'string') patch.title = body.title
  if (typeof body.body === 'string') patch.body = body.body
  if (typeof body.is_pinned === 'boolean') patch.is_pinned = body.is_pinned
  patch.updated_at = new Date().toISOString()

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('notes')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ note: data as NoteRow })
}

export async function DELETE(request: Request) {
  const user = await authorize()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id : null
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service.from('notes').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
