import { NextRequest, NextResponse } from 'next/server';
import { getLiveInvestorProfile } from '@/lib/investors/profileService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pipedriveId = parseInt(id.replace('investor-', '').replace('pipedrive:', ''));
    
    if (isNaN(pipedriveId)) {
      return NextResponse.json({ error: 'Invalid investor ID' }, { status: 400 });
    }

    const profile = await getLiveInvestorProfile(pipedriveId);
    if (!profile) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 });
    }

    return NextResponse.json({ data: profile, source: 'database' });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch investor profile', details: String(err) }, { status: 500 });
  }
}
