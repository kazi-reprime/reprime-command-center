'use client'

import { useState } from 'react'
import type { DashboardThread } from '@/lib/timelines/types'

type ActionType =
  | 'running_late_zoom'
  | 'running_late_office'
  | 'couldnt_make_it'
  | 'move_earlier'
  | 'postpone'

const ACTIONS: Array<{ type: ActionType; label: string; emoji: string; color: string }> = [
  { type: 'running_late_zoom', label: 'Late Zoom', emoji: '🕐', color: '#FFCC33' },
  { type: 'running_late_office', label: 'Late Office', emoji: '🕐', color: '#FFCC33' },
  { type: 'couldnt_make_it', label: "Can't make it", emoji: '❌', color: '#FF7474' },
  { type: 'move_earlier', label: 'Move earlier', emoji: '⏩', color: '#00A980' },
  { type: 'postpone', label: 'Postpone', emoji: '⏪', color: '#6B9BE8' },
]

interface Props {
  activeThread: DashboardThread | null
}

export default function TopBarConcierge({ activeThread }: Props) {
  const [open, setOpen] = useState<ActionType | null>(null)
  const [loading, setLoading] = useState(false)
  const [en, setEn] = useState('')
  const [he, setHe] = useState('')
  const [lang, setLang] = useState<'en' | 'he'>('en')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setOpen(null)
    setLoading(false)
    setEn('')
    setHe('')
    setLang('en')
    setSending(false)
    setError(null)
  }

  async function start(type: ActionType) {
    if (!activeThread) {
      setError('Open a conversation first — click any contact on the left')
      setOpen(type)
      return
    }
    setOpen(type)
    setLoading(true)
    setError(null)
    setEn('')
    setHe('')

    try {
      const res = await fetch('/api/ai/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          contact: {
            name: activeThread.contact_name || null,
            phone: activeThread.phone || null,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'concierge_failed')
      setEn(data.en || '')
      setHe(data.he || '')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    if (!activeThread) return
    setSending(true)
    setError(null)
    const body = lang === 'en' ? en : he

    try {
      const res = await fetch('/api/whatsapp/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panel: activeThread.panel,
          thread_id: activeThread.id,
          body,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'send_failed')
      }
      reset()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const hasText = lang === 'en' ? en.trim().length > 0 : he.trim().length > 0

  const btnBase: React.CSSProperties = {
    background: 'rgba(255, 204, 51, 0.03)',
    borderRadius: 999,
    padding: '0.55rem 1.15rem',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    letterSpacing: '0.02em',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'background 0.15s, box-shadow 0.15s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
  }

  const isGroup = activeThread?.is_group === true
  const concierge_disabled_title =
    'Concierge actions only work on 1:1 chats — this is a group. Reply from your iPhone WhatsApp directly.'

  return (
    <>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {ACTIONS.map((a) => (
          <button
            key={a.type}
            type="button"
            title={
              !activeThread
                ? 'Click a conversation first, then use this button'
                : isGroup
                ? concierge_disabled_title
                : `${a.label} — sends to ${activeThread.contact_name || activeThread.phone}`
            }
            onClick={() => void start(a.type)}
            disabled={isGroup}
            style={{
              ...btnBase,
              border: `1px solid ${a.color}`,
              color: a.color,
              cursor: isGroup ? 'not-allowed' : 'pointer',
              opacity: isGroup ? 0.4 : 1,
            }}
            onMouseEnter={(e) => {
              if (isGroup) return
              e.currentTarget.style.background = 'rgba(255, 204, 51, 0.08)'
              e.currentTarget.style.boxShadow = `0 2px 12px ${a.color}33`
            }}
            onMouseLeave={(e) => {
              if (isGroup) return
              e.currentTarget.style.background = 'rgba(255, 204, 51, 0.03)'
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.18)'
            }}
          >
            {a.emoji} {a.label}
          </button>
        ))}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) reset()
          }}
        >
          <div
            style={{
              background: 'rgba(14, 52, 112, 0.85)',
              color: '#FFFFFF',
              border: '1px solid rgba(14, 52, 112, 0.70)',
              borderRadius: 10,
              padding: 20,
              width: 'min(700px, 95vw)',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 15, color: '#FFCC33' }}>
                {ACTIONS.find((a) => a.type === open)?.emoji}{' '}
                {ACTIONS.find((a) => a.type === open)?.label}
                {activeThread?.contact_name ? ` → ${activeThread.contact_name}` : ''}
              </h2>
              <button
                type="button"
                onClick={reset}
                style={{ background: 'transparent', border: '1px solid rgba(14, 52, 112, 0.70)', borderRadius: 5, color: '#fff', cursor: 'pointer', padding: '3px 9px', fontSize: 12 }}
              >
                ✕
              </button>
            </div>

            {loading ? (
              <p style={{ color: '#FFCC33', fontSize: 14 }}>Generating message…</p>
            ) : (
              <>
                {error && (
                  <p style={{ color: '#FF7474', fontSize: 12, marginBottom: 10 }}>
                    Error: {error}
                  </p>
                )}

                {/* Message editors */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#FFCC33', letterSpacing: 0.4 }}>English</span>
                    <textarea
                      value={en}
                      onChange={(e) => setEn(e.target.value)}
                      rows={5}
                      style={{
                        background: '#0E3470',
                        color: '#fff',
                        border: '1px solid rgba(14, 52, 112, 0.70)',
                        borderRadius: 6,
                        padding: 8,
                        fontSize: 13,
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        lineHeight: 1.5,
                      }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#FFCC33', letterSpacing: 0.4 }}>Hebrew</span>
                    <textarea
                      value={he}
                      onChange={(e) => setHe(e.target.value)}
                      rows={5}
                      dir="rtl"
                      style={{
                        background: '#0E3470',
                        color: '#fff',
                        border: '1px solid rgba(14, 52, 112, 0.70)',
                        borderRadius: 6,
                        padding: 8,
                        fontSize: 13,
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        lineHeight: 1.5,
                      }}
                    />
                  </label>
                </div>

                {/* Footer controls */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', color: 'rgba(255,255,255,0.7)' }}>
                    Send in:
                    <select
                      value={lang}
                      onChange={(e) => setLang(e.target.value as 'en' | 'he')}
                      style={{
                        background: '#0E3470',
                        color: '#fff',
                        border: '1px solid rgba(14, 52, 112, 0.70)',
                        borderRadius: 5,
                        padding: '3px 7px',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="en">English</option>
                      <option value="he">Hebrew</option>
                    </select>
                  </label>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={reset}
                      style={{ background: 'transparent', border: '1px solid rgba(14, 52, 112, 0.70)', color: '#fff', borderRadius: 5, padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={sending || !hasText}
                      style={{
                        background: '#FFCC33',
                        color: '#0E3470',
                        border: 'none',
                        borderRadius: 5,
                        padding: '5px 14px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: sending || !hasText ? 'not-allowed' : 'pointer',
                        opacity: sending || !hasText ? 0.55 : 1,
                        fontFamily: 'inherit',
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {sending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
