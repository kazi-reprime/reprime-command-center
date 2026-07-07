/**
 * Email Agent — Dedicated email operations for Nora
 *
 * Tools: read_inbox, read_thread, search_emails, draft_reply, send_email, summarize_email
 * All operations hit real Gmail via the unified inbox module.
 */

import { type AgentDefinition, type AgentTool, registerAgent } from './types'

const readInbox: AgentTool = {
  name: 'read_inbox',
  description: 'Fetch the latest emails from Gmail inbox. Returns real emails with sender, subject, snippet, and body.',
  parameters: {
    limit: { type: 'number', description: 'Max emails (default 10, max 30)' },
    account: { type: 'string', description: "Gmail account key: 'fst' or 'reprime' (default: all)" },
  },
  async execute(params) {
    const { fetchInbox } = await import('@/lib/email/unified-inbox')
    const emails = await fetchInbox({
      maxResults: Math.min(Number(params.limit) || 10, 30),
      account: params.account as string | undefined,
    })
    return JSON.stringify({
      count: emails.length,
      emails: emails.map(e => ({
        messageId: e.messageId,
        threadId: e.threadId,
        from: e.from,
        fromName: e.fromName,
        subject: e.subject,
        snippet: e.snippet,
        receivedAt: e.receivedAt,
        unread: e.unread,
        important: e.important,
        hasAttachments: e.hasAttachments,
        hasCalendarInvite: e.hasCalendarInvite,
        account: e.account,
      })),
    })
  },
}

const readThread: AgentTool = {
  name: 'read_email_thread',
  description: 'Read a full email thread by its thread ID. Returns all messages in the conversation.',
  parameters: {
    thread_id: { type: 'string', description: 'Gmail thread ID' },
    account: { type: 'string', description: "Gmail account key (optional)" },
  },
  async execute(params) {
    const threadId = String(params.thread_id || '')
    if (!threadId) return JSON.stringify({ error: 'thread_id required' })

    const { fetchThread } = await import('@/lib/email/unified-inbox')
    const thread = await fetchThread(threadId, params.account as string | undefined)

    if (!thread) return JSON.stringify({ error: 'Thread not found' })

    return JSON.stringify({
      threadId: thread.threadId,
      subject: thread.subject,
      messageCount: thread.messageCount,
      messages: thread.messages.map(m => ({
        from: m.from,
        fromName: m.fromName,
        to: m.to,
        subject: m.subject,
        body: m.body.slice(0, 2000),
        receivedAt: m.receivedAt,
        unread: m.unread,
      })),
    })
  },
}

const searchEmails: AgentTool = {
  name: 'search_emails',
  description: 'Search Gmail by query. Works like Gmail search: from:, subject:, has:attachment, etc.',
  parameters: {
    query: { type: 'string', description: 'Gmail search query' },
    limit: { type: 'number', description: 'Max results (default 10)' },
  },
  async execute(params) {
    const query = String(params.query || '').trim()
    if (!query) return JSON.stringify({ error: 'query required' })

    const { searchEmails: search } = await import('@/lib/email/unified-inbox')
    const emails = await search(query, { maxResults: Number(params.limit) || 10 })
    return JSON.stringify({
      query,
      count: emails.length,
      emails: emails.map(e => ({
        from: e.from,
        fromName: e.fromName,
        subject: e.subject,
        snippet: e.snippet,
        receivedAt: e.receivedAt,
        threadId: e.threadId,
      })),
    })
  },
}

const sendEmail: AgentTool = {
  name: 'send_email',
  description: 'Send an email via Gmail. Can compose new or reply to existing thread. ALWAYS get approval first.',
  parameters: {
    to: { type: 'string', description: 'Recipient email' },
    subject: { type: 'string', description: 'Email subject' },
    body: { type: 'string', description: 'Email body text' },
    thread_id: { type: 'string', description: 'Thread ID if replying (optional)' },
    in_reply_to: { type: 'string', description: 'Message-ID of message being replied to (optional)' },
  },
  async execute(params) {
    const { sendGmailMessage } = await import('@/lib/email/unified-inbox')
    try {
      const result = await sendGmailMessage({
        to: String(params.to),
        subject: String(params.subject),
        body: String(params.body),
        threadId: params.thread_id as string | undefined,
        inReplyTo: params.in_reply_to as string | undefined,
      })
      return JSON.stringify({ success: true, messageId: result.id, threadId: result.threadId })
    } catch (err) {
      return JSON.stringify({ error: (err as Error).message })
    }
  },
}

const markEmailRead: AgentTool = {
  name: 'mark_email_read',
  description: 'Mark an email as read.',
  parameters: {
    message_id: { type: 'string', description: 'Gmail message ID' },
  },
  async execute(params) {
    const { markRead } = await import('@/lib/email/unified-inbox')
    try {
      await markRead(String(params.message_id))
      return JSON.stringify({ success: true })
    } catch (err) {
      return JSON.stringify({ error: (err as Error).message })
    }
  },
}

const emailAgent: AgentDefinition = {
  id: 'email',
  name: 'Email Agent',
  description: 'Handles all email operations — inbox, threads, search, send, reply',
  systemPrompt: `You are Nora's Email specialist. You manage Gideon's Gmail.

Your tools:
- read_inbox: Get latest emails from inbox
- read_email_thread: Read a full email conversation
- search_emails: Search Gmail (supports Gmail search syntax)
- send_email: Send or reply to an email (GET APPROVAL FIRST)
- mark_email_read: Mark an email as read

CRITICAL RULES:
1. NEVER send an email without presenting the draft to Gideon first
2. Always use tools to fetch real data — never invent email content
3. When summarizing emails, include sender, subject, key points
4. For replies, maintain the thread (use thread_id and in_reply_to)
5. Detect calendar invites and mention them
6. Note attachments when present`,
  tools: [readInbox, readThread, searchEmails, sendEmail, markEmailRead],
  canHandoffTo: ['orchestrator', 'calendar'],
  requiresApproval: true,
  maxToolRounds: 3,
}

registerAgent(emailAgent)
export { emailAgent }
