/**
 * Unified Email Inbox
 *
 * Multi-account email aggregation that returns real Gmail data.
 * Fetches threads with full message bodies, not just scores.
 */

import {
  client as gmailClient,
  configuredAccounts,
  parseFromHeader,
  type GmailAccountKey,
} from '@/lib/google/gmail'
import type { gmail_v1 } from 'googleapis'

export interface InboxEmail {
  messageId: string
  threadId: string
  from: string
  fromName: string
  to: string
  subject: string
  snippet: string
  body: string
  htmlBody: string
  receivedAt: string
  unread: boolean
  important: boolean
  hasAttachments: boolean
  hasCalendarInvite: boolean
  labels: string[]
  account: string
  inReplyTo: string | null
  references: string | null
}

export interface InboxThread {
  threadId: string
  subject: string
  messages: InboxEmail[]
  lastMessageAt: string
  unread: boolean
  messageCount: number
  account: string
}

// ── Decode base64url body parts ─────────────────────────────────────────────

function decodeBase64Url(encoded: string | null | undefined): string {
  if (!encoded) return ''
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(base64, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

function extractBody(
  payload: gmail_v1.Schema$MessagePart | undefined,
): { text: string; html: string } {
  if (!payload) return { text: '', html: '' }

  const mime = (payload.mimeType || '').toLowerCase()

  // Simple single-part message
  if (mime === 'text/plain') {
    return { text: decodeBase64Url(payload.body?.data), html: '' }
  }
  if (mime === 'text/html') {
    return { text: '', html: decodeBase64Url(payload.body?.data) }
  }

  // Multipart message — recurse into parts
  let text = ''
  let html = ''
  for (const part of payload.parts || []) {
    const partMime = (part.mimeType || '').toLowerCase()
    if (partMime === 'text/plain' && !text) {
      text = decodeBase64Url(part.body?.data)
    } else if (partMime === 'text/html' && !html) {
      html = decodeBase64Url(part.body?.data)
    } else if (partMime.startsWith('multipart/')) {
      const nested = extractBody(part)
      if (!text && nested.text) text = nested.text
      if (!html && nested.html) html = nested.html
    }
  }

  return { text, html }
}

function detectAttachments(payload: gmail_v1.Schema$MessagePart | undefined): boolean {
  if (!payload) return false
  if (payload.filename && payload.filename.length > 0 && payload.body?.attachmentId) return true
  for (const part of payload.parts || []) {
    if (detectAttachments(part)) return true
  }
  return false
}

function detectICS(payload: gmail_v1.Schema$MessagePart | undefined): boolean {
  if (!payload) return false
  const mt = (payload.mimeType || '').toLowerCase()
  if (mt.startsWith('text/calendar') || mt === 'application/ics') return true
  if (payload.filename && /\.ics$/i.test(payload.filename)) return true
  for (const p of payload.parts || []) {
    if (detectICS(p)) return true
  }
  return false
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string {
  if (!headers) return ''
  const h = headers.find(h => h.name?.toLowerCase() === name.toLowerCase())
  return h?.value || ''
}

// ── Fetch Inbox ─────────────────────────────────────────────────────────────

export async function fetchInbox(opts: {
  account?: GmailAccountKey | string
  maxResults?: number
  query?: string
  labelIds?: string[]
}): Promise<InboxEmail[]> {
  const accounts = opts.account
    ? [{ key: opts.account as GmailAccountKey, email: opts.account }]
    : configuredAccounts()

  const maxResults = Math.min(opts.maxResults || 20, 50)
  const allEmails: InboxEmail[] = []

  for (const account of accounts) {
    try {
      const gmail = gmailClient(account.key)

      // Build query
      let q = opts.query || '-in:trash -in:spam'
      if (!opts.query?.includes('in:')) {
        q = `${q} -in:trash -in:spam`
      }

      const listRes = await gmail.users.messages.list({
        userId: 'me',
        q,
        maxResults,
        labelIds: opts.labelIds,
      })

      const messageIds = listRes.data.messages || []

      // Fetch full messages in parallel (batched)
      const emails = await Promise.all(
        messageIds.slice(0, maxResults).map(async (stub) => {
          try {
            const msgRes = await gmail.users.messages.get({
              userId: 'me',
              id: stub.id!,
              format: 'full',
            })
            const data = msgRes.data
            const headers = data.payload?.headers
            const labels = data.labelIds || []
            const { name: fromName, address: fromAddress } = parseFromHeader(
              getHeader(headers, 'from'),
            )
            const { text, html } = extractBody(data.payload || undefined)

            return {
              messageId: data.id || stub.id!,
              threadId: data.threadId || stub.threadId!,
              from: fromAddress,
              fromName,
              to: getHeader(headers, 'to'),
              subject: getHeader(headers, 'subject'),
              snippet: data.snippet || '',
              body: text,
              htmlBody: html,
              receivedAt: data.internalDate
                ? new Date(Number(data.internalDate)).toISOString()
                : new Date().toISOString(),
              unread: labels.includes('UNREAD'),
              important: labels.includes('IMPORTANT'),
              hasAttachments: detectAttachments(data.payload || undefined),
              hasCalendarInvite: detectICS(data.payload || undefined),
              labels,
              account: account.email,
              inReplyTo: getHeader(headers, 'in-reply-to') || null,
              references: getHeader(headers, 'references') || null,
            } as InboxEmail
          } catch (err) {
            console.error('[unified-inbox] fetch message failed', stub.id, (err as Error).message)
            return null
          }
        }),
      )

      allEmails.push(...(emails.filter(Boolean) as InboxEmail[]))
    } catch (err) {
      console.error(`[unified-inbox] account ${account.email} failed`, (err as Error).message)
    }
  }

  // Sort by received date, newest first
  allEmails.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())

  return allEmails
}

// ── Fetch Thread ────────────────────────────────────────────────────────────

export async function fetchThread(
  threadId: string,
  account?: GmailAccountKey | string,
): Promise<InboxThread | null> {
  const accountKey = account || configuredAccounts()[0]?.key
  if (!accountKey) return null

  try {
    const gmail = gmailClient(accountKey)
    const threadRes = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    })

    const thread = threadRes.data
    if (!thread.messages?.length) return null

    const messages: InboxEmail[] = thread.messages.map(data => {
      const headers = data.payload?.headers
      const labels = data.labelIds || []
      const { name: fromName, address: fromAddress } = parseFromHeader(
        getHeader(headers, 'from'),
      )
      const { text, html } = extractBody(data.payload || undefined)

      return {
        messageId: data.id || '',
        threadId: data.threadId || threadId,
        from: fromAddress,
        fromName,
        to: getHeader(headers, 'to'),
        subject: getHeader(headers, 'subject'),
        snippet: data.snippet || '',
        body: text,
        htmlBody: html,
        receivedAt: data.internalDate
          ? new Date(Number(data.internalDate)).toISOString()
          : new Date().toISOString(),
        unread: labels.includes('UNREAD'),
        important: labels.includes('IMPORTANT'),
        hasAttachments: detectAttachments(data.payload || undefined),
        hasCalendarInvite: detectICS(data.payload || undefined),
        labels,
        account: typeof accountKey === 'string' ? accountKey : '',
        inReplyTo: getHeader(headers, 'in-reply-to') || null,
        references: getHeader(headers, 'references') || null,
      }
    })

    const subject = messages[0]?.subject || '(no subject)'
    const lastMsg = messages[messages.length - 1]

    return {
      threadId,
      subject,
      messages,
      lastMessageAt: lastMsg?.receivedAt || new Date().toISOString(),
      unread: messages.some(m => m.unread),
      messageCount: messages.length,
      account: typeof accountKey === 'string' ? accountKey : '',
    }
  } catch (err) {
    console.error('[unified-inbox] fetch thread failed', threadId, (err as Error).message)
    return null
  }
}

