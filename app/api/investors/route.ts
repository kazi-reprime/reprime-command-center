import { NextResponse } from 'next/server';
import { db } from '@/db';
import { investors } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    // Fallback orgId if not authenticated
    const orgId = session?.user?.id || '00000000-0000-0000-0000-000000000000';

    let allInvestors = [];
    try {
      allInvestors = await db
        .select()
        .from(investors)
        .where(eq(investors.orgId, orgId))
        .orderBy(desc(investors.investorScore));
    } catch (dbError) {
      // Mock data for prototyping if table not ready
      console.warn('Investors table query failed, returning mock data:', dbError);
      return NextResponse.json([
        {
          id: '1',
          name: 'Sarah Chen',
          contactPhone: '+13055551234',
          capitalCapacity: 5000000,
          preferredDealType: 'Retail',
          preferredLocation: 'Florida',
          status: 'hot',
          investorScore: 92,
          lastInteractionAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Marcus Levy',
          contactPhone: '+17185559876',
          capitalCapacity: 2000000,
          preferredDealType: 'Office',
          preferredLocation: 'New York',
          status: 'warm',
          investorScore: 65,
          lastInteractionAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        },
        {
          id: '3',
          name: 'David Rosenberg',
          contactPhone: '+13055554321',
          capitalCapacity: 10000000,
          preferredDealType: 'Multifamily',
          preferredLocation: 'Texas',
          status: 'committed',
          investorScore: 98,
          lastInteractionAt: new Date().toISOString(),
        }
      ]);
    }

    return NextResponse.json(allInvestors);
  } catch (error) {
    console.error('Failed to fetch investors:', error);
    return NextResponse.json({ error: 'Failed to fetch investors' }, { status: 500 });
  }
}
