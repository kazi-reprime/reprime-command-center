import { NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerClient();
    await supabase.auth.getSession();
    
    const service = createServiceClient();
    
    const { data: allInvestors, error: dbError } = await service
      .from('investors')
      .select('*')
      .order('investor_score', { ascending: false });

    if (dbError) {
      console.error('Investors query error:', dbError);
    }
    
    if (!allInvestors || allInvestors.length === 0) {
      // Mock data for prototyping if table is empty
      console.warn('Investors table is empty, returning mock data for prototyping');
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

    const mappedInvestors = allInvestors.map(inv => ({
      id: inv.id,
      orgId: inv.org_id,
      name: inv.name,
      contactPhone: inv.contact_phone,
      capitalCapacity: inv.capital_capacity,
      preferredDealType: inv.preferred_deal_type,
      preferredLocation: inv.preferred_location,
      status: inv.status,
      investorScore: inv.investor_score,
      lastInteractionAt: inv.last_interaction_at,
      createdAt: inv.created_at
    }));

    return NextResponse.json(mappedInvestors);
  } catch (error) {
    console.error('Failed to fetch investors:', error);
    return NextResponse.json({ error: 'Failed to fetch investors' }, { status: 500 });
  }
}
