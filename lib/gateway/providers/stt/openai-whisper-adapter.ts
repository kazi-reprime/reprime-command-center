/**
 * OpenAI Whisper STT Provider Adapter
 * 
 * Speech-to-text using OpenAI's Whisper API.
 * Falls back from Groq Whisper (which needs GROQ_API_KEY not present).
 */

import type { GatewayCapability, ProviderAdapter, ProviderHealth, STTPayload, STTResponse } from '../../types'
import { healthMonitor } from '../../health-monitor'

class OpenAIWhisperAdapter implements ProviderAdapter {
  readonly id = 'openai-stt'
  readonly name = 'OpenAI Whisper STT'
  readonly capabilities: GatewayCapability[] = ['stt:transcribe']
  readonly priority = 2

  isConfigured(): boolean {
    const key = process.env.OPENAI_API_KEY
    return !!key && key.length > 20 && !key.includes('mock')
  }

  getHealth(): ProviderHealth {
    return healthMonitor.getHealth(this.id)
  }

  async execute<TInput, TOutput>(capability: GatewayCapability, input: TInput): Promise<TOutput> {
    if (capability === 'stt:transcribe') {
      return this.transcribe(input as unknown as STTPayload) as unknown as TOutput
    }
    throw new Error(`Capability ${capability} not implemented by ${this.id}`)
  }

  private async transcribe(payload: STTPayload): Promise<STTResponse> {
    const apiKey = process.env.OPENAI_API_KEY!

    // Convert audio to File-compatible format
    let audioBlob: Blob
    if (payload.audio instanceof Blob) {
      audioBlob = payload.audio
    } else if (payload.audio instanceof ArrayBuffer) {
      audioBlob = new Blob([new Uint8Array(payload.audio)], { type: 'audio/webm' })
    } else if (Buffer.isBuffer(payload.audio)) {
      audioBlob = new Blob([new Uint8Array(payload.audio)], { type: 'audio/webm' })
    } else {
      throw new Error('Invalid audio format')
    }

    const formData = new FormData()
    formData.append('file', new File([audioBlob], 'audio.webm', { type: audioBlob.type || 'audio/webm' }))
    formData.append('model', 'whisper-1')
    if (payload.language) {
      formData.append('language', payload.language)
    }

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`OpenAI Whisper ${res.status}: ${errText.slice(0, 200)}`)
    }

    const data = await res.json() as { text: string }
    return {
      text: data.text || '',
      language: payload.language,
    }
  }
}

export const openaiSTTProvider = new OpenAIWhisperAdapter()
