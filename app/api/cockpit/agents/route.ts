import { NextRequest, NextResponse } from 'next/server';
import { getAgents, toggleAgent } from '@/lib/data/dataService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getAgents();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch agents', details: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id || !body.action) {
      return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
    }
    const result = await toggleAgent(body.id, body.action);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to toggle agent', details: String(err) }, { status: 500 });
  }
}
