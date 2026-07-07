/**
 * useEmailInbox — Real Gmail inbox data fetching
 *
 * Fetches real email data from the /api/email/inbox endpoint.
 * Supports search, thread navigation, mark read/unread.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'

interface InboxEmail {
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
}

interface EmailThread {
  threadId: string
  subject: string
  messages: InboxEmail[]
  lastMessageAt: string
  unread: boolean
  messageCount: number
  account: string
}

export function useEmailInbox(opts?: { maxResults?: number; account?: string }) {
  const [emails, setEmails] = useState<InboxEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInbox = useCallback(async (query?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (opts?.maxResults) params.set('limit', String(opts.maxResults))
      if (opts?.account) params.set('account', opts.account)

      const res = await fetch(`/api/email/inbox?${params.toString()}`)
      if (!res.ok) throw new Error(`Inbox fetch failed: ${res.status}`)

      const data = await res.json()
      setEmails(data.emails || [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [opts?.maxResults, opts?.account])

  useEffect(() => {
    fetchInbox()
  }, [fetchInbox])

  const fetchThread = useCallback(async (threadId: string): Promise<EmailThread | null> => {
    try {
      const params = new URLSearchParams()
      if (opts?.account) params.set('account', opts.account)

      const res = await fetch(`/api/email/thread/${threadId}?${params.toString()}`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [opts?.account])

  const search = useCallback(async (query: string) => {
    await fetchInbox(query)
  }, [fetchInbox])

  const markRead = useCallback(async (messageId: string) => {
    try {
      await fetch('/api/email/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      })
      // Update local state
      setEmails(prev => prev.map(e =>
        e.messageId === messageId ? { ...e, unread: false } : e,
      ))
    } catch { /* non-fatal */ }
  }, [])

  const sendEmail = useCallback(async (params: {
    to: string
    subject: string
    body: string
    threadId?: string
    inReplyTo?: string
  }) => {
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Send failed')
    }
    return res.json()
  }, [])

  return {
    emails,
    loading,
    error,
    refresh: () => fetchInbox(),
    search,
    fetchThread,
    markRead,
    sendEmail,
    unreadCount: emails.filter(e => e.unread).length,
  }
}
