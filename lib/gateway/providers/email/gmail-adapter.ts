/**
 * Gmail Provider Adapter
 * 
 * Email send via Gmail API. Uses existing Google OAuth token refresh.
 * Primary email provider — messages appear in Gideon's Sent folder.
 */

import type { GatewayCapability, ProviderAdapter, ProviderHealth, SendEmailPayload } from '../../types'
import { healthMonitor } from '../../health-monitor'

class GmailAdapter implements ProviderAdapter {
  readonly id = 'gmail'
  readonly name = 'Gmail API'
  readonly capabilities: GatewayCapability[] = ['email:send', 'email:receive', 'email:sync']
  readonly priority = 1

  isConfigured(): boolean {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
    return !!clientId && !!clientSecret && !!refreshToken && clientId !== 'mock'
  }

  getHealth(): ProviderHealth {
    return healthMonitor.getHealth(this.id)
  }

  async execute<TInput, TOutput>(capability: GatewayCapability, input: TInput): Promise<TOutput> {
    if (capability === 'email:send') {
      return this.send(input as unknown as SendEmailPayload) as unknown as TOutput
    }
    throw new Error(`Capability ${capability} not implemented by ${this.id}`)
  }

  private async send(payload: SendEmailPayload): Promise<{ messageId: string; threadId?: string }> {
    const { sendGmailMessage } = await import('@/lib/google')

    const result = await sendGmailMessage({
      to: payload.to,
      subject: payload.subject,
      body: payload.body,
      html: payload.html,
      threadId: payload.threadId,
    })

    const data = result as { id?: string; threadId?: string }
    return {
      messageId: data.id || 'sent',
      threadId: data.threadId,
    }
  }

  async probe(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const { getGoogleAccessToken } = await import('@/lib/google')
      const token = await getGoogleAccessToken()
      return !!token
    } catch {
      return false
    }
  }
}

export const gmailProvider = new GmailAdapter()
