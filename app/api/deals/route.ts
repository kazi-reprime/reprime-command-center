import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deals } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    // Fallback orgId if not authenticated (for local prototyping)
    // The previous implementation often used a fallback or fetched from orgMembers
    const orgId = session?.user?.id || '00000000-0000-0000-0000-000000000000'; // Default prototype orgId

    // Try to fetch deals for this org
    let allDeals = [];
    try {
      allDeals = await db
        .select()
        .from(deals)
        .where(eq(deals.orgId, orgId))
        .orderBy(desc(deals.createdAt));
    } catch (dbError) {
      console.error('Deals query error:', dbError);
    }
    
    if (allDeals.length === 0) {
      // Mock data for prototyping if table is empty
      console.warn('Deals table is empty, returning mock data for prototyping');
      return NextResponse.json([
        {
          id: '1',
          name: 'Bay Valley Shopping Center',
          address: '123 Bay Valley Rd, FL',
          assetType: 'Retail',
          purchasePrice: 4200000,
          loanAmount: 2500000,
          equityNeeded: 1700000,
          status: 'under_contract',
          priority: 1,
          riskScore: 3,
        },
        {
          id: '2',
          name: 'Downtown Office Plaza',
          address: '456 Main St, NY',
          assetType: 'Office',
          purchasePrice: 15000000,
          loanAmount: 10000000,
          equityNeeded: 5000000,
          status: 'evaluating',
          priority: 2,
          riskScore: 5,
        }
      ]);
    }

    return NextResponse.json(allDeals);
  } catch (error) {
    console.error('Failed to fetch deals:', error);
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    const orgId = session?.user?.id || '00000000-0000-0000-0000-000000000000';

    const body = await request.json();
    const { name, address, assetType, purchasePrice, loanAmount, equityNeeded, status, priority, riskScore } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const [newDeal] = await db
      .insert(deals)
      .values({
        orgId,
        name,
        address,
        assetType,
        purchasePrice,
        loanAmount,
        equityNeeded,
        status: status || 'active',
        priority: priority || 3,
        riskScore: riskScore || 0,
      })
      .returning();

    return NextResponse.json(newDeal);
  } catch (error) {
    console.error('Failed to create deal:', error);
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 });
  }
}
