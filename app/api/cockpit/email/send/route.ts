import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/sendgrid/client';
import { logInfo, logError } from '@/lib/logging/systemLog';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'Email is not configured. Add SENDGRID_API_KEY to enable live email sending.',
      configured: false,
    }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { to, subject, text, html } = body;

    if (!to || !subject) {
      return NextResponse.json({ error: 'to and subject are required' }, { status: 400 });
    }

    const from = process.env.SENDGRID_FROM_EMAIL || 'g@reprime.com';
    await sendEmail({ to, from, subject, text, html: html || text });

    logInfo('email', `Email sent to ${to}: "${subject}"`);
    return NextResponse.json({ success: true, message: `Email sent to ${to}` });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logError('email', `Email send failed: ${errMsg}`);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
