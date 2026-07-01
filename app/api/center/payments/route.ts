import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const service = createServiceClient();
    
    // Fetch payments, ordered by due_date (overdue first)
    const { data, error } = await service
      .from('payments')
      .select('*')
      .order('due_date', { ascending: true });

    if (error) throw error;

    // Enhance with status logic if needed (though DB has status column)
    const now = new Date();
    const result = (data || []).map(p => {
      let status = p.status;
      if (status === 'pending' && new Date(p.due_date) < now) {
        status = 'overdue';
      }
      return {
        ...p,
        status,
        dueDateFormatted: new Date(p.due_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Failed to fetch payments:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'ID and status are required' }, { status: 400 });
    }

    const service = createServiceClient();
    const { error } = await service
      .from('payments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to update payment:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
