/**
 * Deepgram STT Adapter
 *
 * Deepgram Nova-2 for fast, accurate speech-to-text.
 * Supports streaming and Hebrew. Good fallback for Whisper.
 */

import type {
  GatewayCapability,
  ProviderAdapter,
  ProviderHealth,
  STTPayload,
  STTResponse,
} from '../../types'
import { healthMonitor } from '../../health-monitor'

class DeepgramAdapter implements ProviderAdapter {
  readonly id = 'deepgram'
  readonly name = 'Deepgram Nova'
  readonly capabilities: GatewayCapability[] = ['stt:transcribe']
  readonly priority = 5

  isConfigured(): boolean {
    const key = process.env.DEEPGRAM_API_KEY
    return !!key && key.length > 10 && !key.includes('mock')
  }

  getHealth(): ProviderHealth {
    return healthMonitor.getHealth(this.id)
  }

  async execute<TInput, TOutput>(capability: GatewayCapability, input: TInput): Promise<TOutput> {
    if (!this.isConfigured()) throw new Error('Deepgram not configured')

    if (capability === 'stt:transcribe') {
      return this.transcribe(input as unknown as STTPayload) as unknown as TOutput
    }
    throw new Error(`Capability ${capability} not implemented by ${this.id}`)
  }

  private async transcribe(payload: STTPayload): Promise<STTResponse> {
    const apiKey = process.env.DEEPGRAM_API_KEY!

    let audioBuffer: ArrayBuffer
    if (payload.audio instanceof ArrayBuffer) {
      audioBuffer = payload.audio
    } else if (payload.audio instanceof Blob) {
      audioBuffer = await payload.audio.arrayBuffer()
    } else {
      // Buffer — copy to a proper ArrayBuffer to avoid SharedArrayBuffer issues
      const buf = payload.audio as Buffer
      const uint8 = new Uint8Array(buf)
      audioBuffer = uint8.buffer as ArrayBuffer
    }

    const params = new URLSearchParams({
      model: 'nova-2',
      smart_format: 'true',
      detect_language: 'true',
    })
    if (payload.language) params.set('language', payload.language)

    const res = await fetch(
      `https://api.deepgram.com/v1/listen?${params.toString()}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': `audio/${payload.format || 'webm'}`,
        },
        body: audioBuffer,
      },
    )

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Deepgram ${res.status}: ${errText.slice(0, 300)}`)
    }

    const data = (await res.json()) as {
      results?: {
        channels?: Array<{
          alternatives?: Array<{
            transcript?: string
            confidence?: number
            words?: Array<{ start: number; end: number; word: string }>
          }>
          detected_language?: string
        }>
      }
    }

    const channel = data.results?.channels?.[0]
    const alt = channel?.alternatives?.[0]

    return {
      text: alt?.transcript || '',
      language: channel?.detected_language || payload.language,
      confidence: alt?.confidence,
    }
  }

  async probe(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const res = await fetch('https://api.deepgram.com/v1/projects', {
        headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
      })
      return res.ok
    } catch {
      return false
    }
  }
}

export const deepgramProvider = new DeepgramAdapter()
