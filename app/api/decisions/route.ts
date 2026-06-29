import { NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== 'g@reprime.com') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from('decision_log')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching decision log:', error);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({ decisions: data });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== 'g@reprime.com') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { title, description, decidedBy, reason, status = 'active', isReversible = false } = body;
  if (!title || !description || !decidedBy || !reason) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from('decision_log')
    .insert([{
      title,
      description,
      decided_by: decidedBy,
      reason,
      status,
      is_reversible: isReversible
    }])
    .select()
    .single();

  if (error) {
    console.error('Error inserting decision log:', error);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({ decision: data });
}

export async function PATCH(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== 'g@reprime.com') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { id, status } = body;
  if (!id || !status) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from('decision_log')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating decision log:', error);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({ decision: data });
}
