import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { token, email, password } = await req.json();

    if (!token || !email || !password) {
      return NextResponse.json({ error: 'Missing token, email, or password' }, { status: 400 });
    }

    const service = createServiceClient();

    // 1. Verify email exists and is active in crew_members
    const { data: crew, error: crewError } = await service
      .from('crew_members')
      .select('*')
      .eq('email', email)
      .eq('active', true)
      .maybeSingle();

    if (crewError || !crew) {
      return NextResponse.json(
        { error: 'Email is not authorized as a crew member or is inactive' },
        { status: 400 }
      );
    }

    // 2. Create the user in Supabase auth system using the Admin API
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: crew.role || 'agent' },
    });

    if (userError || !userData?.user) {
      return NextResponse.json({ error: userError?.message || 'Failed to create user account' }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId: userData.user.id });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
