import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizePhone } from '@/lib/phone';

// GET verification for Meta Webhook setup
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.META_WA_VERIFY_TOKEN || 'REPRIME';

  if (mode === 'subscribe' && token === verifyToken) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// POST webhook ingestion from Meta Cloud API
export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // 1. Validate payload structure
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      // Ignore status updates (delivered/read) for the core text ingestion
      return NextResponse.json({ success: true, status: 'Ignored status update' });
    }

    const phoneNumberId = value.metadata?.phone_number_id;
    if (!phoneNumberId) {
      return NextResponse.json({ error: 'Missing phone_number_id metadata' }, { status: 400 });
    }

    // Resolve panel based on META_WA_PHONE_NUMBER_ID of 718 line vs 305 line
    // For now, if phoneNumberId matches 718-related variables we can set 718, else 305.
    const panel = phoneNumberId === process.env.META_WA_PHONE_NUMBER_ID_718 ? '718' : '305';

    const contactPhone = normalizePhone(message.from);
    const body = message.text?.body || '[Non-text media message]';

    const service = createServiceClient();
    const now = new Date().toISOString();

    // 2. Upsert thread in whatsapp_threads
    const threadRow = {
      panel,
      channel_type: 'whatsapp',
      phone: contactPhone,
      last_message_at: now,
      last_message_preview: body.slice(0, 120),
      unread_count: 1,
      updated_at: now,
    };

    const { data: thread, error: threadErr } = await service
      .from('whatsapp_threads')
      .upsert(threadRow, { onConflict: 'panel,phone,channel_type' })
      .select('id')
      .single();

    if (threadErr || !thread) {
      console.error('[meta-wa-webhook] thread upsert failed:', threadErr?.message);
      return NextResponse.json({ error: 'Database thread sync failed' }, { status: 500 });
    }

    // 3. Insert message into whatsapp_messages
    const msgRow = {
      thread_id: thread.id,
      panel,
      channel_type: 'whatsapp',
      direction: 'in',
      body,
      timelines_uid: `meta:${message.id || Math.random().toString(36).substring(7)}`,
      from_phone: contactPhone,
      sent_at: now,
      status: 'received',
    };

    const { error: msgErr } = await service
      .from('whatsapp_messages')
      .upsert(msgRow, { onConflict: 'timelines_uid' });

    if (msgErr) {
      console.error('[meta-wa-webhook] message insert failed:', msgErr.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in Meta WhatsApp Webhook:', error);
    const errMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
