import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type SpeakBody = {
  text: string
  language: 'en' | 'he'
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== 'g@reprime.com') {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  const body = (await request.json()) as Partial<SpeakBody>
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const language = body.language === 'he' ? 'he' : 'en'
  if (!text) {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 })
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!voiceId || !apiKey) {
    return NextResponse.json(
      { error: 'TTS not configured' },
      { status: 500 }
    )
  }

  // eleven_flash_v2_5 is the low-latency multilingual model (~75ms model
  // latency, supports Hebrew). The previous eleven_v3 is the alpha expressive
  // model with multi-second synthesis — that was the 1-4s delay Gideon heard.
  const payload: Record<string, unknown> = {
    text,
    model_id: 'eleven_flash_v2_5',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true,
    },
  }
  // flash/turbo v2.5 are multilingual; pass the language hint for Hebrew.
  payload.language_code = language

  // /stream + optimize_streaming_latency lets bytes flow as they're synthesized;
  // a lighter mp3 (64kbps) shaves transfer time. Both cut perceived latency.
  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=4&output_format=mp3_44100_64`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify(payload),
    }
  )

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '')
    return NextResponse.json(
      { error: 'TTS upstream error', status: upstream.status, detail: errText },
      { status: 502 }
    )
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
