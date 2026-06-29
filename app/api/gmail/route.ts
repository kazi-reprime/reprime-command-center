import { NextResponse } from 'next/server';
import { getGmailTriageList } from '@/lib/google';

export async function GET() {
  try {
    const list = await getGmailTriageList();
    return NextResponse.json(list);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
