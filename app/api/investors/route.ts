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
      return NextResponse.json([]);
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
