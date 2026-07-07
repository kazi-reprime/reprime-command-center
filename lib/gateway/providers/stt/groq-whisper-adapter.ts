/**
 * Groq Whisper STT Adapter
 *
 * Ultra-fast speech-to-text using Groq's Whisper endpoint.
 * OpenAI-compatible API but 10x faster due to LPU hardware.
 */

import type {
  GatewayCapability,
  ProviderAdapter,
  ProviderHealth,
  STTPayload,
  STTResponse,
} from '../../types'
import { healthMonitor } from '../../health-monitor'

class GroqWhisperAdapter implements ProviderAdapter {
  readonly id = 'groq-whisper'
  readonly name = 'Groq Whisper'
  readonly capabilities: GatewayCapability[] = ['stt:transcribe']
  readonly priority = 2 // Prefer over OpenAI for speed

  isConfigured(): boolean {
    const key = process.env.GROQ_API_KEY
    return !!key && key.length > 10 && !key.includes('mock')
  }

  getHealth(): ProviderHealth {
    return healthMonitor.getHealth(this.id)
  }

  async execute<TInput, TOutput>(capability: GatewayCapability, input: TInput): Promise<TOutput> {
    if (!this.isConfigured()) throw new Error('Groq not configured')

    if (capability === 'stt:transcribe') {
      return this.transcribe(input as unknown as STTPayload) as unknown as TOutput
    }
    throw new Error(`Capability ${capability} not implemented by ${this.id}`)
  }

  private async transcribe(payload: STTPayload): Promise<STTResponse> {
    const apiKey = process.env.GROQ_API_KEY!

    // Convert audio to a File/Blob for FormData
    let audioBlob: Blob
    if (payload.audio instanceof Blob) {
      audioBlob = payload.audio
    } else if (payload.audio instanceof ArrayBuffer) {
      audioBlob = new Blob([payload.audio], { type: 'audio/webm' })
    } else {
      // Buffer — wrap as Uint8Array for valid BlobPart
      const buf = payload.audio as Buffer
      audioBlob = new Blob([new Uint8Array(buf)], { type: 'audio/webm' })
    }

    const formData = new FormData()
    formData.append('file', audioBlob, `audio.${payload.format || 'webm'}`)
    formData.append('model', 'whisper-large-v3-turbo')
    if (payload.language) formData.append('language', payload.language)
    formData.append('response_format', 'verbose_json')

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Groq Whisper ${res.status}: ${errText.slice(0, 300)}`)
    }

    const data = (await res.json()) as {
      text?: string
      language?: string
      segments?: Array<{ start: number; end: number; text: string }>
    }

    return {
      text: data.text || '',
      language: data.language || payload.language,
      segments: data.segments?.map(s => ({ start: s.start, end: s.end, text: s.text })),
    }
  }

  async probe(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      })
      return res.ok
    } catch {
      return false
    }
  }
}

export const groqWhisperProvider = new GroqWhisperAdapter()
