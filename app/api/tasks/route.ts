import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from('bucket_items')
      .select('*')
      .in('status', ['open', 'doing'])
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api/tasks GET] db error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map bucket_items to the UI Task structure
    const tasks = (data || []).map((item) => ({
      id: item.id,
      title: item.title,
      priority: item.priority,
      projectTag: item.source_type || 'General',
    }));

    return NextResponse.json(tasks);
  } catch (err) {
    console.error('[api/tasks GET] exception:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { title, priority, projectTag } = await req.json();
    const service = createServiceClient();

    const { data, error } = await service
      .from('bucket_items')
      .insert({
        title,
        priority: priority || 3,
        source_type: projectTag || 'General',
        status: 'open',
      })
      .select('*')
      .single();

    if (error) {
      console.error('[api/tasks POST] db error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      title: data.title,
      priority: data.priority,
      projectTag: data.source_type,
    });
  } catch (err) {
    console.error('[api/tasks POST] exception:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, completed } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from('bucket_items')
      .update({
        status: completed ? 'done' : 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('[api/tasks PATCH] db error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      title: data.title,
      priority: data.priority,
      projectTag: data.source_type,
    });
  } catch (err) {
    console.error('[api/tasks PATCH] exception:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
