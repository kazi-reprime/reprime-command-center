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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,204,51,0.08)' }}>
        <div style={{ color: 'var(--rp-gold, #FFCC33)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          📝 Notes <span style={{ fontWeight: 400, fontSize: 9, opacity: 0.5 }}>quick capture</span>
        </div>
      </div>

      {/* Add Note */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4, borderBottom: '1px solid rgba(255,204,51,0.06)' }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Note title"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          style={{
            width: '100%', padding: '5px 8px', borderRadius: 5,
            background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,204,51,0.08)',
            color: '#F5EFD8', fontSize: 11, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Details (optional)"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          style={{
            width: '100%', padding: '5px 8px', borderRadius: 5,
            background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,204,51,0.05)',
            color: '#F5EFD8', fontSize: 10, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!title.trim() || createNote.isPending}
          style={{
            padding: '4px 12px', borderRadius: 5, border: 'none', cursor: 'pointer',
            background: title.trim() ? 'var(--rp-gold, #FFCC33)' : 'rgba(255,204,51,0.1)',
            color: title.trim() ? '#0E3470' : 'rgba(255,204,51,0.3)',
            fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
          }}
        >{createNote.isPending ? 'Adding...' : '+ Add note'}</button>
      </div>

      {/* Search */}
      <div style={{ padding: '4px 10px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search notes..."
          style={{
            width: '100%', padding: '4px 8px', borderRadius: 5,
            background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,204,51,0.05)',
            color: '#F5EFD8', fontSize: 10, fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>

      {/* Notes List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {notesQ.isLoading && (
          <div style={{ padding: 16, textAlign: 'center', color: 'rgba(255,204,51,0.3)', fontSize: 11 }}>Loading notes...</div>
        )}
        {!notesQ.isLoading && filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,204,51,0.2)', fontSize: 11 }}>
            {search ? 'No matching notes' : 'No notes yet. Capture one above.'}
          </div>
        )}
        {filtered.map(n => (
          <div key={n.id} style={{
            margin: '2px 6px', padding: '6px 10px', borderRadius: 6,
            background: 'rgba(0,0,0,0.1)', borderLeft: '2px solid rgba(255,204,51,0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#F5EFD8', fontSize: 11, fontWeight: 500 }}>{n.title}</span>
              <span style={{ color: 'rgba(255,204,51,0.25)', fontSize: 9 }}>{timeAgo(n.created_at)}</span>
            </div>
            {n.body && (
              <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: 10, marginTop: 2, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                {n.body}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
