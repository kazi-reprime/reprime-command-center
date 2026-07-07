/**
 * Timelines.ai WhatsApp Provider Adapter
 * 
 * Wraps the existing lib/timelines/client.ts with the gateway adapter interface.
 * Primary WhatsApp provider for both 305 and 718 lanes.
 */

import type { GatewayCapability, ProviderAdapter, ProviderHealth, SendWhatsAppPayload } from '../../types'
import { healthMonitor } from '../../health-monitor'

const PANEL_PHONES: Record<string, string> = {
  '305': '+13057784861',
  '718': '+17185505500',
}

class TimelinesWhatsAppAdapter implements ProviderAdapter {
  readonly id = 'timelines-whatsapp'
  readonly name = 'Timelines.ai (WhatsApp)'
  readonly capabilities: GatewayCapability[] = ['whatsapp:send', 'whatsapp:receive', 'whatsapp:media']
  readonly priority = 1

  isConfigured(): boolean {
    const key = process.env.TIMELINES_API_KEY
    return !!key && key.length > 10 && !key.includes('mock')
  }

  getHealth(): ProviderHealth {
    return healthMonitor.getHealth(this.id)
  }

  async execute<TInput, TOutput>(capability: GatewayCapability, input: TInput): Promise<TOutput> {
    switch (capability) {
      case 'whatsapp:send':
        return this.send(input as unknown as SendWhatsAppPayload) as unknown as TOutput
      default:
        throw new Error(`Capability ${capability} not implemented by ${this.id}`)
    }
  }

  private async send(payload: SendWhatsAppPayload): Promise<{ messageId: string; status: string }> {
    // Dynamic import to avoid loading timelines at module level
    const { sendMessage } = await import('@/lib/timelines/client')

    const lane = payload.lane || '305'
    const accountPhone = PANEL_PHONES[lane] || PANEL_PHONES['305']

    const result = await sendMessage({
      phone: payload.to,
      text: payload.body,
      whatsappAccountPhone: accountPhone,
    })

    return {
      messageId: String((result as unknown as Record<string, unknown>).id ?? 'sent'),
      status: 'sent',
    }
  }

  async probe(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      // Light probe: fetch first page of chats (cached in Redis)
      const { getChats } = await import('@/lib/timelines/client')
      const chats = await getChats('305', 1)
      return Array.isArray(chats)
    } catch {
      return false
    }
  }
}

export const timelinesWhatsAppProvider = new TimelinesWhatsAppAdapter()
