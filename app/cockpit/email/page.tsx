'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { Card, EmptyState } from '@/components/ui/shared'
import { LoadingState } from '@/components/ui/LiveStatus'
import { useToast } from '@/lib/contexts/ToastContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Send, Inbox, Reply, Eye, EyeOff, Search, AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

interface EmailMessage {
  id: string
  threadId?: string
  from: string | { name?: string; email?: string }
  to?: string
  subject: string
  snippet?: string
  body?: string
  date?: string
  internalDate?: string
  unread?: boolean
  labels?: string[]
}

interface GmailResponse {
  error?: string
  message?: string
  emails?: EmailMessage[]
}

export default function EmailPage() {
  const { addToast } = useToast()
  const qc = useQueryClient()

  // ─── Data Fetching ──────────────────────────────────────────────────────────
  const gmailQ = useQuery<{ emails: EmailMessage[]; error?: string }>({
    queryKey: ['gmail-emails'],
    queryFn: async () => {
      const res = await fetch('/api/gmail', { cache: 'no-store' })
      const data = await res.json()
      // API returns either a flat array or { error, emails, message }
      if (Array.isArray(data)) {
        return { emails: data }
      }
      if (data.error) {
        return { emails: data.emails || [], error: data.error }
      }
      return { emails: data.emails || data.data || [] }
    },
  })

  const emails = gmailQ.data?.emails ?? []
  const apiError = gmailQ.data?.error

  // ─── State ──────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [showReply, setShowReply] = useState(false)
  const [replyToEmail, setReplyToEmail] = useState<EmailMessage | null>(null)

  // Compose form
  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [sending, setSending] = useState(false)

  // Reply form
  const [replyBody, setReplyBody] = useState('')

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const getSenderName = (from: EmailMessage['from']): string => {
    if (typeof from === 'string') {
      // Extract name from "Name <email>" format
      const match = from.match(/^(.+?)\s*</)
      return match ? match[1].trim() : from.split('@')[0]
    }
    return from?.name || from?.email || 'Unknown'
  }

  const getSenderEmail = (from: EmailMessage['from']): string => {
    if (typeof from === 'string') {
      const match = from.match(/<(.+?)>/)
      return match ? match[1] : from
    }
    return from?.email || ''
  }

  const formatDate = (email: EmailMessage): string => {
    const d = email.date || email.internalDate
    if (!d) return ''
    const date = new Date(d)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatFullDate = (email: EmailMessage): string => {
    const d = email.date || email.internalDate
    if (!d) return ''
    return new Date(d).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ─── Filtered ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return emails.filter((email) => {
      const senderName = getSenderName(email.from).toLowerCase()
      const subject = (email.subject || '').toLowerCase()
      const snippet = (email.snippet || '').toLowerCase()
      const q = search.toLowerCase()

      if (search && !senderName.includes(q) && !subject.includes(q) && !snippet.includes(q)) {
        return false
      }

      if (filter === 'unread') return email.unread !== false
      if (filter === 'read') return email.unread === false
      return true
    })
  }, [emails, search, filter])

  const unreadCount = emails.filter((e) => e.unread !== false).length

  // ─── Actions ────────────────────────────────────────────────────────────────
  const markReadUnread = useCallback(
    async (messageId: string, read: boolean) => {
      try {
        const res = await fetch('/api/email/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_id: messageId, read }),
        })
        const data = await res.json()
        if (data.ok) {
          addToast(read ? 'Marked as read' : 'Marked as unread', 'success')
          qc.invalidateQueries({ queryKey: ['gmail-emails'] })
        } else if (data.error === 'needs_consent') {
          addToast('Gmail token needs re-authorization. Check Settings.', 'warning')
        } else {
          addToast(data.message || 'Failed to update', 'error')
        }
      } catch {
        addToast('Network error', 'error')
      }
    },
    [addToast, qc]
  )

  const handleSend = async () => {
    if (!composeTo.trim()) {
      addToast('Recipient is required', 'error')
      return
    }
    if (!composeSubject.trim()) {
      addToast('Subject is required', 'error')
      return
    }
    if (!composeBody.trim()) {
      addToast('Body is required', 'error')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          body: composeBody.trim(),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        addToast(`Email sent to ${composeTo}`, 'success')
        setShowCompose(false)
        setComposeTo('')
        setComposeSubject('')
        setComposeBody('')
      } else {
        addToast(data.error || data.message || 'Send failed', 'error')
      }
    } catch {
      addToast('Failed to send email', 'error')
    } finally {
      setSending(false)
    }
  }

  const handleReply = async () => {
    if (!replyBody.trim() || !replyToEmail) return

    setSending(true)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: getSenderEmail(replyToEmail.from),
          subject: `Re: ${replyToEmail.subject}`,
          body: replyBody.trim(),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        addToast(`Reply sent to ${getSenderName(replyToEmail.from)}`, 'success')
        setShowReply(false)
        setReplyBody('')
        setReplyToEmail(null)
      } else {
        addToast(data.error || data.message || 'Reply failed', 'error')
      }
    } catch {
      addToast('Failed to send reply', 'error')
    } finally {
      setSending(false)
    }
  }

  const openReply = (email: EmailMessage, e: React.MouseEvent) => {
    e.stopPropagation()
    setReplyToEmail(email)
    setReplyBody('')
    setShowReply(true)
  }

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (gmailQ.isLoading) return <LoadingState message="Loading emails..." />

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center shadow-sm">
            <Mail className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gmail</h1>
            <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              {emails.length} email{emails.length !== 1 ? 's' : ''} • {unreadCount} unread
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search emails..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
              />
            </div>
          </div>
          <button
            onClick={() => {
              setComposeTo('')
              setComposeSubject('')
              setComposeBody('')
              setShowCompose(true)
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Compose</span>
          </button>
        </div>
      </div>

      {/* Gmail Unavailable Warning */}
      {apiError === 'gmail_unavailable' && (
        <div className="flex items-center gap-3 p-4 mb-6 rounded-2xl bg-amber-50 border border-amber-100">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-amber-700">Gmail Unavailable</div>
            <div className="text-xs text-amber-600 mt-0.5">
              Could not connect to Gmail. Configure your Google credentials in Settings → Integrations.
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'all' as const, label: 'All Mail', count: emails.length, icon: <Inbox className="w-3.5 h-3.5" /> },
          { key: 'unread' as const, label: 'Unread', count: unreadCount, icon: <Eye className="w-3.5 h-3.5" /> },
          { key: 'read' as const, label: 'Read', count: emails.length - unreadCount, icon: <EyeOff className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              filter === tab.key
                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            {tab.icon}
            {tab.label}
            <span
              className={`px-1.5 py-0.5 rounded-md text-xs font-bold ${
                filter === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Email List */}
      {filtered.length === 0 ? (
        <Card className="rounded-3xl">
          <EmptyState
            icon="📧"
            title={apiError ? 'Gmail not connected' : search ? 'No emails match your search' : 'Inbox zero!'}
            description={
              apiError
                ? 'Configure Gmail integration to see your emails here.'
                : search
                ? 'Try a different search term.'
                : 'No emails to show. You\'re all caught up!'
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((email) => {
            const isExpanded = expandedId === email.id
            const senderName = getSenderName(email.from)
            const senderEmail = getSenderEmail(email.from)
            const isUnread = email.unread !== false

            return (
              <div
                key={email.id}
                onClick={() => {
                  setExpandedId(isExpanded ? null : email.id)
                  if (!isExpanded && isUnread) {
                    markReadUnread(email.id, true)
                  }
                }}
                className={`glass-card rounded-2xl transition-all duration-200 cursor-pointer group relative overflow-hidden ${
                  isExpanded ? 'ring-2 ring-blue-200 shadow-lg rounded-3xl' : 'hover:shadow-md'
                } ${isUnread ? 'border-l-4 border-l-blue-500' : ''}`}
              >
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br from-blue-50 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative z-10 p-4">
                  {/* Email header row */}
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        isUnread
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {senderName.charAt(0).toUpperCase()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span
                          className={`text-sm truncate ${
                            isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-600'
                          }`}
                        >
                          {senderName}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-400">{formatDate(email)}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-300" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </div>

                      <div
                        className={`text-sm truncate mb-1 ${
                          isUnread ? 'font-semibold text-slate-800' : 'text-slate-600'
                        }`}
                      >
                        {email.subject || '(No subject)'}
                      </div>

                      {!isExpanded && (
                        <p className="text-xs text-slate-400 truncate">{email.snippet}</p>
                      )}

                      {/* Expanded body */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          {senderEmail && (
                            <div className="text-xs text-slate-400 mb-2">
                              From: {senderName} &lt;{senderEmail}&gt;
                              {email.to && <span className="ml-2">To: {email.to}</span>}
                            </div>
                          )}
                          <div className="text-xs text-slate-400 mb-3">{formatFullDate(email)}</div>

                          <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap mb-4 max-h-64 overflow-y-auto">
                            {email.body || email.snippet || 'No content available.'}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={(e) => openReply(email, e)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-semibold hover:bg-blue-100 transition-colors border border-blue-200 cursor-pointer"
                            >
                              <Reply className="w-3.5 h-3.5" />
                              Reply
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                markReadUnread(email.id, !isUnread)
                              }}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-50 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
                            >
                              {isUnread ? (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  Mark Read
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  Mark Unread
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <div
          onClick={() => setShowCompose(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/20 backdrop-blur-md p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white/95 backdrop-blur-xl border border-white rounded-3xl overflow-hidden shadow-[0_32px_64px_-12px_rgba(15,23,42,0.15)] animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-500" />
                <h2 className="text-base font-bold text-slate-900">Compose Email</h2>
              </div>
              <button
                onClick={() => setShowCompose(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold tracking-widest text-slate-400 uppercase mb-2">
                  To <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold tracking-widest text-slate-400 uppercase mb-2">
                  Subject <span className="text-red-400">*</span>
                </label>
                <input
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Email subject"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold tracking-widest text-slate-400 uppercase mb-2">
                  Body <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your email..."
                  rows={8}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all resize-vertical"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Sending...' : 'Send Email'}
                </button>
                <button
                  onClick={() => setShowCompose(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reply Modal */}
      {showReply && replyToEmail && (
        <div
          onClick={() => setShowReply(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/20 backdrop-blur-md p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white/95 backdrop-blur-xl border border-white rounded-3xl overflow-hidden shadow-[0_32px_64px_-12px_rgba(15,23,42,0.15)] animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Reply className="w-5 h-5 text-blue-500" />
                <h2 className="text-base font-bold text-slate-900">
                  Reply to {getSenderName(replyToEmail.from)}
                </h2>
              </div>
              <button
                onClick={() => setShowReply(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {/* Original message context */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-400 mb-1">
                  Replying to: {getSenderEmail(replyToEmail.from)}
                </div>
                <div className="text-xs font-semibold text-slate-600">
                  Re: {replyToEmail.subject}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold tracking-widest text-slate-400 uppercase mb-2">
                  Your Reply
                </label>
                <textarea
                  autoFocus
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Type your reply..."
                  rows={6}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all resize-vertical"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleReply}
                  disabled={sending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Sending...' : 'Send Reply'}
                </button>
                <button
                  onClick={() => setShowReply(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
