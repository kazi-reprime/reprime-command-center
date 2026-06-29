'use client'
import { useEffect, useRef, useState } from 'react'
import type { Panel, DashboardMessage } from '@/lib/timelines/types'
import { isHebrew } from '@/lib/timelines/parse'
import AttachmentUpload from './AttachmentUpload'
import DraftButton from './DraftButton'
import MicButton from './MicButton'
import SpeakerButton from './SpeakerButton'

type Props = {
  panel: Panel
  threadId: string
  threadHistory?: DashboardMessage[]
  contact?: { name?: string | null; phone?: string | null } | null
  onSend?: (msg: DashboardMessage) => void
  onOptimistic?: (msg: DashboardMessage) => void
  onStatus?: (tempId: string, status: 'ok' | 'fail', real?: DashboardMessage) => void
}

const MAX_VISIBLE_LINES = 6
const LINE_HEIGHT_PX = 22

export default function ReplyBox({
  panel,
  threadId,
  threadHistory,
  contact,
  onSend,
  onOptimistic,
  onStatus,
}: Props) {
  const [body, setBody] = useState('')
  const [attachment, setAttachment] = useState<{ url: string; filename: string; type: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [lastFailed, setLastFailed] = useState<{ tempId: string; body: string; attachment: typeof attachment; isQuota?: boolean } | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const rtl = isHebrew(body)
  const accent = panel === '305' ? 'var(--rp-gold)' : 'var(--personal-accent)'
  const accentText = panel === '305' ? 'var(--rp-navy)' : '#fff'
  const surface = panel === '305' ? 'var(--rp-surface)' : 'var(--personal-surface)'
  const border = panel === '305' ? 'var(--rp-border)' : 'var(--personal-border)'
  const textColor = panel === '305' ? 'var(--rp-white)' : 'var(--personal-text)'
  const muted = panel === '305' ? 'var(--rp-gold-lite)' : 'var(--personal-muted)'

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const max = LINE_HEIGHT_PX * MAX_VISIBLE_LINES
    ta.style.height = Math.min(ta.scrollHeight, max) + 'px'
    ta.style.overflowY = ta.scrollHeight > max ? 'auto' : 'hidden'
  }, [body])

  const canSend = (body.trim().length > 0 || !!attachment) && !sending

  const doSend = async (overrideBody?: string, overrideAttachment?: typeof attachment, retryTempId?: string) => {
    const sendBody = (overrideBody ?? body).trim()
    const sendAttachment = overrideAttachment ?? attachment
    if (!sendBody && !sendAttachment) return
    setSending(true)
    const tempId = retryTempId ?? `tmp-${Date.now()}`
    const nowIso = new Date().toISOString()
    const optimistic: DashboardMessage = {
      id: tempId,
      thread_id: threadId,
      panel,
      channel_type: 'whatsapp',
      direction: 'out',
      body: sendBody || null,
      media_url: sendAttachment?.url ?? null,
      media_type: sendAttachment?.type ?? null,
      media_filename: sendAttachment?.filename ?? null,
      timelines_uid: null,
      from_phone: null,
      from_name: null,
      sent_at: nowIso,
      status: 'Pending',
      is_group_message: false,
    }
    if (!retryTempId) onOptimistic?.(optimistic)
    if (!retryTempId) {
      setBody('')
      setAttachment(null)
    }
    try {
      const res = await fetch('/api/whatsapp/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          panel,
          thread_id: threadId,
          body: sendBody,
          attachment_url: sendAttachment?.url,
          attachment_filename: sendAttachment?.filename,
          attachment_type: sendAttachment?.type,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        const isQuota = res.status === 429 || json?.error === 'timelines_quota_exceeded'
        throw Object.assign(new Error(json?.message || `HTTP ${res.status}`), { isQuota })
      }
      const real: DashboardMessage = await res.json()
      onStatus?.(tempId, 'ok', real)
      onSend?.(real)
      setLastFailed(null)
    } catch (err) {
      onStatus?.(tempId, 'fail')
      const isQuota = !!(err as { isQuota?: boolean }).isQuota
      setLastFailed({ tempId, body: sendBody, attachment: sendAttachment, isQuota })
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend) doSend()
    }
  }

  const retry = () => {
    if (!lastFailed) return
    doSend(lastFailed.body, lastFailed.attachment, lastFailed.tempId)
  }

  const handleDraft = (text: string) => {
    setBody(text)
    requestAnimationFrame(() => {
      const ta = taRef.current
      if (!ta) return
      ta.focus()
      const end = text.length
      ta.setSelectionRange(end, end)
    })
  }

  return (
    <div
      style={{
        marginTop: '0.5rem',
        padding: '0.5rem 0.6rem',
        background: surface,
        border: `1px solid ${border}`,
        borderRadius: 8,
        color: textColor,
      }}
    >
      {/* ── Toolbar row: above the textarea ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          marginBottom: '0.4rem',
          flexWrap: 'wrap',
        }}
      >
        <MicButton
          language="en"
          onTranscript={(text) => {
            setBody((b) => (b ? b + ' ' + text : text))
            requestAnimationFrame(() => taRef.current?.focus())
          }}
        />
        <MicButton
          language="he"
          onTranscript={(text) => {
            setBody((b) => (b ? b + ' ' + text : text))
            requestAnimationFrame(() => taRef.current?.focus())
          }}
        />
        <SpeakerButton text={body} />
        <DraftButton
          panel={panel}
          threadId={threadId}
          threadHistory={threadHistory ?? []}
          contact={contact ?? null}
          onDraft={handleDraft}
          disabled={sending}
        />
        <AttachmentUpload
          panel={panel}
          threadId={threadId}
          onUpload={(url, filename, type) => setAttachment({ url, filename, type })}
          disabled={sending}
        />
      </div>

      {/* ── Textarea ── */}
      <textarea
        ref={taRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        dir={rtl ? 'rtl' : 'ltr'}
        placeholder="Type a message…"
        rows={1}
        style={{
          width: '100%',
          resize: 'none',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: textColor,
          fontFamily: 'inherit',
          fontSize: '0.95rem',
          lineHeight: `${LINE_HEIGHT_PX}px`,
          minHeight: `${LINE_HEIGHT_PX}px`,
        }}
      />

      {/* ── Bottom row: char count + Send ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '0.4rem',
          marginTop: '0.35rem',
        }}
      >
        <span style={{ fontSize: '0.7rem', color: muted }}>{body.length > 0 ? body.length : ''}</span>
        <button
          type="button"
          onClick={() => doSend()}
          disabled={!canSend}
          style={{
            background: canSend ? accent : border,
            color: canSend ? accentText : muted,
            border: 'none',
            borderRadius: 4,
            padding: '0.35rem 1rem',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: canSend ? 'pointer' : 'not-allowed',
          }}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {lastFailed && (
        <div
          style={{
            marginTop: '0.4rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: lastFailed.isQuota ? 'var(--rp-gold, #FFCC33)' : 'var(--rp-red)',
          }}
        >
          <span>
            {lastFailed.isQuota
              ? 'âš  WhatsApp (Timelines) quota exceeded — resets May 1. Message saved.'
              : 'âœ— Send failed.'}
          </span>
          {!lastFailed.isQuota && (
            <button
              type="button"
              onClick={retry}
              style={{
                background: 'transparent',
                border: '1px solid var(--rp-red)',
                color: 'var(--rp-red)',
                borderRadius: 4,
                padding: '0.15rem 0.5rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  )
}
