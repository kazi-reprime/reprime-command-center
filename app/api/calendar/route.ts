import { NextResponse } from 'next/server';
import { getCalendarAgendas } from '@/lib/google';
import { jewishCalendarAdapter } from '@/lib/adapters/jewishCalendarAdapter';

export async function GET() {
  try {
    const agendas = await getCalendarAgendas();
    const jewishInfo = jewishCalendarAdapter.getTodayInfo();
    
    // Merge Jewish events as read-only all-day events at the top
    const jewishEvents = jewishInfo.events.map((ev, idx) => ({
      id: `jewish-${idx}`,
      summary: `✡️ ${ev.title}`,
      description: ev.desc,
      start: new Date().toISOString().split('T')[0], // all-day
      end: new Date().toISOString().split('T')[0],
      isJewish: true
    }));

    return NextResponse.json([...jewishEvents, ...agendas]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
