import { NextRequest, NextResponse } from 'next/server';
import { getMessages, markMessageRead } from '@/lib/data/dataService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getMessages();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch messages', details: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const result = await markMessageRead(body.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update message', details: String(err) }, { status: 500 });
  }
}
