import { NextResponse } from 'next/server';
import { whatsappAdapter } from '@/lib/adapters/whatsappAdapter';
import { smsAdapter } from '@/lib/adapters/smsAdapter';
import { imessageAdapter } from '@/lib/adapters/imessageAdapter';
import { emailAdapter } from '@/lib/adapters/emailAdapter';
import { jewishCalendarAdapter } from '@/lib/adapters/jewishCalendarAdapter';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    whatsapp: whatsappAdapter.getStatus(),
    sms: smsAdapter.getStatus(),
    imessage: imessageAdapter.getStatus(),
    email: emailAdapter.getStatus(),
    jewishCalendar: jewishCalendarAdapter.getStatus(),
  });
}
