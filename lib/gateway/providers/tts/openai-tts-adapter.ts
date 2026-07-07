/**
 * OpenAI TTS Provider Adapter
 * 
 * Fallback TTS provider using OpenAI's text-to-speech API.
 */

import type { GatewayCapability, ProviderAdapter, ProviderHealth, TTSPayload, TTSResponse } from '../../types'
import { healthMonitor } from '../../health-monitor'

class OpenAITTSAdapter implements ProviderAdapter {
  readonly id = 'openai-tts'
  readonly name = 'OpenAI TTS'
  readonly capabilities: GatewayCapability[] = ['tts:synthesize']
  readonly priority = 5

  isConfigured(): boolean {
    const key = process.env.OPENAI_API_KEY
    return !!key && key.length > 20 && !key.includes('mock')
  }

  getHealth(): ProviderHealth {
    return healthMonitor.getHealth(this.id)
  }

  async execute<TInput, TOutput>(capability: GatewayCapability, input: TInput): Promise<TOutput> {
    if (capability === 'tts:synthesize') {
      return this.synthesize(input as unknown as TTSPayload) as unknown as TOutput
    }
    throw new Error(`Capability ${capability} not implemented by ${this.id}`)
  }

  private async synthesize(payload: TTSPayload): Promise<TTSResponse> {
    const apiKey = process.env.OPENAI_API_KEY!
    const voice = payload.voice || 'alloy'
    const speed = payload.speed || 1.0

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: payload.text,
        voice,
        speed,
        response_format: 'mp3',
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`OpenAI TTS ${res.status}: ${errText.slice(0, 200)}`)
    }

    const audio = await res.arrayBuffer()
    return {
      audio,
      format: 'audio/mpeg',
    }
  }
}

export const openaiTTSProvider = new OpenAITTSAdapter()
