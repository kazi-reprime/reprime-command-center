'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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

interface BulkResult {
  processed: number
  tagged: number
  created: number
  errors: string[]
}

const READ_ONLY_TITLES = new Set(['BACKLOG.md', 'BACKLOG'])

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(s: string): string {
  let out = escapeHtml(s)
  out = out.replace(/`([^`]+)`/g, '<code style="background:rgba(14, 52, 112, 0.85);padding:1px 4px;border-radius:3px;color:#FFCC33;">$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#FFCC33;">$1</a>'
  )
  out = out.replace(
    /(^|\s)(https?:\/\/[^\s<]+)/g,
    (_m, lead, url) =>
      `${lead}<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#FFCC33;">${url}</a>`
  )
  return out
}

function renderMarkdown(src: string): string {
  if (!src) return ''
  const lines = src.split(/\r?\n/)
  const out: string[] = []
  let inCode = false
  let codeBuf: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let paraBuf: string[] = []

  const flushPara = () => {
    if (paraBuf.length === 0) return
    out.push(`<p style="margin:0 0 0.6rem;">${paraBuf.map(renderInline).join('<br/>')}</p>`)
    paraBuf = []
  }
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`)
      listType = null
    }
  }

  for (const raw of lines) {
    const line = raw

    if (inCode) {
      if (/^```\s*$/.test(line)) {
        out.push(
          `<pre style="background:rgba(14, 52, 112, 0.85);color:#FFCC33;padding:0.6rem;border-radius:4px;overflow-x:auto;font-size:12px;margin:0 0 0.6rem;"><code>${escapeHtml(
            codeBuf.join('\n')
          )}</code></pre>`
        )
        codeBuf = []
        inCode = false
      } else {
        codeBuf.push(line)
      }
      continue
    }
    if (/^```/.test(line)) {
      flushPara()
      closeList()
      inCode = true
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushPara()
      closeList()
      const lvl = heading[1].length
      out.push(
        `<h${lvl} style="color:#FFCC33;font-weight:600;margin:0.85rem 0 0.4rem;font-size:${
          lvl <= 2 ? '1rem' : '0.9rem'
        };">${renderInline(heading[2])}</h${lvl}>`
      )
      continue
    }

    const ul = line.match(/^\s*[-*]\s+(.*)$/)
    if (ul) {
      flushPara()
      if (listType !== 'ul') {
        closeList()
        out.push('<ul style="margin:0 0 0.6rem 1.2rem;padding:0;">')
        listType = 'ul'
      }
      out.push(`<li>${renderInline(ul[1])}</li>`)
      continue
    }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/)
    if (ol) {
      flushPara()
      if (listType !== 'ol') {
        closeList()
        out.push('<ol style="margin:0 0 0.6rem 1.2rem;padding:0;">')
        listType = 'ol'
      }
      out.push(`<li>${renderInline(ol[1])}</li>`)
      continue
    }

    if (/^\s*$/.test(line)) {
      flushPara()
      closeList()
      continue
    }

    closeList()
    paraBuf.push(line)
  }

  flushPara()
  closeList()
  if (inCode) {
    out.push(
      `<pre style="background:rgba(14, 52, 112, 0.85);color:#FFCC33;padding:0.6rem;border-radius:4px;font-size:12px;margin:0 0 0.6rem;"><code>${escapeHtml(
        codeBuf.join('\n')
      )}</code></pre>`
    )
  }
  return out.join('\n')
}

function preview(body: string, n = 80): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length > n ? flat.slice(0, n) + '…' : flat
}

interface ToastMsg {
  text: string
  kind: 'ok' | 'err'
}

