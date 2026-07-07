'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { OrbPlaceholder } from '@/components/ui/OrbPlaceholder'

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
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans">
      {/* Header */}
      <div className="px-4 py-3 border-b border-purple-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OrbPlaceholder className="w-6 h-6 transform scale-75 origin-left" />
          <div className="text-purple-600 text-xs font-black uppercase tracking-widest flex items-center gap-2">
            Nora&apos;s Desk 
            <span className="font-bold text-[9px] opacity-60 px-1.5 py-0.5 bg-purple-50 rounded-md">she + you</span>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-purple-50">
        {(['all', 'overdue', 'today', 'upcoming'] as const).map(f => (
          <button 
            key={f} 
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg border-none cursor-pointer text-[9px] font-black uppercase tracking-widest transition-colors ${
              filter === f 
                ? 'bg-purple-100 text-purple-700 shadow-sm' 
                : 'bg-transparent text-slate-400 hover:bg-purple-50 hover:text-purple-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Secretary Items */}
      {asks.length > 0 && (
        <div className="max-h-[120px] overflow-y-auto border-b border-purple-50 bg-slate-50/50 p-2">
          <div className="px-2 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
            Nora + You ({asks.length})
          </div>
          <div className="flex flex-col gap-1">
            {asks.slice(0, 5).map((ask: any, i: number) => (
              <div 
                key={i} 
                className="px-3 py-2 bg-white rounded-lg border border-slate-100 shadow-sm text-[10px] flex justify-between items-center"
              >
                <span className="font-bold text-slate-700 truncate mr-2">
                  {ask.title || ask.question || 'Task'}
                </span>
                {ask.due_at && (
                  <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">
                    {new Date(ask.due_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="p-5 text-center text-slate-400 text-xs font-bold whitespace-pre-wrap">
            {noApiKey
              ? 'No items need your attention right now.\nAsk Nora anything below.'
              : 'Ask Nora anything...'}
          </div>
        )}
        
        {messages.map((m, i) => (
          <div 
            key={i} 
            className={`px-3 py-2 rounded-xl max-w-[90%] text-xs leading-relaxed whitespace-pre-wrap shadow-sm border ${
              m.role === 'user' 
                ? 'self-end bg-blue-50 text-blue-900 border-blue-100 rounded-br-none' 
                : 'self-start bg-purple-50 text-purple-900 border-purple-100 rounded-bl-none'
            }`}
          >
            {m.content}
          </div>
        ))}
        
        {chatMut.isPending && (
          <div className="self-start px-3 py-2 rounded-xl rounded-bl-none bg-purple-50 text-purple-400 border border-purple-100 text-xs font-bold shadow-sm animate-pulse">
            Nora is thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-purple-100 bg-slate-50 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask Nora anything..."
          className="flex-1 bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all shadow-sm"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || chatMut.isPending}
          className={`px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all shadow-sm ${
            input.trim() 
              ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer' 
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          →
        </button>
      </div>
    </div>
  )
}
