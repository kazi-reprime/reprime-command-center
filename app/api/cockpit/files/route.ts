import { NextResponse } from 'next/server';
import { getFiles } from '@/lib/data/dataService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getFiles();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch files', details: String(err) }, { status: 500 });
  }
}
