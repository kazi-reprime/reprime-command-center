/**
 * ElevenLabs TTS Provider Adapter
 * 
 * Primary TTS provider using ElevenLabs Flash v2.5 for low-latency synthesis.
 */

import type { GatewayCapability, ProviderAdapter, ProviderHealth, TTSPayload, TTSResponse } from '../../types'
import { healthMonitor } from '../../health-monitor'

class ElevenLabsTTSAdapter implements ProviderAdapter {
  readonly id = 'elevenlabs-tts'
  readonly name = 'ElevenLabs TTS'
  readonly capabilities: GatewayCapability[] = ['tts:synthesize']
  readonly priority = 1

  isConfigured(): boolean {
    const key = process.env.ELEVENLABS_API_KEY
    return !!key && key.length > 10 && !key.includes('mock')
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
    const apiKey = process.env.ELEVENLABS_API_KEY!
    const voiceId = payload.voice || process.env.ELEVENLABS_VOICE_ID || 'XrExE9yKIg1WjnnlVkGX'
    const model = payload.model || process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5'

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: payload.text,
        model_id: model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`ElevenLabs TTS ${res.status}: ${errText.slice(0, 200)}`)
    }

    const audio = await res.arrayBuffer()
    return {
      audio,
      format: 'audio/mpeg',
    }
  }

  async probe(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      // Check remaining character quota
      const apiKey = process.env.ELEVENLABS_API_KEY!
      const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
        headers: { 'xi-api-key': apiKey },
      })
      return res.ok
    } catch {
      return false
    }
  }
}

export const elevenLabsTTSProvider = new ElevenLabsTTSAdapter()
