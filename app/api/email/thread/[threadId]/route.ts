/**
 * Email Thread API Route
 *
 * GET /api/email/thread/[threadId] → Full thread with all messages
 */

import { NextResponse, type NextRequest } from 'next/server'
import { fetchThread } from '@/lib/email/unified-inbox'
import type { GmailAccountKey } from '@/lib/google/gmail'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params
  const account = new URL(request.url).searchParams.get('account') as GmailAccountKey | null

  try {
    const thread = await fetchThread(threadId, account || undefined)

    if (!thread) {
      return NextResponse.json({ error: 'thread_not_found' }, { status: 404 })
    }

    return NextResponse.json(thread)
  } catch (err) {
    console.error('[email/thread] failed', threadId, (err as Error).message)
    return NextResponse.json(
      { error: 'thread_fetch_failed', message: (err as Error).message },
      { status: 500 },
    )
  }
}
