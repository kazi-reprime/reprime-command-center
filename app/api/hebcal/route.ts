import { NextResponse } from 'next/server';
import { HebrewCalendar, Location, Event } from '@hebcal/core';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Default to Chicago coordinates for Gideon (as used in soft-schedule.ts)
  const lat = parseFloat(searchParams.get('lat') || '41.8781');
  const lon = parseFloat(searchParams.get('lon') || '-87.6298');
  const tzid = searchParams.get('tzid') || 'America/Chicago';

  try {
    const location = new Location(lat, lon, false, tzid);
    const options = {
      start: new Date(new Date().getTime() - 24 * 60 * 60 * 1000), // Start from yesterday to catch Friday sundown if today is Saturday
      end: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
      isHebrewYear: false,
      candlelighting: true,
      location: location,
      sedrot: true,
      omer: true,
    };

    const events = HebrewCalendar.calendar(options);
    
    // Find the next candle lighting and havdalah
    const candleLighting = events.find((ev: Event) => ev.getDesc() === 'Candle lighting');
    const havdalah = events.find((ev: Event) => ev.getDesc() === 'Havdalah');

    // Is it currently Shabbat?
    let isShabbat = false;
    const now = new Date();
    
    if (candleLighting && havdalah) {
      const start = candleLighting.getDate().greg();
      const end = havdalah.getDate().greg();
      
      if (now.getTime() >= start.getTime() && now.getTime() <= end.getTime()) {
        isShabbat = true;
      } else if (now.getDay() === 6 && now.getTime() <= end.getTime()) {
        // Fallback for Saturday if candleLighting was skipped by date bounding
        isShabbat = true;
      }
    } else if (now.getDay() === 6) { 
       isShabbat = true;
    }

    return NextResponse.json({
      isShabbat,
      nextCandleLighting: candleLighting ? candleLighting.getDate().greg().toISOString() : null,
      nextHavdalah: havdalah ? havdalah.getDate().greg().toISOString() : null,
      parsha: events.find((ev: Event) => ev.getFlags() & Event.PARSHA_HASHAVUA)?.getDesc() || null
    });
  } catch (error) {
    console.error('Hebcal error:', error);
    return NextResponse.json({ error: 'Failed to calculate hebcal events' }, { status: 500 });
  }
}
