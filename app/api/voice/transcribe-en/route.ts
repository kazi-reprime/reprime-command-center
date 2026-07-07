import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== 'g@reprime.com') {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  const form = await request.formData()
  const audio = form.get('audio')
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: 'Missing audio file' }, { status: 400 })
  }

  // Groq Whisper Large v3 is ~10x faster than OpenAI Whisper (~300ms vs 2-4s).
  // Uses the existing openai SDK pointed at Groq's OpenAI-compatible endpoint —
  // no extra package needed. Falls back to OpenAI if GROQ_API_KEY is absent.
  const useGroq = !!process.env.GROQ_API_KEY
  const client = useGroq
    ? new OpenAI({ apiKey: process.env.GROQ_API_KEY!, baseURL: 'https://api.groq.com/openai/v1' })
    : new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  const result = await client.audio.transcriptions.create({
    file: audio,
    model: useGroq ? 'whisper-large-v3' : 'whisper-1',
    language: 'en',
    response_format: 'json',
  })

  return NextResponse.json({ text: result.text, language: 'en', rtl: false })
}
