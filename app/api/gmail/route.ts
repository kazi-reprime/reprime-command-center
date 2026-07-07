import { NextResponse } from 'next/server';
import { getGmailTriageList } from '@/lib/google';

export const dynamic = 'force-dynamic'

/**
 * GET /api/gmail
 *
 * Returns prioritized Gmail messages from the real Gmail API.
 * Previously fell back silently to fake data — now returns a proper error.
 */
export async function GET() {
  try {
    const list = await getGmailTriageList();
    return NextResponse.json(list);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[/api/gmail] Gmail fetch failed:', msg);

    // Return empty array with error flag so the UI can show a meaningful
    // "Gmail unavailable" state instead of fake emails.
    return NextResponse.json(
      { error: 'gmail_unavailable', message: msg, emails: [] },
      { status: 502 }
    );
  }
}
