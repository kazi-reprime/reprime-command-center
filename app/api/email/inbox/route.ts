/**
 * Email Inbox API Route
 *
 * Returns real Gmail inbox data. The Email panel consumes this
 * instead of mock data.
 *
 * GET  /api/email/inbox            → latest emails across all accounts
 * GET  /api/email/inbox?q=search   → search emails
 * GET  /api/email/inbox?account=fst → specific account
 */

import { NextResponse, type NextRequest } from 'next/server'
import { fetchInbox, searchEmails } from '@/lib/email/unified-inbox'
import type { GmailAccountKey } from '@/lib/google/gmail'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const account = searchParams.get('account') as GmailAccountKey | null
  const maxResults = parseInt(searchParams.get('limit') || '20', 10)

  try {
    const emails = query
      ? await searchEmails(query, { account: account || undefined, maxResults })
      : await fetchInbox({ account: account || undefined, maxResults })

    return NextResponse.json({
      emails,
      total: emails.length,
      account: account || 'all',
    })
  } catch (err) {
    console.error('[email/inbox] failed', (err as Error).message)
    return NextResponse.json(
      { error: 'inbox_fetch_failed', message: (err as Error).message },
      { status: 500 },
    )
  }
}
