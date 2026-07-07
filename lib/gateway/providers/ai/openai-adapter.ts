/**
 * OpenAI Provider Adapter
 * 
 * Secondary AI provider. Supports chat, vision, and embeddings.
 */

import type { GatewayCapability, ProviderAdapter, ProviderHealth, AICompletionPayload, AICompletionResponse } from '../../types'
import { healthMonitor } from '../../health-monitor'

class OpenAIAdapter implements ProviderAdapter {
  readonly id = 'openai'
  readonly name = 'OpenAI'
  readonly capabilities: GatewayCapability[] = ['ai:chat', 'ai:chat:vision', 'ai:embeddings']
  readonly priority = 2

  isConfigured(): boolean {
    const key = process.env.OPENAI_API_KEY
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
    const apiKey = process.env.OPENAI_API_KEY!
    const model = payload.model || 'gpt-4o-mini'

    const body: Record<string, unknown> = {
      model,
      max_tokens: payload.maxTokens || 1024,
      messages: payload.messages,
    }
    if (payload.temperature !== undefined) body.temperature = payload.temperature
    if (payload.tools) body.tools = payload.tools

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`)
    }

    const data = await res.json() as {
      choices: { message: { content: string; tool_calls?: unknown[] }; finish_reason: string }[]
      model: string
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }

    const choice = data.choices[0]
    return {
      content: choice?.message?.content || '',
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      toolCalls: choice?.message?.tool_calls,
      finishReason: choice?.finish_reason || 'stop',
    }
  }

  async probe(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const result = await this.chat({
        messages: [{ role: 'user', content: 'Reply with just "ok"' }],
        maxTokens: 10,
        model: 'gpt-4o-mini',
      })
      return result.content.length > 0
    } catch {
      return false
    }
  }
}

export const openaiProvider = new OpenAIAdapter()
