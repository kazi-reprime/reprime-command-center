/**
 * OpenRouter AI Provider Adapter
 *
 * Meta-provider that routes to 100+ models. Ultimate fallback
 * when primary providers (Anthropic, OpenAI, Gemini, Groq) fail.
 * Also supports DeepSeek, xAI/Grok, Qwen, and local models.
 */

import type {
  GatewayCapability,
  ProviderAdapter,
  ProviderHealth,
  AICompletionPayload,
  AICompletionResponse,
} from '../../types'
import { healthMonitor } from '../../health-monitor'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

class OpenRouterAdapter implements ProviderAdapter {
  readonly id = 'openrouter'
  readonly name = 'OpenRouter'
  readonly capabilities: GatewayCapability[] = ['ai:chat', 'ai:chat:vision']
  readonly priority = 50 // Last resort

  isConfigured(): boolean {
    const key = process.env.OPENROUTER_API_KEY
    return !!key && key.length > 10 && !key.includes('mock')
  }

  getHealth(): ProviderHealth {
    return healthMonitor.getHealth(this.id)
  }

  async execute<TInput, TOutput>(capability: GatewayCapability, input: TInput): Promise<TOutput> {
    if (!this.isConfigured()) throw new Error('OpenRouter not configured')

    switch (capability) {
      case 'ai:chat':
      case 'ai:chat:vision':
        return this.chat(input as unknown as AICompletionPayload) as unknown as TOutput
      default:
        throw new Error(`Capability ${capability} not implemented by ${this.id}`)
    }
  }

  private async chat(payload: AICompletionPayload): Promise<AICompletionResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY!
    // Default to a good general-purpose model; callers can override
    const model = payload.model || 'anthropic/claude-sonnet-4'

    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://reprime.com',
        'X-Title': 'RePrime Command Center',
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
      throw new Error(`OpenRouter API ${res.status}: ${errText.slice(0, 300)}`)
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
      const res = await fetch(`${OPENROUTER_BASE}/models`, {
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      })
      return res.ok
    } catch {
      return false
    }
  }
}

export const openRouterProvider = new OpenRouterAdapter()
