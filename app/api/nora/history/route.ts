import { NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'
const HISTORY_LIMIT = 50

type ChatMessageRow = {
  role: 'user' | 'assistant'
  content: string
  language: string | null
  created_at: string
}

/**
 * GET /api/nora/history
 *
 * Returns the last ~50 Nora chat messages ordered oldest→newest so the
 * NoraChat transcript can hydrate on mount and survive a reload.
 *
 * Degrades gracefully: if the nora_chat_messages table hasn't been migrated
 * yet (see supabase/migrations/2026-06-22-nora-chat.sql), this returns
 * { messages: [] } rather than a 500, so the chat still loads empty.
 */
export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  try {
    const service = createServiceClient()
    // Pull the newest N, then reverse to oldest→newest for the transcript.
    const { data, error } = await service
      .from('nora_chat_messages')
      .select('role, content, language, created_at')
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)

    if (error) {
      console.error('[nora/history] select failed', error.message)
      return NextResponse.json({ messages: [] })
    }

    const rows = (data ?? []) as ChatMessageRow[]
    const messages = rows
      .slice()
      .reverse()
      .map((r) => ({
        role: r.role,
        content: r.content,
        language: r.language === 'he' ? 'he' : 'en',
        created_at: r.created_at,
      }))

    return NextResponse.json({ messages })
  } catch (err) {
    console.error('[nora/history] threw', (err as Error).message)
    return NextResponse.json({ messages: [] })
  }
}

/**
 * DELETE /api/nora/history
 *
 * Clears the chat history (for a "clear chat" button). Best-effort — returns
 * ok:false on error rather than throwing.
 */
export async function DELETE() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  try {
    const service = createServiceClient()
    // Delete all rows (single-user app). The .neq guard satisfies PostgREST's
    // requirement for a filter on bulk deletes.
    const { error } = await service
      .from('nora_chat_messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      console.error('[nora/history] delete failed', error.message)
      return NextResponse.json({ ok: false })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[nora/history] delete threw', (err as Error).message)
    return NextResponse.json({ ok: false })
  }
}
