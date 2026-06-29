import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizePhone } from '@/lib/phone';
import crypto from 'crypto';

function verifyTwilio(authToken: string, signature: string, url: string, params: Record<string, string>): boolean {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  const hash = crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
  return signature === hash;
}

export async function POST(req: Request) {
  try {
    const text = await req.text();
    const url = new URL(req.url);

    // Parse url-encoded Twilio POST parameters
    const searchParams = new URLSearchParams(text);
    const params: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      params[key] = val;
    });

    const twilioSignature = req.headers.get('x-twilio-signature');
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

    if (twilioSignature && twilioAuthToken) {
      const requestUrl = process.env.PUBLIC_URL 
        ? `${process.env.PUBLIC_URL}/api/webhooks/sms` 
        : `${url.protocol}//${req.headers.get('host')}${url.pathname}`;

      const isValid = verifyTwilio(twilioAuthToken, twilioSignature, requestUrl, params);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid Twilio Signature' }, { status: 401 });
      }
    }

    const { From, To, Body } = params;

    if (!From || !To || !Body) {
      return NextResponse.json({ error: 'Missing From, To, or Body parameters' }, { status: 400 });
    }

    const contactPhone = normalizePhone(From);
    // Resolve panel based on To number
    const panel = To.includes('718') ? '718' : '305';

    const service = createServiceClient();
    const now = new Date().toISOString();

    // 1. Upsert thread in whatsapp_threads
    const threadRow = {
      panel,
      channel_type: 'sms',
      phone: contactPhone,
      last_message_at: now,
      last_message_preview: Body.slice(0, 120),
      unread_count: 1,
      updated_at: now,
    };

    const { data: thread, error: threadErr } = await service
      .from('whatsapp_threads')
      .upsert(threadRow, { onConflict: 'panel,phone,channel_type' })
      .select('id')
      .single();

    if (threadErr || !thread) {
      console.error('[twilio-sms-webhook] thread upsert failed:', threadErr?.message);
      return NextResponse.json({ error: 'Database thread sync failed' }, { status: 500 });
    }

    // 2. Insert message into whatsapp_messages
    const msgRow = {
      thread_id: thread.id,
      panel,
      channel_type: 'sms',
      direction: 'in',
      body: Body,
      timelines_uid: `twilio:${params.MessageSid || Math.random().toString(36).substring(7)}`,
      from_phone: contactPhone,
      sent_at: now,
      status: 'received',
    };

    const { error: msgErr } = await service
      .from('whatsapp_messages')
      .upsert(msgRow, { onConflict: 'timelines_uid' });

    if (msgErr) {
      console.error('[twilio-sms-webhook] message insert failed:', msgErr.message);
    }

    // Twilio standard XML empty response
    return new Response('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in Twilio SMS Webhook:', error);
    const errMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
