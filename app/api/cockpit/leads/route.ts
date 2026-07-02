import { NextRequest, NextResponse } from 'next/server';
import { getLeads, createLead, updateLeadStage } from '@/lib/data/dataService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getLeads();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch leads', details: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const result = await createLead(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create lead', details: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id || !body.stage) {
      return NextResponse.json({ error: 'id and stage are required' }, { status: 400 });
    }
    const result = await updateLeadStage(body.id, body.stage);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update lead', details: String(err) }, { status: 500 });
  }
}
