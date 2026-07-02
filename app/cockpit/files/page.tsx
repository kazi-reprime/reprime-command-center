'use client'

import React, { useState } from 'react'
import { Card, ActionButton, SearchInput, TabGroup, EmptyState } from '@/components/ui/shared'
import { seedFiles } from '@/lib/data/seed'

const typeIcons: Record<string, string> = { pdf: '📄', pptx: '📊', docx: '📝', xlsx: '📈', png: '🖼️', jpg: '🖼️', mp4: '🎬' }
const formatSize = (bytes: number) => bytes > 1000000 ? `${(bytes / 1000000).toFixed(1)} MB` : `${(bytes / 1000).toFixed(0)} KB`

export default function FilesPage() {
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('all')

  const allTags = [...new Set(seedFiles.flatMap(f => f.tags))]
  const filtered = seedFiles.filter(f => {
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false
    if (tagFilter !== 'all' && !f.tags.includes(tagFilter)) return false
    return true
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>File & Knowledge Center</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>{seedFiles.length} files</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ width: 240 }}><SearchInput value={search} onChange={setSearch} placeholder="Search files..." /></div>
          <ActionButton label="Upload" variant="primary" size="md" onClick={() => {}} />
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <TabGroup
          tabs={[{ key: 'all', label: 'All', count: seedFiles.length }, ...allTags.map(t => ({ key: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))]}
          active={tagFilter}
          onChange={setTagFilter}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {filtered.map(file => (
          <div key={file.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.85rem 1rem', background: 'rgba(14,52,112,0.4)',
            border: '1px solid rgba(255,204,51,0.06)', borderRadius: 8,
            transition: 'border-color 150ms', cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,204,51,0.15)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,204,51,0.06)')}
          >
            <span style={{ fontSize: '1.5rem' }}>{typeIcons[file.type] || '📎'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem', fontSize: '0.65rem', color: 'rgba(255,204,51,0.4)' }}>
                <span>{formatSize(file.size)}</span>
                <span>•</span>
                <span>{file.uploadedBy}</span>
                <span>•</span>
                <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                {file.relatedTo && <><span>•</span><span>{file.relatedTo}</span></>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {file.tags.map(tag => (
                <span key={tag} style={{
                  padding: '0.15rem 0.45rem', borderRadius: 999,
                  background: 'rgba(255,204,51,0.08)', color: 'rgba(255,204,51,0.6)',
                  fontSize: '0.6rem', fontWeight: 500,
                }}>{tag}</span>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <EmptyState icon="🗄️" title="No files found" description="Upload files or try a different filter." />}
      </div>
    </div>
  )
}
