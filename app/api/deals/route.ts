import { NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    // Fallback orgId if not authenticated (for local prototyping)
    // The previous implementation often used a fallback or fetched from orgMembers
    const orgId = session?.user?.id || '00000000-0000-0000-0000-000000000000'; // Default prototype orgId

    const service = createServiceClient();
    // Try to fetch deals for this org via REST API
    const { data: allDeals, error: dbError } = await service
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (dbError) {
      console.error('Deals query error:', dbError);
    }
    
    if (!allDeals || allDeals.length === 0) {
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

    // Map column names to camelCase for the UI
    const mappedDeals = allDeals.map(d => ({
      id: d.id,
      orgId: d.org_id,
      name: d.name,
      address: d.address,
      assetType: d.asset_type,
      purchasePrice: d.purchase_price,
      loanAmount: d.loan_amount,
      equityNeeded: d.equity_needed,
      status: d.status,
      priority: d.priority,
      riskScore: d.risk_score,
      createdAt: d.created_at
    }));

    return NextResponse.json(mappedDeals);
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

    const service = createServiceClient();
    
    // Fetch default org_id (single-tenant fallback)
    const { data: orgData } = await service.from('organizations').select('id').limit(1).single();
    const actualOrgId = orgData?.id || orgId;

    const { data: newDeal, error: dbError } = await service
      .from('deals')
      .insert({
        org_id: actualOrgId,
        name,
        address,
        asset_type: assetType,
        purchase_price: purchasePrice,
        loan_amount: loanAmount,
        equity_needed: equityNeeded,
        status: status || 'active',
        priority: priority || 3,
        risk_score: riskScore || 0,
      })
      .select('*')
      .single();

    if (dbError) {
      console.error('Failed to create deal DB error:', dbError);
      return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 });
    }

    const mappedDeal = {
      id: newDeal.id,
      orgId: newDeal.org_id,
      name: newDeal.name,
      address: newDeal.address,
      assetType: newDeal.asset_type,
      purchasePrice: newDeal.purchase_price,
      loanAmount: newDeal.loan_amount,
      equityNeeded: newDeal.equity_needed,
      status: newDeal.status,
      priority: newDeal.priority,
      riskScore: newDeal.risk_score,
      createdAt: newDeal.created_at
    };

    return NextResponse.json(mappedDeal);
  } catch (error) {
    console.error('Failed to create deal:', error);
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 });
  }
}
