/**
 * Gateway TTS API
 * 
 * Synthesizes speech using the gateway's TTS provider chain.
 * Returns audio/mpeg stream.
 */

import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { text?: string; voice?: string; language?: string }
    const text = body.text?.trim()

    if (!text) {
      return NextResponse.json({ error: 'text required' }, { status: 400 })
    }

    const { gateway, initializeGateway } = await import('@/lib/gateway')
    await initializeGateway()

    const result = await gateway.synthesize({
      text,
      voice: body.voice,
      language: body.language,
    })

    if (result.success && result.data) {
      return new NextResponse(result.data.audio, {
        headers: {
          'Content-Type': result.data.format || 'audio/mpeg',
          'X-Provider': result.providerId,
        },
      })
    }

    return NextResponse.json(
      { error: result.error || 'Synthesis failed', providers_tried: result.providerChain },
      { status: 500 },
    )
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }
}
