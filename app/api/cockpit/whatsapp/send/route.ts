import { NextRequest, NextResponse } from 'next/server';
import { logInfo, logError } from '@/lib/logging/systemLog';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, message, channelId } = body;

    if (!phone || !message) {
      return NextResponse.json({ error: 'phone and message are required' }, { status: 400 });
    }

    const cleanPhone = phone.replace(/[^+\d]/g, '');
    let sent = false;
    let sentVia = '';
    let lastError = '';

    // ── Try Timelines.ai first ──────────────────────────────────────────
    const apiKey = process.env.TIMELINES_API_KEY;
    if (apiKey && !apiKey.includes('mock')) {
      try {
        let channel = channelId || process.env.TIMELINES_CHANNEL_305 || '+13057784861';
        if (channel.includes('@')) {
          channel = '+' + channel.split('@')[0];
        }
        if (!channel.startsWith('+')) {
          channel = '+' + channel;
        }

        const res = await fetch('https://app.timelines.ai/integrations/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            phone: cleanPhone,
            text: message,
            whatsapp_account_phone: channel,
          }),
        });

        if (res.ok) {
          sent = true;
          sentVia = 'timelines';
        } else {
          const errText = await res.text();
          lastError = `Timelines: ${res.status} ${errText.slice(0, 100)}`;
          console.warn('[cockpit/whatsapp/send] Timelines failed:', lastError);
        }
      } catch (err) {
        lastError = `Timelines: ${(err as Error).message}`;
        console.warn('[cockpit/whatsapp/send] Timelines exception:', lastError);
      }
    }

    // ── Fallback: Meta Cloud API ────────────────────────────────────────
    if (!sent) {
      const metaToken = process.env.META_WA_ACCESS_TOKEN;
      const metaPhoneId = process.env.META_WA_PHONE_NUMBER_ID;

      if (metaToken && metaPhoneId && !metaToken.includes('mock')) {
        try {
          const metaTo = cleanPhone.replace(/^\+/, '');
          const metaRes = await fetch(
            `https://graph.facebook.com/v21.0/${metaPhoneId}/messages`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${metaToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: metaTo,
                type: 'text',
                text: { body: message },
              }),
            },
          );

          if (metaRes.ok) {
            sent = true;
            sentVia = 'meta-cloud';
          } else {
            const metaErr = await metaRes.text();
            lastError += ` | Meta: ${metaRes.status} ${metaErr.slice(0, 100)}`;
            console.warn('[cockpit/whatsapp/send] Meta fallback failed:', metaErr.slice(0, 200));
          }
        } catch (err) {
          lastError += ` | Meta: ${(err as Error).message}`;
        }
      } else if (!apiKey) {
        return NextResponse.json({
          success: false,
          error: 'WhatsApp not configured. Set TIMELINES_API_KEY or META_WA_ACCESS_TOKEN.',
          configured: false,
        }, { status: 503 });
      }
    }

    if (sent) {
      logInfo('whatsapp', `WhatsApp sent via ${sentVia} to ${cleanPhone}: "${message.slice(0, 50)}..."`);
      return NextResponse.json({
        success: true,
        message: `WhatsApp sent to ${cleanPhone}`,
        provider: sentVia,
      });
    }

    logError('whatsapp', `WhatsApp send failed (all providers): ${lastError}`);
    return NextResponse.json({
      success: false,
      error: lastError || 'All WhatsApp providers failed',
      providers_tried: ['timelines', 'meta-cloud'],
    }, { status: 502 });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logError('whatsapp', `WhatsApp send failed: ${errMsg}`);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
