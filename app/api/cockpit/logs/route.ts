import { NextResponse } from 'next/server';
import { getRecentLogs } from '@/lib/logging/systemLog';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const logs = getRecentLogs(100);
    return NextResponse.json({ logs });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch logs', details: String(err) }, { status: 500 });
  }
}