// ── Send / Reply ────────────────────────────────────────────────────────────

export async function sendGmailMessage(params: {
  to: string
  subject: string
  body: string
  html?: string
  cc?: string
  bcc?: string
  threadId?: string
  inReplyTo?: string
  references?: string
  account?: GmailAccountKey | string
}): Promise<{ id: string; threadId: string }> {
  const accountKey = params.account || configuredAccounts()[0]?.key
  if (!accountKey) throw new Error('No Gmail account configured')

  const gmail = gmailClient(accountKey)

  // Build RFC 2822 message
  const headers: string[] = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
  ]

  if (params.cc) headers.push(`Cc: ${params.cc}`)
  if (params.bcc) headers.push(`Bcc: ${params.bcc}`)
  if (params.inReplyTo) headers.push(`In-Reply-To: ${params.inReplyTo}`)
  if (params.references) headers.push(`References: ${params.references}`)

  if (params.html) {
    const boundary = `boundary_${Date.now()}`
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    const rawMessage = [
      ...headers,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      params.body,
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      params.html,
      `--${boundary}--`,
    ].join('\r\n')

    const encoded = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encoded,
        threadId: params.threadId,
      },
    })

    return {
      id: res.data.id || '',
      threadId: res.data.threadId || params.threadId || '',
    }
  }

  // Plain text only
  headers.push('Content-Type: text/plain; charset=utf-8')
  const rawMessage = [...headers, '', params.body].join('\r\n')
  const encoded = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encoded,
      threadId: params.threadId,
    },
  })

  return {
    id: res.data.id || '',
    threadId: res.data.threadId || params.threadId || '',
  }
}

// ── Mark Read/Unread ────────────────────────────────────────────────────────

export async function markRead(
  messageId: string,
  account?: GmailAccountKey | string,
): Promise<void> {
  const gmail = gmailClient(account || configuredAccounts()[0]?.key)
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  })
}

export async function markUnread(
  messageId: string,
  account?: GmailAccountKey | string,
): Promise<void> {
  const gmail = gmailClient(account || configuredAccounts()[0]?.key)
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { addLabelIds: ['UNREAD'] },
  })
}

// ── Search ──────────────────────────────────────────────────────────────────

export async function searchEmails(
  query: string,
  opts?: { account?: GmailAccountKey | string; maxResults?: number },
): Promise<InboxEmail[]> {
  return fetchInbox({
    query,
    account: opts?.account,
    maxResults: opts?.maxResults || 20,
  })
}
