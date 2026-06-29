/**
 * Mock Webhook Ingestion Tester
 * Runs local POST calls against target routes to verify integration schema parsing.
 * Usage: npx tsx scripts/test-webhooks.ts
 */

const BASE_URL = 'http://localhost:3000';

async function testWhatsapp() {
  console.log('📱 Sending mock WhatsApp webhook payload...');
  const payload = {
    entry: [
      {
        id: 'waba_123',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '13055550199',
                phone_number_id: 'wa_number_id_999',
              },
              contacts: [
                {
                  profile: { name: 'David Investor' },
                  wa_id: '13055550100',
                },
              ],
              messages: [
                {
                  from: '13055550100',
                  id: 'wamid.HBgLMTMwNTU1NTAxMDAVAgASGBQzQTBGRDY5MzVDQ...',
                  timestamp: '1782227524',
                  text: { body: 'Hello Gideon, interested in the Riverside deal.' },
                  type: 'text',
                },
              ],
            },
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(`${BASE_URL}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log(`✔ WhatsApp webhook test response status: ${res.status}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error('❌ WhatsApp test failed to dispatch:', msg);
  }
}

async function testSms() {
  console.log('💬 Sending mock Twilio SMS webhook payload...');
  const params = new URLSearchParams();
  params.append('From', '+13055550200');
  params.append('To', '+13057784861');
  params.append('Body', 'Checking in from SMS.');
  params.append('MessageSid', 'SM123456');

  try {
    const res = await fetch(`${BASE_URL}/api/webhooks/sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    console.log(`✔ Twilio SMS webhook test response status: ${res.status}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error('❌ SMS test failed to dispatch:', msg);
  }
}

async function run() {
  console.log('🏁 Starting Webhook Tests...');
  await testWhatsapp();
  await testSms();
  console.log('🎌 Webhook Tests Dispatch Done.');
}

run();
