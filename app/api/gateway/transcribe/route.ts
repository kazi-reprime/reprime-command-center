/**
 * Gateway Voice STT API
 * 
 * Transcribes audio using the gateway's STT provider chain.
 * Replaces the direct Groq Whisper calls in VoiceShell.
 */

import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json({ error: 'audio file required' }, { status: 400 })
    }

    const language = formData.get('language') as string | null

    // Use gateway for provider routing + failover
    const { gateway } = await import('@/lib/gateway')
    const { initializeGateway } = await import('@/lib/gateway')
    await initializeGateway()

    const audioBuffer = await audioFile.arrayBuffer()

    const result = await gateway.transcribe({
      audio: audioBuffer,
      language: language || undefined,
    })

    if (result.success && result.data) {
      return NextResponse.json({
        text: result.data.text,
        language: result.data.language,
        provider: result.providerId,
      })
    }

    return NextResponse.json(
      { error: result.error || 'Transcription failed', providers_tried: result.providerChain },
      { status: 500 },
    )
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
