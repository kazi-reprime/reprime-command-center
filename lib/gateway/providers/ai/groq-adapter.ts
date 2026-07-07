/**
 * Groq AI Provider Adapter
 *
 * Ultra-fast inference via Groq's LPU hardware.
 * OpenAI-compatible API. Great for latency-sensitive operations.
 */

import type {
  GatewayCapability,
  ProviderAdapter,
  ProviderHealth,
  AICompletionPayload,
  AICompletionResponse,
} from '../../types'
import { healthMonitor } from '../../health-monitor'

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

class GroqAdapter implements ProviderAdapter {
  readonly id = 'groq'
  readonly name = 'Groq (LPU)'
  readonly capabilities: GatewayCapability[] = ['ai:chat']
  readonly priority = 12

  isConfigured(): boolean {
    const key = process.env.GROQ_API_KEY
    return !!key && key.length > 10 && !key.includes('mock')
  }

  getHealth(): ProviderHealth {
    return healthMonitor.getHealth(this.id)
  }

  async execute<TInput, TOutput>(capability: GatewayCapability, input: TInput): Promise<TOutput> {
    if (!this.isConfigured()) throw new Error('Groq not configured')

    switch (capability) {
      case 'ai:chat':
        return this.chat(input as unknown as AICompletionPayload) as unknown as TOutput
      default:
        throw new Error(`Capability ${capability} not implemented by ${this.id}`)
    }
  }

  private async chat(payload: AICompletionPayload): Promise<AICompletionResponse> {
    const apiKey = process.env.GROQ_API_KEY!
    const model = payload.model || 'llama-3.3-70b-versatile'

    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: payload.messages,
        max_tokens: payload.maxTokens || 1024,
        temperature: payload.temperature ?? 0.7,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Groq API ${res.status}: ${errText.slice(0, 300)}`)
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      model?: string
    }

    const choice = data.choices?.[0]
    return {
      content: choice?.message?.content || '',
      model: data.model || model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : undefined,
      finishReason: choice?.finish_reason || 'stop',
    }
  }

  async probe(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const res = await fetch(`${GROQ_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      })
      return res.ok
    } catch {
      return false
    }
  }
}

export const groqProvider = new GroqAdapter()
