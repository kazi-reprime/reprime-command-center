'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { OrbPlaceholder } from '@/components/ui/OrbPlaceholder'
import { useStore } from '@/lib/store/useStore'
import { useNora } from '@/hooks/useNora'

const REFETCH_MS = 30_000

export function useColumnCount(): number {
  return 0 // Nora doesn't have a "count"
}

export default function NoraDeskColumn() {
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Shared Nora state from unified hook
  const {
    messages: noraMessages,
    isLoading,
    toolTrace,
    pendingApprovals,
    sendMessage,
    approve,
    dismiss,
  } = useNora()

  const setNoraMessages = useStore(s => s.setNoraMessages)

  // Load history into store on first mount (if store only has default greeting)
  const historyQ = useQuery<{ messages: { role: string; content: string }[] }>({
    queryKey: ['nora-history'],
    queryFn: async () => {
      const res = await fetch('/api/nora/history', { cache: 'no-store' })
      if (!res.ok) return { messages: [] }
      return res.json()
    },
    staleTime: REFETCH_MS,
    retry: 1,
  })

  useEffect(() => {
    if (historyQ.data?.messages?.length && noraMessages.length <= 1) {
      setNoraMessages(historyQ.data.messages.map(m => ({
        sender: m.role === 'assistant' ? 'nora' as const : 'user' as const,
        text: m.content,
        timestamp: new Date(),
      })))
    }
  }, [historyQ.data, noraMessages.length, setNoraMessages])

  const asksQ = useQuery<{ asks: Array<{ title?: string; question?: string; due_at?: string }> }>({
    queryKey: ['secretary-asks'],
    queryFn: async () => {
      const res = await fetch('/api/secretary/asks', { cache: 'no-store' })
      if (!res.ok) return { asks: [] }
      return res.json() as Promise<{ asks: Array<{ title?: string; question?: string; due_at?: string }> }>
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: 1,
  })

  const asks = asksQ.data?.asks ?? []

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return
    const msg = input.trim()
    setInput('')
    await sendMessage(msg)
  }, [input, isLoading, sendMessage])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [noraMessages])

  return (
    <div className="flex flex-col h-full bg-surface text-text-primary font-sans">
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
                : 'bg-transparent text-text-muted hover:bg-purple-50 hover:text-purple-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Secretary Items */}
      {asks.length > 0 && (
        <div className="max-h-[120px] overflow-y-auto border-b border-purple-50 bg-surface-raised/50 p-2">
          <div className="px-2 pb-1 text-[9px] font-black uppercase tracking-widest text-text-muted">
            Nora + You ({asks.length})
          </div>
          <div className="flex flex-col gap-1">
            {asks.slice(0, 5).map((ask: { title?: string; question?: string; due_at?: string }, i: number) => (
              <div 
                key={i} 
                className="px-3 py-2 bg-surface rounded-lg border border-border shadow-sm text-[10px] flex justify-between items-center"
              >
                <span className="font-bold text-text-primary truncate mr-2">
                  {ask.title || ask.question || 'Task'}
                </span>
                {ask.due_at && (
                  <span className="text-[9px] font-bold text-text-muted whitespace-nowrap">
                    {new Date(ask.due_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages — reads from shared store via useNora() */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {noraMessages.length === 0 && (
          <div className="p-5 text-center text-text-muted text-xs font-bold whitespace-pre-wrap">
            Ask Nora anything...
          </div>
        )}
        
        {noraMessages.map((m, i) => (
          <div 
            key={i} 
            className={`px-3 py-2 rounded-xl max-w-[90%] text-xs leading-relaxed whitespace-pre-wrap shadow-sm border ${
              m.sender === 'user' 
                ? 'self-end bg-accent/10 text-accent border-accent/20 rounded-br-none' 
                : 'self-start bg-purple-50 text-purple-900 border-purple-100 rounded-bl-none'
            }`}
          >
            {/* Agent ID badge */}
            {m.sender === 'nora' && m.agentId && m.agentId !== 'orchestrator' && (
              <div className="text-[9px] text-purple-500 font-bold uppercase tracking-wider mb-1">
                via {m.agentId}
              </div>
            )}
            {m.text}
          </div>
        ))}

        {/* Tool Trace */}
        {toolTrace.length > 0 && (
          <div className="self-start px-3 py-2 rounded-lg bg-purple-50/50 border border-purple-100 text-[10px] text-purple-500">
            {toolTrace.map((t, i) => (
              <div key={i} className="flex items-center gap-1">
                <span>🔧</span>
                <span className="font-bold">{t.toolName}</span>
                <span className="opacity-40">({t.durationMs}ms)</span>
              </div>
            ))}
          </div>
        )}

        {/* Pending Approvals */}
        {pendingApprovals.map(a => (
          <div key={a.id} className="self-start px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 shadow-sm">
            <div className="text-[10px] text-amber-700 font-bold mb-1">⚠️ Approval Required</div>
            <div className="text-[11px] text-amber-900 mb-2">{a.description}</div>
            <div className="flex gap-2">
              <button onClick={() => approve(a.id)} className="px-3 py-1 rounded-md bg-green-100 border border-green-300 text-green-700 text-[10px] font-bold cursor-pointer hover:bg-green-200 transition-colors">
                ✓ Approve
              </button>
              <button onClick={() => dismiss(a.id)} className="px-3 py-1 rounded-md bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold cursor-pointer hover:bg-red-100 transition-colors">
                ✕ Cancel
              </button>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="self-start px-3 py-2 rounded-xl rounded-bl-none bg-purple-50 text-purple-400 border border-purple-100 text-xs font-bold shadow-sm animate-pulse">
            Nora is thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-purple-100 bg-surface-raised flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask Nora anything..."
          className="flex-1 bg-surface border border-border text-text-primary rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all shadow-sm"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className={`px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all shadow-sm ${
            input.trim() 
              ? 'bg-purple-600 hover:bg-purple-700 text-text-primary cursor-pointer' 
              : 'bg-surface-hover text-text-muted cursor-not-allowed'
          }`}
        >
          →
        </button>
      </div>
    </div>
  )
}
