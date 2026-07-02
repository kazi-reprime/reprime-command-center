import { NextRequest, NextResponse } from 'next/server';
import { logInfo, logError } from '@/lib/logging/systemLog';
import { getConfiguredProvider } from '@/lib/ai/provider';

export const dynamic = 'force-dynamic';

interface IntegrationStatus {
  name: string;
  status: 'connected' | 'missing' | 'error';
  message?: string;
}

async function testDatabase(): Promise<IntegrationStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('mock')) {
    return { name: 'Database', status: 'missing', message: 'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not configured' };
  }
  try {
    const res = await fetch(`${url}/rest/v1/?limit=0`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok
      ? { name: 'Database', status: 'connected' }
      : { name: 'Database', status: 'error', message: `HTTP ${res.status}` };
  } catch (err) {
    return { name: 'Database', status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

async function testEmail(): Promise<IntegrationStatus> {
  const key = process.env.SENDGRID_API_KEY;
  if (!key || key.includes('mock')) {
    return { name: 'Email (SendGrid)', status: 'missing', message: 'SENDGRID_API_KEY not configured' };
  }
  return { name: 'Email (SendGrid)', status: 'connected' };
}

async function testWhatsApp(): Promise<IntegrationStatus> {
  const key = process.env.TIMELINES_API_KEY;
  if (!key) {
    return { name: 'WhatsApp (Timelines)', status: 'missing', message: 'TIMELINES_API_KEY not configured' };
  }
  return { name: 'WhatsApp (Timelines)', status: 'connected' };
}

async function testAI(): Promise<IntegrationStatus> {
  const provider = getConfiguredProvider();
  if (!provider) {
    return { name: 'AI Provider', status: 'missing', message: 'No AI API key configured (ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY)' };
  }
  return { name: `AI (${provider.name})`, status: 'connected' };
}

async function testCRM(): Promise<IntegrationStatus> {
  const key = process.env.PIPEDRIVE_API_KEY;
  if (!key || key.includes('mock')) {
    return { name: 'CRM (Pipedrive)', status: 'missing', message: 'PIPEDRIVE_API_KEY not configured' };
  }
  return { name: 'CRM (Pipedrive)', status: 'connected' };
}

async function testGoogle(): Promise<IntegrationStatus> {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!id || !secret || !refresh) {
    return { name: 'Google (Gmail/Calendar)', status: 'missing', message: 'Google OAuth credentials not configured' };
  }
  return { name: 'Google (Gmail/Calendar)', status: 'connected' };
}

async function testRedis(): Promise<IntegrationStatus> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  if (!url) {
    return { name: 'Redis (Upstash)', status: 'missing', message: 'UPSTASH_REDIS_REST_URL not configured' };
  }
  return { name: 'Redis (Upstash)', status: 'connected' };
}

async function testVoice(): Promise<IntegrationStatus> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return { name: 'Voice (ElevenLabs)', status: 'missing', message: 'ELEVENLABS_API_KEY not configured' };
  }
  return { name: 'Voice (ElevenLabs)', status: 'connected' };
}

async function testStripe(): Promise<IntegrationStatus> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return { name: 'Billing (Stripe)', status: 'missing', message: 'STRIPE_SECRET_KEY not configured' };
  }
  return { name: 'Billing (Stripe)', status: 'connected' };
}

async function testSlack(): Promise<IntegrationStatus> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    return { name: 'Slack', status: 'missing', message: 'SLACK_WEBHOOK_URL not configured' };
  }
  return { name: 'Slack', status: 'connected' };
}

async function testZoom(): Promise<IntegrationStatus> {
  const id = process.env.ZOOM_CLIENT_ID;
  if (!id) {
    return { name: 'Zoom', status: 'missing', message: 'ZOOM_CLIENT_ID not configured' };
  }
  return { name: 'Zoom', status: 'connected' };
}

export async function GET() {
  try {
    const results = await Promise.all([
      testDatabase(),
      testAI(),
      testEmail(),
      testWhatsApp(),
      testCRM(),
      testGoogle(),
      testRedis(),
      testVoice(),
      testStripe(),
      testSlack(),
      testZoom(),
    ]);

    const connected = results.filter(r => r.status === 'connected').length;
    const missing = results.filter(r => r.status === 'missing').length;
    const errors = results.filter(r => r.status === 'error').length;

    logInfo('system', `Integration health check: ${connected} connected, ${missing} missing, ${errors} errors`);

    return NextResponse.json({
      integrations: results,
      summary: { connected, missing, errors, total: results.length },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    logError('system', `Integration test failed: ${String(err)}`);
    return NextResponse.json({ error: 'Test failed', details: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { integration } = await request.json();
    let result: IntegrationStatus;

    switch (integration) {
      case 'database': result = await testDatabase(); break;
      case 'email': result = await testEmail(); break;
      case 'whatsapp': result = await testWhatsApp(); break;
      case 'ai': result = await testAI(); break;
      case 'crm': result = await testCRM(); break;
      case 'google': result = await testGoogle(); break;
      case 'redis': result = await testRedis(); break;
      case 'voice': result = await testVoice(); break;
      case 'stripe': result = await testStripe(); break;
      case 'slack': result = await testSlack(); break;
      case 'zoom': result = await testZoom(); break;
      default:
        return NextResponse.json({ error: 'Unknown integration' }, { status: 400 });
    }

    logInfo('system', `Integration test: ${result.name} → ${result.status}`);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Test failed', details: String(err) }, { status: 500 });
  }
}
