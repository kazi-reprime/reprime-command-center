/**
 * Anthropic AI Provider Adapter
 * 
 * Primary AI provider. Uses Claude for chat completions with tool support.
 */

import type { GatewayCapability, ProviderAdapter, ProviderHealth, AICompletionPayload, AICompletionResponse } from '../../types'
import { healthMonitor } from '../../health-monitor'

class AnthropicAdapter implements ProviderAdapter {
  readonly id = 'anthropic'
  readonly name = 'Anthropic (Claude)'
  readonly capabilities: GatewayCapability[] = ['ai:chat', 'ai:chat:vision']
  readonly priority = 1

  isConfigured(): boolean {
    const key = process.env.ANTHROPIC_API_KEY
    return !!key && key.length > 20 && !key.includes('mock')
  }

  getHealth(): ProviderHealth {
    return healthMonitor.getHealth(this.id)
  }

  async execute<TInput, TOutput>(capability: GatewayCapability, input: TInput): Promise<TOutput> {
    if (capability === 'ai:chat' || capability === 'ai:chat:vision') {
      return this.chat(input as unknown as AICompletionPayload) as unknown as TOutput
    }
    throw new Error(`Capability ${capability} not implemented by ${this.id}`)
  }

  private async chat(payload: AICompletionPayload): Promise<AICompletionResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY!
    const model = payload.model || 'claude-haiku-4-5-20251001'

    // Convert OpenAI-style messages to Anthropic format
    const systemMsg = payload.messages.find(m => m.role === 'system')?.content || ''
    const messages = payload.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const body: Record<string, unknown> = {
      model,
      max_tokens: payload.maxTokens || 1024,
      messages,
    }
    if (systemMsg) body.system = systemMsg
    if (payload.temperature !== undefined) body.temperature = payload.temperature

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 300)}`)
    }

    const data = await res.json() as {
      content: { type: string; text?: string }[]
      model: string
      usage?: { input_tokens: number; output_tokens: number }
      stop_reason?: string
    }

    const content = data.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text || '')
      .join('\n')
      .trim()

    return {
      content,
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
      finishReason: data.stop_reason || 'end_turn',
    }
  }

  async probe(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const result = await this.chat({
        messages: [{ role: 'user', content: 'Reply with just the word "ok"' }],
        maxTokens: 10,
      })
      return result.content.length > 0
    } catch {
      return false
    }
  }
}

export const anthropicProvider = new AnthropicAdapter()
