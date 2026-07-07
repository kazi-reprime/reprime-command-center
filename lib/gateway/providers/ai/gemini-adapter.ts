/**
 * Google Gemini AI Provider Adapter
 *
 * Uses @ai-sdk/google (already in deps). Provides ai:chat capability
 * as an alternative to Anthropic/OpenAI for multi-model routing.
 */

import type {
  GatewayCapability,
  ProviderAdapter,
  ProviderHealth,
  AICompletionPayload,
  AICompletionResponse,
} from '../../types'
import { healthMonitor } from '../../health-monitor'

class GeminiAdapter implements ProviderAdapter {
  readonly id = 'gemini'
  readonly name = 'Google Gemini'
  readonly capabilities: GatewayCapability[] = ['ai:chat', 'ai:chat:vision', 'ai:embeddings']
  readonly priority = 15

  isConfigured(): boolean {
    const key = process.env.GEMINI_API_KEY
    return !!key && key.length > 10 && !key.includes('mock')
  }

  getHealth(): ProviderHealth {
    return healthMonitor.getHealth(this.id)
  }

  async execute<TInput, TOutput>(capability: GatewayCapability, input: TInput): Promise<TOutput> {
    if (!this.isConfigured()) throw new Error('Gemini not configured')

    switch (capability) {
      case 'ai:chat':
      case 'ai:chat:vision':
        return this.chat(input as unknown as AICompletionPayload) as unknown as TOutput
      default:
        throw new Error(`Capability ${capability} not implemented by ${this.id}`)
    }
  }

  private async chat(payload: AICompletionPayload): Promise<AICompletionResponse> {
    const apiKey = process.env.GEMINI_API_KEY!
    const model = payload.model || 'gemini-2.0-flash'

    // Convert messages to Gemini format
    const systemMsg = payload.messages.find(m => m.role === 'system')
    const chatMessages = payload.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

    const body: Record<string, unknown> = {
      contents: chatMessages,
      generationConfig: {
        maxOutputTokens: payload.maxTokens || 1024,
        temperature: payload.temperature ?? 0.7,
      },
    }

    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] }
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 300)}`)
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
        finishReason?: string
      }>
      usageMetadata?: {
        promptTokenCount?: number
        candidatesTokenCount?: number
        totalTokenCount?: number
      }
    }

    const candidate = data.candidates?.[0]
    const text = candidate?.content?.parts?.map(p => p.text).join('') || ''

    return {
      content: text,
      model,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount || 0,
            completionTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
      finishReason: candidate?.finishReason || 'stop',
    }
  }

  async probe(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
      )
      return res.ok
    } catch {
      return false
    }
  }
}

export const geminiProvider = new GeminiAdapter()
