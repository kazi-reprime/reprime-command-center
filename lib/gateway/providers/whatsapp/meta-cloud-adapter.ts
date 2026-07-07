/**
 * Meta WhatsApp Cloud API Adapter
 * 
 * Secondary/fallback WhatsApp provider using Meta's official Cloud API.
 * Currently stubbed — activates when META_WA_ACCESS_TOKEN is set to a real value.
 */

import type { GatewayCapability, ProviderAdapter, ProviderHealth, SendWhatsAppPayload } from '../../types'
import { healthMonitor } from '../../health-monitor'

class MetaWhatsAppAdapter implements ProviderAdapter {
  readonly id = 'meta-whatsapp'
  readonly name = 'Meta WhatsApp Cloud API'
  readonly capabilities: GatewayCapability[] = ['whatsapp:send', 'whatsapp:receive', 'whatsapp:media']
  readonly priority = 10 // Lower priority — fallback only

  isConfigured(): boolean {
    const token = process.env.META_WA_ACCESS_TOKEN
    const phoneId = process.env.META_WA_PHONE_NUMBER_ID
    return !!token && !!phoneId && !token.includes('mock') && token.length > 20
  }

  getHealth(): ProviderHealth {
    return healthMonitor.getHealth(this.id)
  }

  async execute<TInput, TOutput>(capability: GatewayCapability, input: TInput): Promise<TOutput> {
    if (!this.isConfigured()) {
      throw new Error('Meta WhatsApp Cloud API not configured')
    }

    switch (capability) {
      case 'whatsapp:send':
        return this.send(input as unknown as SendWhatsAppPayload) as unknown as TOutput
      default:
        throw new Error(`Capability ${capability} not implemented by ${this.id}`)
    }
  }

  private async send(payload: SendWhatsAppPayload): Promise<{ messageId: string; status: string }> {
    const token = process.env.META_WA_ACCESS_TOKEN!
    const phoneId = process.env.META_WA_PHONE_NUMBER_ID!

    // Strip '+' from phone number for Meta API
    const to = payload.to.replace(/^\+/, '')

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: payload.body },
        }),
      },
    )

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Meta WhatsApp API ${res.status}: ${errText.slice(0, 200)}`)
    }

    const data = await res.json() as { messages?: { id: string }[] }
    return {
      messageId: data.messages?.[0]?.id ?? 'sent',
      status: 'sent',
    }
  }
}

export const metaWhatsAppProvider = new MetaWhatsAppAdapter()
