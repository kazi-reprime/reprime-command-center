import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { client as gmailClient } from '@/lib/google/gmail'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'

/**
 * POST /api/email/mark-read  { message_id, read: boolean, account?: string }
 * Toggles Gmail's UNREAD label on the mailbox identified by `account` (the
 * email's real inbox, e.g. g@reprime.com). Falls back to the default mailbox
 * when `account` is absent/unconfigured. Requires that mailbox's refresh token
 * to carry the gmail.modify scope; otherwise Gmail returns 403 insufficient_scope
 * → surfaced as needs_consent.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { message_id?: string; read?: boolean; account?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const messageId = body.message_id
  if (!messageId || typeof messageId !== 'string') {
    return NextResponse.json({ error: 'message_id_required' }, { status: 400 })
  }
  const markRead = body.read !== false // default true

  // Bind to the mailbox the message actually belongs to. client() resolves the
  // account by email or key and falls back to the default mailbox.
  const gmail = gmailClient(body.account)

  try {
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: markRead
        ? { removeLabelIds: ['UNREAD'] }
        : { addLabelIds: ['UNREAD'] },
    })
    return NextResponse.json({ ok: true, message_id: messageId, read: markRead })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    const needsConsent = /insufficient|scope|403|PERMISSION_DENIED/i.test(msg)
    return NextResponse.json(
      {
        error: needsConsent ? 'needs_consent' : 'modify_failed',
        message: needsConsent
          ? 'Gmail token lacks gmail.modify — run scripts/get-gmail-token.mjs and update GOOGLE_REFRESH_TOKEN.'
          : msg,
      },
      { status: needsConsent ? 403 : 502 }
    )
  }
}
