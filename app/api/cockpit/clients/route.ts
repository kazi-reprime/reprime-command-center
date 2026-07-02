import { NextRequest, NextResponse } from 'next/server';
import { getClients, createClient } from '@/lib/data/dataService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getClients();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch clients', details: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const result = await createClient(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create client', details: String(err) }, { status: 500 });
  }
}
