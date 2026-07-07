/* eslint-disable */
'use client'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Panel } from '@/lib/timelines/types'

type Props = {
  panel: Panel
  threadId: string
  onUpload: (publicUrl: string, filename: string, mediaType: string) => void
  disabled?: boolean
}

type Preview = {
  url: string
  filename: string
  mediaType: string
  isImage: boolean
}

const ACCEPT = 'image/*,application/pdf,audio/*'

export default function AttachmentUpload({ panel, threadId, onUpload, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePick = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setError(null)
    setUploading(true)
    try {
      const supabase = createClient()
      const safeName = file.name.replace(/[^\w.\-]+/g, '_')
      const path = `${panel}/${threadId}/${Date.now()}-${safeName}`
      const { error: upErr } = await supabase.storage
        .from('attachments')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('attachments').getPublicUrl(path)
      const publicUrl = data.publicUrl
      const isImage = file.type.startsWith('image/')
      setPreview({ url: publicUrl, filename: file.name, mediaType: file.type, isImage })
      onUpload(publicUrl, file.name, file.type)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(msg)
    } finally {
      setUploading(false)
    }
  }

  const clear = () => {
    setPreview(null)
    setError(null)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleFile}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        onClick={handlePick}
        disabled={disabled || uploading}
        title="Attach file"
        aria-label="Attach file"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: disabled || uploading ? 'not-allowed' : 'pointer',
          padding: '0.25rem 0.4rem',
          fontSize: '1.1rem',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {uploading ? '⏳' : '📎'}
      </button>
      {preview && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.25rem 0.5rem',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4,
            fontSize: '0.75rem',
            maxWidth: 220,
          }}
        >
          {preview.isImage ? (
            <img
              src={preview.url}
              alt={preview.filename}
              style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 3 }}
            />
          ) : (
            <span>📄</span>
          )}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {preview.filename}
          </span>
          <button
            type="button"
            onClick={clear}
            title="Remove attachment"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: 0,
              fontSize: '0.85rem',
              opacity: 0.7,
            }}
          >
            ✕
          </button>
        </div>
      )}
      {error && (
        <span style={{ color: 'var(--rp-red)', fontSize: '0.75rem' }}>{error}</span>
      )}
    </>
  )
}
