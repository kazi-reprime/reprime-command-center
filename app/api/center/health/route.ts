/* eslint-disable */
import { NextResponse } from 'next/server';
import { whatsappAdapter } from '@/lib/adapters/whatsappAdapter';
import { smsAdapter } from '@/lib/adapters/smsAdapter';
import { imessageAdapter } from '@/lib/adapters/imessageAdapter';
import { emailAdapter } from '@/lib/adapters/emailAdapter';
import { jewishCalendarAdapter } from '@/lib/adapters/jewishCalendarAdapter';
import { Client } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbStatus = { isConnected: false, error: null as string | null };
  const url = new URL(process.env.DATABASE_URL || '');
  url.searchParams.delete('sslmode');
  const connectionString = url.toString();

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    dbStatus.isConnected = true;
  } catch (err) {
    dbStatus.error = (err as Error).message;
  } finally {
    await client.end().catch(() => {});
  }

  return NextResponse.json({
    database: dbStatus,
    whatsapp: whatsappAdapter.getStatus(),
    sms: smsAdapter.getStatus(),
    imessage: imessageAdapter.getStatus(),
    email: emailAdapter.getStatus(),
    jewishCalendar: jewishCalendarAdapter.getStatus(),
  });
}
