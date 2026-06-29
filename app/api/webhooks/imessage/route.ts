import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizePhone } from '@/lib/phone';

function normalizeTimestamp(ts: number): Date {
  let n = ts;
  // Apply timestamp unit normalization rule (resolving 1970 timestamp bug)
  while (n > 1e14) n /= 1000;
  if (n < 1e11) n *= 1000;
  return new Date(n);
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    const expectedSecret = process.env.BLUEBUBBLES_WEBHOOK_SECRET || process.env.IMESSAGE_WEBHOOK_SECRET;

    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const type = payload.type;
    const data = payload.data;

    // We only ingest new message events
    if (type !== 'new-message' || !data) {
      return NextResponse.json({ success: true, status: 'Ignored event type' });
    }

    const body = data.text || '[Attachment/Empty media message]';
    const handleInfo = data.handle;
    if (!handleInfo) {
      return NextResponse.json({ error: 'Missing handle information' }, { status: 400 });
    }

    // Address can be phone (+13057784861) or Apple ID email
    const isEmail = handleInfo.address.includes('@');
    const contactPhone = isEmail ? handleInfo.address : normalizePhone(handleInfo.address);

    const isFromMe = data.isFromMe;
    const direction = isFromMe ? 'out' : 'in';
    const createdAt = normalizeTimestamp(data.dateCreated).toISOString();
    const panel = '718'; // iMessage routes exclusively through the 718 line/Mac mini gateway

    const service = createServiceClient();

    // 1. Upsert thread in whatsapp_threads
    const threadRow = {
      panel,
      channel_type: 'imessage',
      phone: contactPhone,
      last_message_at: createdAt,
      last_message_preview: body.slice(0, 120),
      unread_count: direction === 'in' ? 1 : 0,
      updated_at: createdAt,
    };

    const { data: thread, error: threadErr } = await service
      .from('whatsapp_threads')
      .upsert(threadRow, { onConflict: 'panel,phone,channel_type' })
      .select('id')
      .single();

    if (threadErr || !thread) {
      console.error('[imessage-webhook] thread upsert failed:', threadErr?.message);
      return NextResponse.json({ error: 'Database thread sync failed' }, { status: 500 });
    }

    // 2. Insert message into whatsapp_messages
    const msgRow = {
      thread_id: thread.id,
      panel,
      channel_type: 'imessage',
      direction,
      body,
      timelines_uid: `imessage:${data.guid || Math.random().toString(36).substring(7)}`,
      from_phone: direction === 'in' ? contactPhone : null,
      sent_at: createdAt,
      status: 'delivered',
    };

    const { error: msgErr } = await service
      .from('whatsapp_messages')
      .upsert(msgRow, { onConflict: 'timelines_uid' });

    if (msgErr) {
      console.error('[imessage-webhook] message insert failed:', msgErr.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in iMessage Webhook:', error);
    const errMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
