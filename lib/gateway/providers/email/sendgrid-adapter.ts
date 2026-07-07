/**
 * SendGrid Provider Adapter
 * 
 * Fallback email provider via SendGrid API.
 */

import type { GatewayCapability, ProviderAdapter, ProviderHealth, SendEmailPayload } from '../../types'
import { healthMonitor } from '../../health-monitor'

class SendGridAdapter implements ProviderAdapter {
  readonly id = 'sendgrid'
  readonly name = 'SendGrid'
  readonly capabilities: GatewayCapability[] = ['email:send']
  readonly priority = 5

  isConfigured(): boolean {
    const key = process.env.SENDGRID_API_KEY
    return !!key && key.length > 10 && !key.includes('mock')
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

  private async send(payload: SendEmailPayload): Promise<{ messageId: string }> {
    const apiKey = process.env.SENDGRID_API_KEY!
    const fromEmail = process.env.SENDGRID_VERIFIED_SENDER || 'g@reprime-terminal.com'
    const fromName = process.env.SENDGRID_FROM_NAME || 'Gideon Gratsiani'

    const body: Record<string, unknown> = {
      personalizations: [{
        to: [{ email: payload.to }],
        ...(payload.cc ? { cc: payload.cc.split(',').map(e => ({ email: e.trim() })) } : {}),
        ...(payload.bcc ? { bcc: payload.bcc.split(',').map(e => ({ email: e.trim() })) } : {}),
      }],
      from: { email: fromEmail, name: fromName },
      subject: payload.subject,
      content: payload.html
        ? [{ type: 'text/html', value: payload.html }]
        : [{ type: 'text/plain', value: payload.body }],
    }

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`SendGrid ${res.status}: ${errText.slice(0, 200)}`)
    }

    // SendGrid returns 202 with X-Message-Id header
    const messageId = res.headers.get('X-Message-Id') || 'sent'
    return { messageId }
  }
}

export const sendgridProvider = new SendGridAdapter()
