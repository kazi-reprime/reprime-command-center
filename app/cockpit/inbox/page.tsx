'use client'

import React, { useState } from 'react'
import { Card, ActionButton, SearchInput, TabGroup, EmptyState, Modal } from '@/components/ui/shared'
import { LoadingState } from '@/components/ui/LiveStatus'
import { useCockpitQuery, useCockpitMutation } from '@/hooks/useCockpitData'
// Seed data removed — live data only
import { useToast } from '@/lib/contexts/ToastContext'

export default function InboxPage() {
  const { addToast } = useToast()
  const messagesQ = useCockpitQuery<any[]>('messages', '/api/cockpit/messages')
  const markReadMutation = useCockpitMutation<{ id: string }>('/api/cockpit/messages', {
    method: 'PATCH',
    invalidateKeys: ['messages'],
  })

  const messages = messagesQ.data?.data ?? []
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')

  const markRead = (id: string) => markReadMutation.mutate({ id })

  const filtered = messages.filter(m => {
    if (search && !m.sender.toLowerCase().includes(search.toLowerCase()) && !m.preview.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'unread') return !m.isRead
    if (filter !== 'all' && m.channel !== filter) return false
    return true
  })

  const selected = messages.find(m => m.id === selectedId)
  const channelIcons: Record<string, string> = { email: '📧', whatsapp: '💬', sms: '📱', slack: '🔔' }

  const handleReply = async () => {
    if (!replyText.trim() || !selected) return

    if (selected.channel === 'email') {
      try {
        const res = await fetch('/api/cockpit/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: selected.sender,
            subject: `Re: ${selected.subject || 'Your message'}`,
            text: replyText,
          }),
        })
        const data = await res.json()
        if (data.success) {
          addToast(`Reply sent to ${selected.sender}`, 'success')
        } else if (data.configured === false) {
          addToast(data.error, 'warning')
        } else {
          addToast(`Send failed: ${data.error}`, 'error')
        }
      } catch (err) {
        addToast('Failed to send reply', 'error')
      }
    } else if (selected.channel === 'whatsapp') {
      try {
        const res = await fetch('/api/cockpit/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: selected.sender,
            message: replyText,
          }),
        })
        const data = await res.json()
        if (data.success) {
          addToast(`WhatsApp reply sent to ${selected.sender}`, 'success')
        } else if (data.configured === false) {
          addToast(data.error, 'warning')
        } else {
          addToast(`Send failed: ${data.error}`, 'error')
        }
      } catch (err) {
        addToast('Failed to send WhatsApp reply', 'error')
      }
    } else {
      addToast(`${selected.channel} reply is not yet configured`, 'warning')
    }

    setShowReply(false)
    setReplyText('')
  }

  const handleArchive = () => {
    if (selected) {
      addToast(`Archived message from ${selected.sender}`, 'info')
      setSelectedId(null)
    }
  }

  if (messagesQ.isLoading) return <LoadingState message="Loading messages..." />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Communication Inbox</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
            {messages.filter(m => !m.isRead).length} unread • {messages.length} total
          </p>
        </div>
        <div style={{ width: 260 }}><SearchInput value={search} onChange={setSearch} placeholder="Search messages..." /></div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <TabGroup
          tabs={[
            { key: 'all', label: 'All', count: messages.length },
            { key: 'unread', label: 'Unread', count: messages.filter(m => !m.isRead).length },
            { key: 'email', label: 'Email' },
            { key: 'whatsapp', label: 'WhatsApp' },
            { key: 'sms', label: 'SMS' },
            { key: 'slack', label: 'Slack' },
          ]}
          active={filter}
          onChange={setFilter}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedId ? '1fr 1fr' : '1fr', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {filtered.map(msg => (
            <div
              key={msg.id}
              onClick={() => { setSelectedId(msg.id); markRead(msg.id) }}
              style={{
                padding: '0.85rem 1rem', background: selectedId === msg.id ? 'rgba(255,204,51,0.08)' : msg.isRead ? 'rgba(14,52,112,0.3)' : 'rgba(14,52,112,0.5)',
                border: `1px solid ${selectedId === msg.id ? 'rgba(255,204,51,0.15)' : 'rgba(255,204,51,0.05)'}`,
                borderRadius: 8, cursor: 'pointer', transition: 'all 150ms',
                borderLeft: msg.isRead ? undefined : '3px solid #FFCC33',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>{channelIcons[msg.channel] || '📩'}</span>
                  <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: msg.isRead ? 500 : 700 }}>{msg.sender}</span>
                  {msg.priority === 'high' && <span style={{ color: '#EF4444', fontSize: '0.6rem', fontWeight: 600, padding: '0.1rem 0.3rem', background: 'rgba(239,68,68,0.1)', borderRadius: 4 }}>HIGH</span>}
                </div>
                <span style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.6rem' }}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {msg.subject && <div style={{ color: 'rgba(255,204,51,0.6)', fontSize: '0.75rem', marginBottom: '0.15rem' }}>{msg.subject}</div>}
              <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.preview}</div>
            </div>
          ))}
          {filtered.length === 0 && <EmptyState icon="📭" title="Inbox zero!" description="No messages match your filter." />}
        </div>

        {selected && (
          <Card title={selected.sender} style={{ position: 'sticky', top: 80, alignSelf: 'flex-start' }}>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', color: 'rgba(255,204,51,0.5)', marginBottom: '0.5rem' }}>
                <span>{channelIcons[selected.channel]} {selected.channel}</span>
                <span>•</span>
                <span>{new Date(selected.createdAt).toLocaleString()}</span>
              </div>
              {selected.subject && <h3 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.5rem' }}>{selected.subject}</h3>}
              <p style={{ color: '#e2e8f0', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>{selected.preview}</p>
            </div>
            <div style={{ padding: '0.75rem', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.1)', borderRadius: 8, marginBottom: '1rem' }}>
              <div style={{ color: '#A855F7', fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.25rem' }}>🧠 AI Summary</div>
              <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.75rem', lineHeight: 1.5 }}>
                {selected.sender} sent a {selected.priority} priority message via {selected.channel}. {selected.subject ? `Subject: "${selected.subject}".` : ''} Consider responding within 24 hours.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <ActionButton label="Reply" variant="primary" onClick={() => { setShowReply(true); setReplyText('') }} />
              <ActionButton label="Forward" variant="default" onClick={() => addToast('Forward: compose a new message with the original content', 'info')} />
              <ActionButton label="Archive" variant="ghost" onClick={handleArchive} />
            </div>
          </Card>
        )}
      </div>

      {/* Reply Modal */}
      <Modal isOpen={showReply} onClose={() => setShowReply(false)} title={`Reply to ${selected?.sender || ''}`} width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: 6, fontSize: '0.7rem', color: 'rgba(255,204,51,0.4)' }}>
            Replying via {selected?.channel || 'email'} to {selected?.sender}
          </div>
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Type your reply..."
            rows={6}
            style={{
              width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,204,51,0.1)', borderRadius: 8,
              color: '#fff', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit',
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <ActionButton label="Send Reply" variant="primary" size="md" onClick={handleReply} />
            <ActionButton label="Cancel" variant="ghost" size="md" onClick={() => setShowReply(false)} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
