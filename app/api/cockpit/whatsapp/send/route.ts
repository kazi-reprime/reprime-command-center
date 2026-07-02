import { NextRequest, NextResponse } from 'next/server';
import { logInfo, logError } from '@/lib/logging/systemLog';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const apiKey = process.env.TIMELINES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'WhatsApp is not configured. Add TIMELINES_API_KEY to enable live WhatsApp sending.',
      configured: false,
    }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { phone, message, channelId } = body;

    if (!phone || !message) {
      return NextResponse.json({ error: 'phone and message are required' }, { status: 400 });
    }

    // Use the Timelines.ai API to send message
    const channel = channelId || process.env.TIMELINES_CHANNEL_305;
    const res = await fetch('https://api.timelines.ai/api/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        phone: phone.replace(/[^+\d]/g, ''),
        text: message,
        channel_id: channel ? parseInt(channel) : undefined,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Timelines.ai API error ${res.status}: ${errText}`);
    }

    logInfo('whatsapp', `WhatsApp sent to ${phone}: "${message.slice(0, 50)}..."`);
    return NextResponse.json({ success: true, message: `WhatsApp sent to ${phone}` });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logError('whatsapp', `WhatsApp send failed: ${errMsg}`);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
