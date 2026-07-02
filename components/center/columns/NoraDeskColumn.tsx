'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'

const REFETCH_MS = 30_000

interface NoraMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

interface NoraHistoryPayload {
  messages: NoraMessage[]
}

export function useColumnCount(): number {
  return 0 // Nora doesn't have a "count"
}

export default function NoraDeskColumn() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<NoraMessage[]>([])
  const [filter, setFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load history
  const historyQ = useQuery<NoraHistoryPayload>({
    queryKey: ['nora-history'],
    queryFn: async () => {
      const res = await fetch('/api/nora/history', { cache: 'no-store' })
      if (!res.ok) return { messages: [] }
      return res.json()
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: 1,
  })

  useEffect(() => {
    if (historyQ.data?.messages) {
      setMessages(historyQ.data.messages)
    }
  }, [historyQ.data])

  // Secretary asks
  const asksQ = useQuery({
    queryKey: ['secretary-asks'],
    queryFn: async () => {
      const res = await fetch('/api/secretary/asks', { cache: 'no-store' })
      if (!res.ok) return { asks: [] }
      return res.json()
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: 1,
  })

  const asks = asksQ.data?.asks ?? []

  // Chat mutation
  const chatMut = useMutation({
    mutationFn: async (query: string) => {
      const res = await fetch('/api/nora/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      return res.json()
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: 'assistant', content: data.response || data.message || 'Done.' }])
    },
    onError: (err) => {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${(err as Error).message}` }])
    },
  })

  const handleSend = useCallback(() => {
    if (!input.trim() || chatMut.isPending) return
    const msg = input.trim()
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setInput('')
    chatMut.mutate(msg)
  }, [input, chatMut])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const noApiKey = !chatMut.isPending && messages.length === 0 && historyQ.data?.messages?.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(168,85,247,0.15)' }}>
        <div style={{ color: '#A855F7', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          🧠 Nora&apos;s Desk <span style={{ fontWeight: 400, fontSize: 9, opacity: 0.6 }}>she + you</span>
        </div>
      </div>

      {/* Filter tabs for secretary items */}
      <div style={{ display: 'flex', gap: 2, padding: '4px 8px', borderBottom: '1px solid rgba(168,85,247,0.08)' }}>
        {(['all', 'overdue', 'today', 'upcoming'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: filter === f ? 'rgba(168,85,247,0.15)' : 'transparent',
              color: filter === f ? '#A855F7' : 'rgba(168,85,247,0.3)',
              fontSize: 9, fontWeight: 700, fontFamily: 'inherit', textTransform: 'uppercase',
            }}
          >{f}</button>
        ))}
      </div>

      {/* Secretary Items */}
      {asks.length > 0 && (
        <div style={{ maxHeight: 120, overflowY: 'auto', borderBottom: '1px solid rgba(168,85,247,0.08)' }}>
          <div style={{ padding: '4px 10px 2px', color: 'rgba(168,85,247,0.5)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>
            Nora + You ({asks.length})
          </div>
          {asks.slice(0, 5).map((ask: any, i: number) => (
            <div key={i} style={{
              padding: '4px 10px', borderBottom: '1px solid rgba(168,85,247,0.03)',
              color: '#F5EFD8', fontSize: 10,
            }}>
              <span style={{ fontWeight: 500 }}>{ask.title || ask.question || 'Task'}</span>
              {ask.due_at && <span style={{ color: 'rgba(168,85,247,0.4)', marginLeft: 6, fontSize: 9 }}>{new Date(ask.due_at).toLocaleDateString()}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Chat Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'rgba(168,85,247,0.25)', fontSize: 11 }}>
            {noApiKey
              ? 'No items need your attention right now.\nAsk Nora anything below.'
              : 'Ask Nora anything...'}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            padding: '6px 10px', borderRadius: 8, maxWidth: '90%',
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            background: m.role === 'user' ? 'rgba(255,204,51,0.12)' : 'rgba(168,85,247,0.08)',
            color: m.role === 'user' ? 'var(--rp-gold, #FFCC33)' : '#F5EFD8',
            fontSize: 11, lineHeight: 1.4, whiteSpace: 'pre-wrap',
          }}>
            {m.content}
          </div>
        ))}
        {chatMut.isPending && (
          <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.06)', color: 'rgba(168,85,247,0.5)', fontSize: 11, alignSelf: 'flex-start' }}>
            Nora is thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '8px 10px', borderTop: '1px solid rgba(168,85,247,0.1)',
        display: 'flex', gap: 6,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask Nora anything..."
          style={{
            flex: 1, padding: '6px 10px', borderRadius: 6,
            background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(168,85,247,0.15)',
            color: '#F5EFD8', fontSize: 11, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || chatMut.isPending}
          style={{
            padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: input.trim() ? '#A855F7' : 'rgba(168,85,247,0.1)',
            color: '#fff', fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
          }}
        >→</button>
      </div>
    </div>
  )
}
