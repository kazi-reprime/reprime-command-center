import { NextResponse } from 'next/server';
import { getCalendarAgendas } from '@/lib/google';

export async function GET() {
  try {
    const agendas = await getCalendarAgendas();
    return NextResponse.json(agendas);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
