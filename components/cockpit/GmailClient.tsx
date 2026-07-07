/* eslint-disable */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

type GmailAccount = 'reprime' | 'fst'
type EmailFolder = 'INBOX' | 'SENT' | 'DRAFT' | 'SPAM' | 'TRASH'
type Email = {
  id: string
  threadId: string
  from: string
  to: string
  subject: string
  snippet: string
  body?: string
  date: string
  labels: string[]
  unread: boolean
  hasAttachment: boolean
}

const ACCOUNTS: Record<GmailAccount, { label: string; email: string; color: string; gradient: string }> = {
  reprime: { label: 'g@reprime.com', email: 'g@reprime.com', color: '#EA4335', gradient: 'linear-gradient(135deg, #EA4335, #C62828)' },
  fst: { label: 'g@floridastatetrust.com', email: 'g@floridastatetrust.com', color: '#4285F4', gradient: 'linear-gradient(135deg, #4285F4, #1A73E8)' },
}

const FOLDERS: { key: EmailFolder; label: string; icon: string }[] = [
  { key: 'INBOX', label: 'Inbox', icon: '📥' },
  { key: 'SENT', label: 'Sent', icon: '📤' },
  { key: 'DRAFT', label: 'Drafts', icon: '📝' },
  { key: 'SPAM', label: 'Spam', icon: '⚠️' },
  { key: 'TRASH', label: 'Trash', icon: '🗑️' },
]

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getInitials(name: string): string {
  const clean = name.replace(/<.*>/, '').trim()
  return clean.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

const AVATAR_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6']
function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function GmailClient() {
  const [account, setAccount] = useState<GmailAccount>('reprime')
  const [folder, setFolder] = useState<EmailFolder>('INBOX')
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [emailBody, setEmailBody] = useState('')
  const [bodyLoading, setBodyLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeSending, setComposeSending] = useState(false)
  const queryClient = useQueryClient()

  // Fetch emails via React Query (shared cache with email page)
  const emailsQ = useQuery<Email[]>({
    queryKey: ['gmail-emails', account, folder, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ account, folder })
      if (searchQuery) params.set('q', searchQuery)
      const res = await fetch(`/api/gmail?${params}`, { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) throw new Error('Gmail not authenticated. Visit /api/auth/google-oauth to connect.')
        throw new Error(`Failed to load emails (${res.status})`)
      }
      const data = await res.json()
      return (data.emails || data.messages || data || []) as Email[]
    },
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 1,
  })

  const emails = emailsQ.data ?? []
  const loading = emailsQ.isLoading
  const error = emailsQ.error ? (emailsQ.error as Error).message : ''

  // Fetch email body
  const openEmail = useCallback(async (email: Email) => {
    setSelectedEmail(email)
    setBodyLoading(true)
    setEmailBody('')
    try {
      const res = await fetch(`/api/gmail/${email.id}?account=${account}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setEmailBody(data.body || data.html || data.text || email.snippet)
      } else {
        setEmailBody(email.snippet)
      }
    } catch {
      setEmailBody(email.snippet)
    }
    setBodyLoading(false)
  }, [account])

  // Send email
  const sendEmail = async () => {
    if (!composeTo.trim() || !composeSubject.trim()) return
    setComposeSending(true)
    try {
      const res = await fetch('/api/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
          account,
        }),
      })
      if (res.ok) {
        setShowCompose(false)
        setComposeTo('')
        setComposeSubject('')
        setComposeBody('')
        queryClient.invalidateQueries({ queryKey: ['gmail-emails'] })
      }
    } catch (e) { console.error('Send failed:', e) }
    setComposeSending(false)
  }

  const unreadCount = emails.filter(e => e.unread).length

  return (
    <div style={{ display: 'flex', height: '100%', background: '#0B1426', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ── LEFT: Sidebar ─────────────────────────────────────────────── */}
      <div style={{
        width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(11,20,38,0.98)',
      }}>
        {/* Account Tabs */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 12 }}>
            <div style={{ flex: 1 }}>
              {(['reprime', 'fst'] as GmailAccount[]).map(acc => (
                <button key={acc} onClick={() => { setAccount(acc); setSelectedEmail(null) }}
                  style={{
                    width: '100%', padding: '12px 16px', border: 'none', textAlign: 'left',
                    background: account === acc ? `${ACCOUNTS[acc].color}15` : 'transparent',
                    borderLeft: account === acc ? `3px solid ${ACCOUNTS[acc].color}` : '3px solid transparent',
                    color: account === acc ? '#fff' : 'rgba(255,255,255,0.4)',
                    fontWeight: account === acc ? 700 : 500, fontSize: 12, cursor: 'pointer',
                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: account === acc ? ACCOUNTS[acc].gradient : 'rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: '#fff', fontWeight: 800,
                  }}>G</span>
                  <div>
                    <div style={{ fontSize: 11 }}>{ACCOUNTS[acc].email}</div>
                  </div>
                </button>
              ))}
            </div>
            <button 
              onClick={() => emailsQ.refetch()}
              disabled={emailsQ.isFetching}
              title="Force refresh from Google"
              style={{
                background: 'rgba(234,67,53,0.1)',
                border: '1px solid rgba(234,67,53,0.2)',
                borderRadius: 6,
                padding: '6px',
                color: '#EA4335',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ 
                display: 'inline-block',
                animation: emailsQ.isFetching ? 'spin 1s linear infinite' : 'none' 
              }}>↻</span>
            </button>
          </div>
        </div>

        {/* Compose Button */}
        <div style={{ padding: '12px 16px' }}>
          <button onClick={() => setShowCompose(true)} style={{
            width: '100%', padding: '10px 0',
            background: ACCOUNTS[account].gradient,
            border: 'none', borderRadius: 10, color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: `0 4px 12px ${ACCOUNTS[account].color}40`,
          }}>
            ✏️ Compose
          </button>
        </div>

        {/* Folders */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {FOLDERS.map(f => (
            <button key={f.key} onClick={() => { setFolder(f.key); setSelectedEmail(null) }}
              style={{
                width: '100%', padding: '10px 16px', border: 'none', textAlign: 'left',
                background: folder === f.key ? 'rgba(255,255,255,0.05)' : 'transparent',
                color: folder === f.key ? '#fff' : 'rgba(255,255,255,0.4)',
                fontWeight: folder === f.key ? 600 : 400, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'all 0.15s',
              }}>
              <span style={{ fontSize: 16 }}>{f.icon}</span>
              <span style={{ flex: 1 }}>{f.label}</span>
              {f.key === 'INBOX' && unreadCount > 0 && (
                <span style={{
                  background: ACCOUNTS[account].color, color: '#fff',
                  borderRadius: 99, padding: '1px 7px', fontSize: 10, fontWeight: 700,
                }}>{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── CENTER: Email List ────────────────────────────────────────── */}
      <div style={{
        width: 'clamp(280px, 32%, 380px)', flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
        className={selectedEmail ? 'hidden md:flex md:flex-col' : ''}
      >
        {/* Search */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 12px',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>🔍</span>
            <input
              type="text" placeholder="Search emails..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && emailsQ.refetch()}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: '#fff', fontSize: 13,
              }}
            />
          </div>
        </div>

        {/* Email List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {error ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔑</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Authentication Required</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 20 }}>{error}</div>
              <a href="/api/auth/google-oauth" style={{
                background: ACCOUNTS[account].gradient,
                color: '#fff',
                textDecoration: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                display: 'inline-block'
              }}>Connect Google Account</a>
            </div>
          ) : loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
              <div style={{ fontSize: 24, marginBottom: 8, animation: 'spin 1s linear infinite' }}>⏳</div>
              Loading emails...
            </div>
          ) : emails.length === 0 ? (
            <div style={{ 
              padding: 40, 
              textAlign: 'center', 
              color: 'rgba(255,255,255,0.3)', 
              fontSize: 13,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16
            }}>
              <div style={{ fontSize: 48, opacity: 0.2 }}>📩</div>
              <div>
                <div style={{ fontWeight: 700, color: '#fff', marginBottom: 4 }}>Inbox is empty</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>No emails found in {folder.toLowerCase()}.</div>
              </div>
              <button 
                onClick={() => emailsQ.refetch()}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '8px 20px',
                  color: 'rgba(255,255,255,0.5)',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Refresh
              </button>
            </div>
          ) : emails.map(email => (

            <div key={email.id}
              onClick={() => openEmail(email)}
              style={{
                padding: '12px 16px', cursor: 'pointer',
                background: selectedEmail?.id === email.id ? `${ACCOUNTS[account].color}10` : 'transparent',
                borderLeft: selectedEmail?.id === email.id ? `3px solid ${ACCOUNTS[account].color}` : '3px solid transparent',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                transition: 'background 0.15s',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{
                  color: email.unread ? '#fff' : 'rgba(255,255,255,0.6)',
                  fontSize: 13, fontWeight: email.unread ? 700 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1, marginRight: 8,
                }}>
                  {email.from.replace(/<.*>/, '').trim() || email.from}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, flexShrink: 0 }}>
                  {timeAgo(email.date)}
                </span>
              </div>
              <div style={{
                color: email.unread ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.45)',
                fontSize: 12, fontWeight: email.unread ? 600 : 400,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginBottom: 2,
              }}>
                {email.subject || '(no subject)'}
              </div>
              <div style={{
                color: 'rgba(255,255,255,0.25)', fontSize: 11,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {email.snippet}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {email.unread && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACCOUNTS[account].color }} />
                )}
                {email.hasAttachment && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>📎</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Email Body / Compose ───────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {showCompose ? (
          /* Compose Window */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 16, fontWeight: 700 }}>New Email</h3>
              <button onClick={() => setShowCompose(false)} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18,
              }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <input placeholder="To" value={composeTo} onChange={e => setComposeTo(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none',
                }} />
              <input placeholder="Subject" value={composeSubject} onChange={e => setComposeSubject(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none',
                }} />
              <textarea placeholder="Write your email..." value={composeBody} onChange={e => setComposeBody(e.target.value)}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, padding: '14px', color: '#fff', fontSize: 13,
                  outline: 'none', resize: 'none', fontFamily: 'inherit',
                }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCompose(false)} style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '8px 20px', color: 'rgba(255,255,255,0.5)',
                  fontSize: 13, cursor: 'pointer',
                }}>Cancel</button>
                <button onClick={sendEmail} disabled={composeSending} style={{
                  background: ACCOUNTS[account].gradient, border: 'none',
                  borderRadius: 8, padding: '8px 24px', color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: composeSending ? 'wait' : 'pointer',
                  opacity: composeSending ? 0.5 : 1,
                }}>
                  {composeSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        ) : selectedEmail ? (
          /* Email View */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(14,52,112,0.3)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 16, fontWeight: 700 }}>
                  {selectedEmail.subject || '(no subject)'}
                </h2>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button title="Reply" style={{
                    background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8,
                    width: 32, height: 32, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14,
                  }}>↩️</button>
                  <button title="Forward" style={{
                    background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8,
                    width: 32, height: 32, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14,
                  }}>➡️</button>
                  <button title="Delete" style={{
                    background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8,
                    width: 32, height: 32, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14,
                  }}>🗑️</button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: avatarColor(selectedEmail.from),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 12, fontWeight: 700,
                }}>{getInitials(selectedEmail.from)}</div>
                <div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                    {selectedEmail.from.replace(/<.*>/, '').trim()}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                    to {selectedEmail.to || 'me'} • {new Date(selectedEmail.date).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '20px 24px',
              color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.7,
            }}>
              {bodyLoading ? (
                <div style={{ color: 'rgba(255,255,255,0.3)' }}>Loading email...</div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: emailBody }} />
              )}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div style={{ fontSize: 64, opacity: 0.3 }}>📧</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 15, fontWeight: 600 }}>
              Select an email to read
            </div>
            <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>
              {ACCOUNTS[account].email}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
