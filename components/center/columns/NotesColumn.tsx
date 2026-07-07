'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const REFETCH_MS = 60_000

interface Note {
  id: string
  title: string
  body: string | null
  created_at: string
}

interface NotesPayload {
  notes: Note[]
}

export function useColumnCount(): number {
  const { data } = useQuery<NotesPayload>({
    queryKey: ['notes'],
    queryFn: async () => {
      const res = await fetch('/api/notes', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: 2,
  })
  return data?.notes?.length ?? 0
}

export default function NotesColumn() {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [search, setSearch] = useState('')

  const notesQ = useQuery<NotesPayload>({
    queryKey: ['notes'],
    queryFn: async () => {
      const res = await fetch('/api/notes', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: 2,
  })

  const createNote = useMutation({
    mutationFn: async (input: { title: string; body: string }) => {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      setTitle('')
      setBody('')
    },
  })

  const notes = notesQ.data?.notes ?? []
  const filtered = search
    ? notes.filter(n =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        (n.body || '').toLowerCase().includes(search.toLowerCase())
      )
    : notes

  const handleAdd = useCallback(() => {
    if (!title.trim()) return
    createNote.mutate({ title: title.trim(), body: body.trim() })
  }, [title, body, createNote])

  const timeAgo = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    if (mins < 1440) return `${Math.floor(mins / 60)}h`
    return `${Math.floor(mins / 1440)}d`
  }

  return (
    <div className="flex flex-col h-full bg-surface text-text-primary font-sans">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-baseline gap-2">
        <div className="text-accent text-xs font-black uppercase tracking-widest">
          📝 Notes
        </div>
        <span className="text-text-muted font-medium text-[10px] tracking-wider uppercase">quick capture</span>
      </div>

      {/* Add Note */}
      <div className="px-4 py-3 flex flex-col gap-2 border-b border-border bg-surface-raised/50">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Note title"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-focus transition-all placeholder:text-text-muted"
        />
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Details (optional)"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-xs focus:outline-none focus:border-accent focus:ring-2 focus:ring-focus transition-all placeholder:text-text-muted"
        />
        <button
          onClick={handleAdd}
          disabled={!title.trim() || createNote.isPending}
          className={`px-4 py-2 mt-1 rounded-lg border-none cursor-pointer text-xs font-bold transition-all ${
            title.trim() 
              ? 'bg-accent hover:bg-accent-hover text-text-primary shadow-sm hover:shadow-md' 
              : 'bg-surface-raised text-text-muted cursor-not-allowed'
          }`}
        >
          {createNote.isPending ? 'Adding...' : '+ Add note'}
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search notes..."
          className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-border text-text-primary text-xs focus:outline-none focus:border-accent focus:ring-2 focus:ring-focus transition-all placeholder:text-text-muted"
        />
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {notesQ.isLoading && (
          <div className="p-4 text-center text-text-muted text-xs font-semibold">Loading notes...</div>
        )}
        {!notesQ.isLoading && filtered.length === 0 && (
          <div className="p-6 text-center text-text-muted text-xs font-medium">
            {search ? 'No matching notes' : 'No notes yet. Capture one above.'}
          </div>
        )}
        {filtered.map(n => (
          <div 
            key={n.id} 
            className="mb-2 p-3 rounded-xl bg-surface-raised border border-border border-l-4 border-l-blue-400 shadow-sm"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-text-primary text-sm font-bold">{n.title}</span>
              <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider">{timeAgo(n.created_at)}</span>
            </div>
            {n.body && (
              <div className="text-text-secondary text-xs leading-relaxed line-clamp-2">
                {n.body}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