export default function NotesPanel() {
  const [open, setOpen] = useState(false)

  // Allow other components (e.g. the top-bar Quick Note button) to pop the
  // flap open by dispatching window.dispatchEvent(new Event('open-notes'))
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('open-notes', handler)
    return () => window.removeEventListener('open-notes', handler)
  }, [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [toast, setToast] = useState<ToastMsg | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const showToast = (msg: ToastMsg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4500)
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['notes'],
    queryFn: async (): Promise<NotesPayload> => {
      const res = await fetch('/api/notes', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as NotesPayload
    },
    enabled: open,
  })

  const notes = useMemo(() => data?.notes ?? [], [data?.notes])
  const selected = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId]
  )
  const isReadOnly = selected ? READ_ONLY_TITLES.has(selected.title) : false

  useEffect(() => {
    if (selected) {
      setDraftTitle(selected.title)
      setDraftBody(selected.body)
      setEditing(false)
    }
  }, [selected])

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled note', body: '' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as { note: Note }
    },
    onSuccess: ({ note }) => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      setSelectedId(note.id)
      setEditing(true)
    },
  })

  const updateMut = useMutation({
    mutationFn: async (patch: { id: string; title?: string; body?: string; is_pinned?: boolean }) => {
      const res = await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as { note: Note }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      setSelectedId(null)
    },
  })

  const handleSave = () => {
    if (!selected || isReadOnly) return
    updateMut.mutate(
      { id: selected.id, title: draftTitle, body: draftBody },
      {
        onSuccess: () => {
          setEditing(false)
          showToast({ text: 'Saved', kind: 'ok' })
        },
        onError: (e) => showToast({ text: `Save failed: ${(e as Error).message}`, kind: 'err' }),
      }
    )
  }

  const handleExport = () => {
    if (!selected) return
    const blob = new Blob([selected.body], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeName = selected.title.replace(/[^\w.-]+/g, '_') || 'note'
    a.href = url
    a.download = safeName.endsWith('.md') ? safeName : `${safeName}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCopy = async () => {
    if (!selected) return
    try {
      await navigator.clipboard.writeText(selected.body)
      showToast({ text: 'Copied to clipboard', kind: 'ok' })
    } catch (e) {
      showToast({ text: `Copy failed: ${(e as Error).message}`, kind: 'err' })
    }
  }

  const handleTogglePin = () => {
    if (!selected || isReadOnly) return
    updateMut.mutate({ id: selected.id, is_pinned: !selected.is_pinned })
  }

  const handleDelete = () => {
    if (!selected || isReadOnly) return
    if (!confirm(`Delete "${selected.title}"?`)) return
    deleteMut.mutate(selected.id)
  }

  const handleBulkUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleBulkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const fd = new FormData()
    fd.append('csv', file)
    try {
      const res = await fetch('/api/tags/bulk-upload', { method: 'POST', body: fd })
      const json = (await res.json()) as Partial<BulkResult> & { error?: string }
      if (!res.ok) {
        showToast({ text: `Upload failed: ${json.error || res.statusText}`, kind: 'err' })
        return
      }
      const r = json as BulkResult
      const errSnippet = r.errors.length > 0 ? ` · ${r.errors.length} errors` : ''
      showToast({
        text: `Processed ${r.processed} · tagged ${r.tagged} · created ${r.created}${errSnippet}`,
        kind: r.errors.length > 0 ? 'err' : 'ok',
      })
    } catch (err) {
      showToast({ text: `Upload failed: ${(err as Error).message}`, kind: 'err' })
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'var(--rp-gold)',
          color: 'var(--rp-navy)',
          border: 'none',
          padding: '0.7rem 0.5rem',
          borderRadius: '4px 0 0 4px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 12,
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          zIndex: 90,
        }}
      >
        Notes
      </button>
    )
  }

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    right: 0,
    top: 0,
    bottom: 0,
    width: 380,
    background: 'var(--rp-navy)',
    color: 'var(--rp-white)',
    borderLeft: '1px solid var(--rp-border)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    fontSize: 13,
  }

  const headerStyle: React.CSSProperties = {
    padding: '0.65rem 0.85rem',
    borderBottom: '1px solid var(--rp-border)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--rp-surface)',
  }

  const btnPrimary: React.CSSProperties = {
    background: 'var(--rp-gold)',
    color: 'var(--rp-navy)',
    border: 'none',
    borderRadius: 4,
    padding: '0.4rem 0.65rem',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  }
  const btnGhost: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--rp-gold-lite)',
    border: '1px solid var(--rp-border)',
    borderRadius: 4,
    padding: '0.4rem 0.6rem',
    fontSize: 12,
    cursor: 'pointer',
  }

  return (
    <aside style={panelStyle}>
      <header style={headerStyle}>
        <span
          style={{
            color: 'var(--rp-gold)',
            fontWeight: 600,
            fontSize: 14,
            flex: 1,
          }}
        >
          Notes
        </span>
        <button type="button" onClick={() => createMut.mutate()} style={btnPrimary} disabled={createMut.isPending}>
          + New
        </button>
        <button type="button" onClick={handleBulkUploadClick} style={btnGhost} title="Bulk tag upload (CSV)">
          📤 Bulk Tag Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleBulkFile}
        />
        <button type="button" onClick={() => setOpen(false)} style={btnGhost} aria-label="Close">
          ×
        </button>
      </header>

      {toast && (
        <div
          style={{
            padding: '0.5rem 0.85rem',
            background: toast.kind === 'ok' ? '#0E3470' : '#3F1A1A',
            color: toast.kind === 'ok' ? 'var(--rp-gold-lite)' : 'var(--rp-red)',
            borderBottom: '1px solid var(--rp-border)',
            fontSize: 12,
          }}
        >
          {toast.text}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div
          style={{
            width: 150,
            borderRight: '1px solid var(--rp-border)',
            overflowY: 'auto',
            padding: '0.4rem 0',
          }}
        >
          {isLoading && (
            <div style={{ padding: '0.5rem 0.75rem', color: 'var(--rp-gold-lite)', fontSize: 12 }}>
              Loading…
            </div>
          )}
          {isError && (
            <div style={{ padding: '0.5rem 0.75rem', color: 'var(--rp-red)', fontSize: 12 }}>
              {(error as Error).message}
            </div>
          )}
          {!isLoading && notes.length === 0 && (
            <div style={{ padding: '0.5rem 0.75rem', color: 'var(--rp-gold-lite)', fontSize: 12 }}>
              No notes yet
            </div>
          )}
          {notes.map((n) => {
            const isSel = n.id === selectedId
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelectedId(n.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.5rem 0.7rem',
                  background: isSel ? 'var(--rp-surface)' : 'transparent',
                  borderLeft: isSel ? '3px solid var(--rp-gold)' : '3px solid transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--rp-white)',
                  fontFamily: 'inherit',
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 12,
                    color: 'var(--rp-white)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {n.is_pinned && <span style={{ color: 'var(--rp-gold)' }}>📌</span>}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--rp-gold-lite)',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {preview(n.body)}
                </div>
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!selected ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--rp-gold-lite)',
                fontSize: 12,
                padding: '0.85rem',
              }}
            >
              Select a note to view, or create a new one.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  padding: '0.5rem 0.7rem',
                  borderBottom: '1px solid var(--rp-border)',
                  background: 'var(--rp-surface)',
                }}
              >
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => (editing ? handleSave() : setEditing(true))}
                    style={btnPrimary}
                    disabled={updateMut.isPending}
                  >
                    {editing ? (updateMut.isPending ? 'Saving…' : 'Save') : 'Edit'}
                  </button>
                )}
                <button type="button" onClick={handleExport} style={btnGhost}>
                  Export .md
                </button>
                <button type="button" onClick={handleCopy} style={btnGhost}>
                  Copy
                </button>
                {!isReadOnly && (
                  <>
                    <button type="button" onClick={handleTogglePin} style={btnGhost}>
                      {selected.is_pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      style={{ ...btnGhost, color: 'var(--rp-red)', borderColor: 'var(--rp-red)' }}
                      disabled={deleteMut.isPending}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>

              {isReadOnly && (
                <div
                  style={{
                    background: 'var(--rp-gold)',
                    color: 'var(--rp-navy)',
                    padding: '0.4rem 0.7rem',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Read-only · {selected.title}
                </div>
              )}

              <div style={{ flex: 1, overflowY: 'auto', padding: '0.7rem 0.85rem', minHeight: 0 }}>
                {editing && !isReadOnly ? (
                  <>
                    <input
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder="Title"
                      style={{
                        width: '100%',
                        background: 'rgba(255, 204, 51, 0.05)',
                        color: 'var(--rp-white)',
                        border: '1px solid rgba(255, 204, 51, 0.35)',
                        borderRadius: 4,
                        padding: '0.5rem',
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 8,
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#FFCC33'
                        e.currentTarget.style.background = 'rgba(255, 204, 51, 0.08)'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 204, 51, 0.35)'
                        e.currentTarget.style.background = 'rgba(255, 204, 51, 0.05)'
                      }}
                    />
                    <textarea
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      placeholder="Body (markdown supported)"
                      rows={20}
                      style={{
                        width: '100%',
                        background: 'rgba(255, 204, 51, 0.05)',
                        color: 'var(--rp-white)',
                        border: '1px solid rgba(255, 204, 51, 0.35)',
                        borderRadius: 4,
                        padding: '0.5rem',
                        fontSize: 12,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                        minHeight: 240,
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#FFCC33'
                        e.currentTarget.style.background = 'rgba(255, 204, 51, 0.08)'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 204, 51, 0.35)'
                        e.currentTarget.style.background = 'rgba(255, 204, 51, 0.05)'
                      }}
                    />
                  </>
                ) : (
                  <>
                    <h2
                      style={{
                        color: 'var(--rp-gold)',
                        fontWeight: 600,
                        fontSize: '1rem',
                        margin: '0 0 0.5rem',
                      }}
                    >
                      {selected.title}
                    </h2>
                    <div
                      style={{ color: 'var(--rp-white)', fontSize: 13, lineHeight: 1.55 }}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(selected.body) }}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
