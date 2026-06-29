import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const text = await req.text();
    const searchParams = new URLSearchParams(text);
    const params: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      params[key] = val;
    });

    const service = createServiceClient();
    
    // Resolve forward target phone from crew_members or fallback to Gideon's main number
    const { data: crew } = await service
      .from('crew_members')
      .select('phone')
      .eq('is_principal', true)
      .eq('active', true)
      .maybeSingle();

    const targetForward = crew?.phone || '+13057784861';

    // TwiML payload to route the voice call to the crew operator and start recording
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial record="record-from-answer-dual" recordingStatusCallback="/api/webhooks/voice/recording">
    <Number>${targetForward}</Number>
  </Dial>
</Response>`;

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in Twilio Voice Webhook:', error);
    const errMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
