'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Panel } from '@/lib/timelines/types'

type Tag = {
  id: string
  name: string
  color: string
  is_investor?: boolean | null
}

type Props = {
  threadId: string
  panel: Panel
}

const DEFAULT_COLOR = '#7C8A95'

export default function TagChips({ threadId, panel }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [linked, setLinked] = useState<Tag[]>([])
  const [picking, setPicking] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#FFCC33')
  const [busy, setBusy] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  const reload = async () => {
    const [{ data: tags }, { data: joins }] = await Promise.all([
      supabase.from('tags').select('id, name, color, is_investor').order('name'),
      supabase
        .from('thread_tags')
        .select('tag_id, tags(id, name, color, is_investor)')
        .eq('thread_id', threadId),
    ])
    setAllTags((tags as Tag[] | null) || [])
    const linkedTags = ((joins as { tags: Tag | null }[] | null) || [])
      .map((j) => j.tags)
      .filter((t): t is Tag => !!t)
    setLinked(linkedTags)
  }

  useEffect(() => {
    reload()
    const channel = supabase
      .channel(`thread_tags:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'thread_tags',
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          reload()
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!pickerRef.current) return
      if (!pickerRef.current.contains(e.target as Node)) {
        setPicking(false)
        setCreating(false)
      }
    }
    if (picking) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [picking])

  const linkedIds = new Set(linked.map((t) => t.id))
  const available = allTags.filter((t) => !linkedIds.has(t.id))

  const addTag = async (tagId: string) => {
    setBusy(true)
    try {
      await supabase.from('thread_tags').insert({ thread_id: threadId, tag_id: tagId })
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const removeTag = async (tagId: string) => {
    setBusy(true)
    try {
      await supabase.from('thread_tags').delete().eq('thread_id', threadId).eq('tag_id', tagId)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const createAndAdd = async () => {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({ name, color: newColor })
        .select('id, name, color, is_investor')
        .single()
      if (!error && data) {
        await supabase.from('thread_tags').insert({ thread_id: threadId, tag_id: data.id })
        setNewName('')
        setCreating(false)
        await reload()
      }
    } finally {
      setBusy(false)
    }
  }

  const linkColor = panel === '305' ? 'var(--rp-gold)' : 'var(--personal-accent)'
  const mutedColor = panel === '305' ? 'var(--rp-gold-lite)' : 'var(--personal-muted)'

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', position: 'relative' }}>
      {linked.map((t) => (
        <span
          key={t.id}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: t.color || DEFAULT_COLOR,
            color: '#fff',
            borderRadius: 999,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          {t.name}
          <button
            onClick={() => removeTag(t.id)}
            disabled={busy}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12,
              padding: 0,
              lineHeight: 1,
              opacity: 0.8,
            }}
            aria-label={`Remove ${t.name}`}
          >
            Ã—
          </button>
        </span>
      ))}
      <div ref={pickerRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setPicking((v) => !v)}
          style={{
            background: 'transparent',
            border: `1px dashed ${linkColor}`,
            color: linkColor,
            borderRadius: 999,
            padding: '1px 8px',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + tag
        </button>
        {picking && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: '#fff',
              color: '#1F1D1A',
              border: '1px solid #ccc',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              padding: 6,
              zIndex: 10,
              minWidth: 200,
              maxHeight: 280,
              overflowY: 'auto',
            }}
          >
            {available.length === 0 && !creating && (
              <div style={{ fontSize: 12, color: '#888', padding: '4px 8px' }}>No more tags.</div>
            )}
            {available.map((t) => (
              <button
                key={t.id}
                onClick={() => addTag(t.id)}
                disabled={busy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '4px 8px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 12,
                  color: '#1F1D1A',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: t.color || DEFAULT_COLOR,
                    flexShrink: 0,
                  }}
                />
                {t.name}
              </button>
            ))}
            <hr style={{ border: 0, borderTop: '1px solid #eee', margin: '4px 0' }} />
            {!creating ? (
              <button
                onClick={() => setCreating(true)}
                style={{
                  width: '100%',
                  padding: '4px 8px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 12,
                  color: '#0E3470',
                  fontFamily: 'inherit',
                }}
              >
                + Create new tag
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px' }}>
                <input
                  type="text"
                  placeholder="Tag name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  style={{
                    fontSize: 12,
                    padding: '4px 6px',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    style={{ width: 32, height: 24, border: 'none', background: 'none', padding: 0 }}
                  />
                  <span style={{ fontSize: 11, color: mutedColor }}>color</span>
                  <button
                    onClick={createAndAdd}
                    disabled={busy || !newName.trim()}
                    style={{
                      marginLeft: 'auto',
                      background: '#0E3470',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '3px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
