import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

/**
 * GET /api/gmail
 *
 * Legacy Gmail endpoint. Tries the real Gmail triage list first,
 * falls back to the new unified inbox if rate-limited or errored.
 */
export async function GET() {
  // Strategy 1: Original Gmail triage list
  try {
    const { getGmailTriageList } = await import('@/lib/google');
    const list = await getGmailTriageList();
    return NextResponse.json(list);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[/api/gmail] Primary failed:', msg);

    // Strategy 2: Fall back to new unified inbox
    try {
      const { fetchInbox } = await import('@/lib/email/unified-inbox');
      const emails = await fetchInbox({ maxResults: 15 });
      const formatted = emails.map((e) => ({
        id: e.messageId,
        from: e.from,
        fromName: e.fromName,
        subject: e.subject,
        snippet: e.snippet,
        receivedAt: e.receivedAt,
        isUnread: e.unread,
        isImportant: e.important,
        labels: e.labels || [],
      }));
      return NextResponse.json(formatted);
    } catch (fallbackErr) {
      console.error('[/api/gmail] Fallback also failed:', (fallbackErr as Error).message);
    }

    return NextResponse.json(
      { error: 'gmail_unavailable', message: msg, emails: [] },
      { status: 502 }
    );
  }
}
