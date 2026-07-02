import { NextRequest, NextResponse } from 'next/server';
import { getTasks, createTask, toggleTaskStatus } from '@/lib/data/dataService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getTasks();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch tasks', details: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    const result = await createTask(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create task', details: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const result = await toggleTaskStatus(body.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to toggle task', details: String(err) }, { status: 500 });
  }
}
