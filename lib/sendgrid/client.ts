const SEND_URL = 'https://api.sendgrid.com/v3/mail/send'

export interface SendEmailAttachment {
  content: string
  filename: string
  type?: string
  disposition?: 'attachment' | 'inline'
  contentId?: string
}

export interface SendEmailInput {
  to: string | string[]
  from: string
  /** Display name on the From header. Falls back to env SENDGRID_FROM_NAME, then "Gideon Gratsiani". */
  fromName?: string
  subject: string
  text?: string
  html?: string
  replyTo?: string
  replyToName?: string
  cc?: string | string[]
  bcc?: string | string[]
  attachments?: SendEmailAttachment[]
}

function asAddressList(v: string | string[] | undefined): { email: string }[] | undefined {
  if (!v) return undefined
  const list = Array.isArray(v) ? v : [v]
  return list.map((email) => ({ email }))
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey) throw new Error('SENDGRID_API_KEY is not set')

  const content: Array<{ type: string; value: string }> = []
  if (input.text) content.push({ type: 'text/plain', value: input.text })
  if (input.html) content.push({ type: 'text/html', value: input.html })
  if (content.length === 0) throw new Error('sendEmail requires text or html')

  const personalization: Record<string, unknown> = {
    to: asAddressList(input.to),
  }
  const cc = asAddressList(input.cc)
  if (cc) personalization.cc = cc
  const bcc = asAddressList(input.bcc)
  if (bcc) personalization.bcc = bcc

  // Captain hotfix 2026-05-20: ALWAYS include a friendly display name so
  // Gmail/Outlook/Apple Mail show "Gideon Gratsiani" in the inbox From column
  // instead of extracting the bare local-part "g" from the address. Falls
  // back to env var then to a sensible default. Also helps with deliverability
  // — anti-spam heuristics flag mailers with no display name more aggressively.
  const fromName =
    (input.fromName?.trim()) ||
    (process.env.SENDGRID_FROM_NAME?.trim()) ||
    'Gideon Gratsiani'
  const body: Record<string, unknown> = {
    personalizations: [personalization],
    from: { email: input.from, name: fromName },
    subject: input.subject,
    content,
  }
  if (input.replyTo) {
    body.reply_to = input.replyToName
      ? { email: input.replyTo, name: input.replyToName }
      : { email: input.replyTo, name: fromName }
  }
  if (input.attachments && input.attachments.length > 0) {
    body.attachments = input.attachments.map((a) => ({
      content: a.content,
      filename: a.filename,
      type: a.type ?? 'application/octet-stream',
      disposition: a.disposition ?? 'attachment',
      ...(a.contentId ? { content_id: a.contentId } : {}),
    }))
  }

  const res = await fetch(SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`SendGrid send failed: ${res.status} ${await res.text()}`)
  }
}
