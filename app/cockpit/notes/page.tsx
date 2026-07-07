/* eslint-disable */
'use client'

import React, { useState, useMemo } from 'react'
import { Card, EmptyState, ActionButton, SearchInput, Modal } from '@/components/ui/shared'
import { LoadingState } from '@/components/ui/LiveStatus'
import { useToast } from '@/lib/contexts/ToastContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Trash2, Edit3, Clock, Pin, Search } from 'lucide-react'

interface Note {
  id: string
  title: string
  body: string
  is_pinned: boolean
  created_at: string
  updated_at: string
}

interface NotesPayload {
  notes: Note[]
}

export default function NotesPage() {
  const { addToast } = useToast()
  const qc = useQueryClient()

  // ─── Data Fetching ──────────────────────────────────────────────────────────
  const notesQ = useQuery<NotesPayload>({
    queryKey: ['notes'],
    queryFn: async () => {
      const res = await fetch('/api/notes', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch notes')
      return res.json()
    },
  })

  const notes = useMemo(() => notesQ.data?.notes ?? [], [notesQ.data?.notes])

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (input: { title: string; body: string }) => {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Create failed')
      }
      return res.json()
    },
    onSuccess: () => {
      addToast('Note created successfully', 'success')
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; title: string; body: string }) => {
      const res = await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Update failed')
      }
      return res.json()
    },
    onSuccess: () => {
      addToast('Note updated', 'success')
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Delete failed')
      return res.json()
    },
    onSuccess: () => {
      addToast('Note deleted', 'success')
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  // ─── State ──────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [editId, setEditId] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')

  // ─── Derived ────────────────────────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      notes.filter(
        (n) =>
          !search ||
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.body.toLowerCase().includes(search.toLowerCase())
      ),
    [notes, search]
  )

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleCreate = () => {
    if (!newTitle.trim()) {
      addToast('Title is required', 'error')
      return
    }
    createMutation.mutate({ title: newTitle.trim(), body: newBody })
    setShowCreate(false)
    setNewTitle('')
    setNewBody('')
  }

  const handleEdit = (note: Note) => {
    setEditId(note.id)
    setEditTitle(note.title)
    setEditBody(note.body)
    setShowEdit(true)
  }

  const handleUpdate = () => {
    if (!editTitle.trim()) {
      addToast('Title is required', 'error')
      return
    }
    updateMutation.mutate({ id: editId, title: editTitle.trim(), body: editBody })
    setShowEdit(false)
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('Delete this note?')) {
      deleteMutation.mutate(id)
      if (expandedId === id) setExpandedId(null)
    }
  }

  const formatDate = (d: string) => {
    const date = new Date(d)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (notesQ.isLoading) return <LoadingState message="Loading notes..." />

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-sm">
              <FileText className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">Notes</h1>
              <p className="text-xs font-bold tracking-widest text-text-muted uppercase">
                {notes.length} note{notes.length !== 1 ? 's' : ''} total
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus focus:border-accent transition-all"
              />
            </div>
          </div>
          <button
            onClick={() => {
              setNewTitle('')
              setNewBody('')
              setShowCreate(true)
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-text-primary text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      {filtered.length === 0 ? (
        <Card className="rounded-3xl">
          <EmptyState
            icon="📝"
            title={search ? 'No notes match your search' : 'No notes yet'}
            description={search ? 'Try a different search term.' : 'Create your first note to get started.'}
            action={
              !search ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-text-primary text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Create Note
                </button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((note) => {
            const isExpanded = expandedId === note.id
            const bodyPreview = note.body.length > 120 ? note.body.slice(0, 120) + '…' : note.body

            return (
              <div
                key={note.id}
                onClick={() => setExpandedId(isExpanded ? null : note.id)}
                className={`glass-card rounded-3xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg group relative overflow-hidden ${
                  isExpanded ? 'ring-2 ring-blue-200 shadow-lg' : ''
                }`}
              >
                {/* Decorative gradient */}
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br from-blue-50 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative z-10">
                  {/* Title Row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="w-4 h-4 text-accent shrink-0" />
                      <h3 className="text-sm font-bold text-text-primary truncate">{note.title}</h3>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(note)
                        }}
                        className="p-1.5 rounded-lg hover:bg-accent/10 text-text-muted hover:text-accent transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(note.id, e)}
                        className="p-1.5 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <p className={`text-sm text-text-secondary leading-relaxed mb-4 ${isExpanded ? '' : 'line-clamp-3'}`}>
                    {isExpanded ? note.body || 'No content' : bodyPreview || 'No content'}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(note.updated_at || note.created_at)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Note Modal */}
      {showCreate && (
        <div
          onClick={() => setShowCreate(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-surface/20 backdrop-blur-md p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-surface/95 backdrop-blur-xl border border-border rounded-3xl overflow-hidden shadow-[0_32px_64px_-12px_rgba(15,23,42,0.15)] animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-accent" />
                <h2 className="text-base font-bold text-text-primary">Create New Note</h2>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="text-text-muted hover:text-text-secondary text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold tracking-widest text-text-muted uppercase mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Note title"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus focus:border-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold tracking-widest text-text-muted uppercase mb-2">
                  Content
                </label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Write your note..."
                  rows={6}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus focus:border-accent transition-all resize-vertical"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-text-primary text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Note'}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-5 py-2.5 rounded-xl bg-surface-raised hover:bg-surface-hover text-text-secondary text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Note Modal */}
      {showEdit && (
        <div
          onClick={() => setShowEdit(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-surface/20 backdrop-blur-md p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-surface/95 backdrop-blur-xl border border-border rounded-3xl overflow-hidden shadow-[0_32px_64px_-12px_rgba(15,23,42,0.15)] animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-accent" />
                <h2 className="text-base font-bold text-text-primary">Edit Note</h2>
              </div>
              <button
                onClick={() => setShowEdit(false)}
                className="text-text-muted hover:text-text-secondary text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold tracking-widest text-text-muted uppercase mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus focus:border-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold tracking-widest text-text-muted uppercase mb-2">
                  Content
                </label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus focus:border-accent transition-all resize-vertical"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleUpdate}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-text-primary text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setShowEdit(false)}
                  className="px-5 py-2.5 rounded-xl bg-surface-raised hover:bg-surface-hover text-text-secondary text-sm font-semibold transition-colors cursor-pointer"
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
