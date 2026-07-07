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
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="m-0 text-text-primary text-2xl font-bold">Communication Inbox</h1>
          <p className="mt-1 mb-0 text-text-secondary text-xs">
            {messages.filter(m => !m.isRead).length} unread • {messages.length} total
          </p>
        </div>
        <div className="w-[260px]"><SearchInput value={search} onChange={setSearch} placeholder="Search messages..." /></div>
      </div>

      <div className="mb-4">
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

      <div className="grid gap-4" style={{ gridTemplateColumns: selectedId ? '1fr 1fr' : '1fr' }}>
        <div className="flex flex-col gap-1">
          {filtered.map(msg => (
            <div
              key={msg.id}
              onClick={() => { setSelectedId(msg.id); markRead(msg.id) }}
              className={`px-4 py-3 rounded-lg cursor-pointer transition-all ${
                selectedId === msg.id
                  ? 'bg-accent/10 border border-accent/15'
                  : msg.isRead
                    ? 'bg-surface-raised border border-border'
                    : 'bg-surface-raised/80 border border-border'
              }`}
              style={{
                borderLeft: msg.isRead ? undefined : '3px solid var(--accent)',
              }}
            >
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-1.5">
                  <span>{channelIcons[msg.channel] || '📩'}</span>
                  <span className={`text-text-primary text-xs ${msg.isRead ? 'font-medium' : 'font-bold'}`}>{msg.sender}</span>
                  {msg.priority === 'high' && <span className="text-status-error text-[0.6rem] font-semibold px-1 py-0.5 bg-status-error/10 rounded">HIGH</span>}
                </div>
                <span className="text-text-muted text-[0.6rem]">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {msg.subject && <div className="text-text-secondary text-xs mb-0.5">{msg.subject}</div>}
              <div className="text-text-muted text-[0.7rem] overflow-hidden text-ellipsis whitespace-nowrap">{msg.preview}</div>
            </div>
          ))}
          {filtered.length === 0 && <EmptyState icon="📭" title="Inbox zero!" description="No messages match your filter." />}
        </div>

        {selected && (
          <Card title={selected.sender} style={{ position: 'sticky', top: 80, alignSelf: 'flex-start' }}>
            <div className="mb-4">
              <div className="flex gap-2 text-[0.7rem] text-text-secondary mb-2">
                <span>{channelIcons[selected.channel]} {selected.channel}</span>
                <span>•</span>
                <span>{new Date(selected.createdAt).toLocaleString()}</span>
              </div>
              {selected.subject && <h3 className="text-text-primary text-sm font-semibold mb-2 mt-0">{selected.subject}</h3>}
              <p className="text-text-primary text-sm leading-relaxed m-0">{selected.preview}</p>
            </div>
            <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-lg mb-4">
              <div className="text-purple-500 text-[0.7rem] font-semibold mb-1">🧠 AI Summary</div>
              <p className="m-0 text-text-primary text-xs leading-normal">
                {selected.sender} sent a {selected.priority} priority message via {selected.channel}. {selected.subject ? `Subject: "${selected.subject}".` : ''} Consider responding within 24 hours.
              </p>
            </div>
            <div className="flex gap-1.5">
              <ActionButton label="Reply" variant="primary" onClick={() => { setShowReply(true); setReplyText('') }} />
              <ActionButton label="Forward" variant="default" onClick={() => addToast('Forward: compose a new message with the original content', 'info')} />
              <ActionButton label="Archive" variant="ghost" onClick={handleArchive} />
            </div>
          </Card>
        )}
      </div>

      {/* Reply Modal */}
      <Modal isOpen={showReply} onClose={() => setShowReply(false)} title={`Reply to ${selected?.sender || ''}`} width={500}>
        <div className="flex flex-col gap-3">
          <div className="px-3 py-2 bg-surface-hover rounded-lg text-[0.7rem] text-text-muted">
            Replying via {selected?.channel || 'email'} to {selected?.sender}
          </div>
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Type your reply..."
            rows={6}
            className="w-full p-3 bg-black/20 border border-border rounded-lg text-text-primary text-sm outline-none font-[inherit] resize-y box-border"
          />
          <div className="flex gap-2">
            <ActionButton label="Send Reply" variant="primary" size="md" onClick={handleReply} />
            <ActionButton label="Cancel" variant="ghost" size="md" onClick={() => setShowReply(false)} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
