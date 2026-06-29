'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { isHebrew } from '@/lib/timelines/parse'
import type { DashboardMessage, DashboardThread } from '@/lib/timelines/types'
import TagChips from './TagChips'

// ── TTS speed ────────────────────────────────────────────────────────────────
const SPEED_KEY = 'tts-speed-v1'
const SPEEDS = [1, 1.2, 1.4, 1.8, 2] as const
type TtsSpeed = (typeof SPEEDS)[number]

function getStoredSpeed(): TtsSpeed {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(SPEED_KEY) : null
    if (!raw) return 1
    const v = parseFloat(raw) as TtsSpeed
    return (SPEEDS as readonly number[]).includes(v) ? v : 1
  } catch {
    return 1
  }
}

function saveSpeed(s: TtsSpeed) {
  try { localStorage.setItem(SPEED_KEY, String(s)) } catch {}
}

type Props = {
  thread: DashboardThread
  messages: DashboardMessage[]
}

const PANEL_THEME = {
  '718': {
    bg: 'var(--personal-bg)',
    surface: 'var(--personal-surface)',
    border: 'var(--personal-border)',
    text: 'var(--personal-text)',
    muted: 'var(--personal-muted)',
    outBg: 'var(--personal-accent)',
    outText: '#fff',
    inBg: 'var(--personal-surface)',
    inText: 'var(--personal-text)',
  },
  '305': {
    bg: 'var(--rp-navy)',
    surface: 'var(--rp-surface)',
    border: 'var(--rp-border)',
    text: 'var(--rp-white)',
    muted: 'var(--rp-gold-lite)',
    outBg: 'var(--rp-gold)',
    outText: 'var(--rp-navy)',
    inBg: 'var(--rp-surface)',
    inText: 'var(--rp-white)',
  },
} as const

function formatTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  })
}

function formatDay(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago',
  })
}

// ── Shared TTS logic ──────────────────────────────────────────────────────────

type SpeakState = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

function useTTS(text: string, speed: TtsSpeed) {
  const [state, setState] = useState<SpeakState>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  // Reset if text changes
  useEffect(() => {
    audioRef.current?.pause()
    audioRef.current = null
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
    setState('idle')
  }, [text])

  // Apply speed change to currently loaded audio (even mid-play)
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])

  const toggle = async () => {
    if (!text.trim()) return
    if (state === 'playing') { audioRef.current?.pause(); return }
    if (state === 'paused' && audioRef.current) { void audioRef.current.play(); return }
    setState('loading')
    try {
      const language = /[֐-׿]/.test(text) ? 'he' : 'en'
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 4000), language }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      urlRef.current = url
      const audio = new Audio(url)
      audio.playbackRate = speed
      audio.onended = () => setState('idle')
      audio.onpause = () => { if (!audio.ended) setState('paused') }
      audio.onplay = () => setState('playing')
      audioRef.current = audio
      await audio.play()
    } catch {
      setState('error')
    }
  }

  return { state, toggle }
}

// ── Per-message speaker (tiny, beside the bubble) ─────────────────────────────

function MessageSpeaker({ text, speed }: { text: string; speed: TtsSpeed }) {
  const { state, toggle } = useTTS(text, speed)
  if (!text.trim()) return null
  return (
    <button
      type="button"
      onClick={toggle}
      title={state === 'playing' ? 'Pause' : state === 'error' ? 'Failed — retry' : 'Read aloud'}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px 4px',
        fontSize: 13,
        lineHeight: 1,
        opacity: state === 'idle' ? 0.3 : 1,
        color: state === 'playing' ? '#22c55e' : state === 'error' ? '#ef4444' : 'inherit',
        alignSelf: 'flex-end',
        marginBottom: 4,
        flexShrink: 0,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => { if (state === 'idle') (e.currentTarget as HTMLButtonElement).style.opacity = '0.75' }}
      onMouseLeave={(e) => { if (state === 'idle') (e.currentTarget as HTMLButtonElement).style.opacity = '0.3' }}
    >
      {state === 'loading' ? '⏳' : state === 'playing' ? '⏸' : '🔊'}
    </button>
  )
}

// ── Thread-level speaker (reads all inbound messages in order) ────────────────

function ThreadSpeaker({ messages, muted, speed }: { messages: DashboardMessage[]; muted: string; speed: TtsSpeed }) {
  const combinedText = useMemo(() => {
    return [...messages]
      .filter((m) => m.direction === 'in' && m.body && m.media_type !== 'audio')
      .sort((a, b) => {
        const ta = a.sent_at ? new Date(a.sent_at).getTime() : 0
        const tb = b.sent_at ? new Date(b.sent_at).getTime() : 0
        return ta - tb // oldest first for reading order
      })
      .map((m) => m.body!)
      .join('\n\n')
  }, [messages])

  const { state, toggle } = useTTS(combinedText, speed)

  if (!combinedText.trim()) return null

  return (
    <button
      type="button"
      onClick={toggle}
      title={
        state === 'playing'
          ? 'Pause thread'
          : state === 'paused'
          ? 'Resume thread'
          : 'Read all their messages aloud'
      }
      style={{
        background: 'none',
        border: `1px solid ${state === 'playing' ? '#22c55e' : muted}`,
        borderRadius: 5,
        cursor: 'pointer',
        padding: '2px 7px',
        fontSize: 11,
        color: state === 'playing' ? '#22c55e' : state === 'error' ? '#ef4444' : muted,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        marginLeft: 'auto',
        flexShrink: 0,
        fontFamily: 'inherit',
        transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      {state === 'loading' ? '⏳' : state === 'playing' ? '⏸' : '🔊'}
      {' '}
      {state === 'loading' ? 'Loading…' : state === 'playing' ? 'Pause' : 'Read thread'}
    </button>
  )
}

// ── Speed control ────────────────────────────────────────────────────────────

function SpeedControl({ speed, onChange, muted }: { speed: TtsSpeed; onChange: (s: TtsSpeed) => void; muted: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        flexShrink: 0,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 6,
        padding: '1px 3px',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {SPEEDS.map((s) => {
        const active = s === speed
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            title={`Playback speed ${s}×`}
            style={{
              background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
              border: `1px solid ${active ? muted : 'transparent'}`,
              borderRadius: 4,
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: 11,
              color: muted,
              opacity: active ? 1 : 0.6,
              fontFamily: 'inherit',
              fontWeight: active ? 700 : 500,
              lineHeight: 1.5,
              transition: 'opacity 0.15s, background 0.15s',
              minWidth: 28,
              textAlign: 'center',
            }}
            onMouseEnter={(e) => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.opacity = '1'
            }}
            onMouseLeave={(e) => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.opacity = '0.6'
            }}
          >
            {s}×
          </button>
        )
      })}
    </div>
  )
}

// ── MediaBlock ────────────────────────────────────────────────────────────────

function MediaBlock({ msg }: { msg: DashboardMessage }) {
  const [expanded, setExpanded] = useState(false)
  if (!msg.media_url && msg.media_type !== 'audio') return null
  if (!msg.media_url) return null
  if (msg.media_type === 'image') {
    return (
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'zoom-in', display: 'block' }}
      >
        <img
          src={msg.media_url}
          alt={msg.media_filename || 'image'}
          style={{
            maxWidth: expanded ? 600 : 220,
            maxHeight: expanded ? 600 : 220,
            borderRadius: 6,
            display: 'block',
          }}
        />
      </button>
    )
  }
  if (msg.media_type === 'audio') {
    return (
      <div>
        <audio controls src={msg.media_url} style={{ maxWidth: 280, marginTop: 4, display: 'block' }}>
          Your browser does not support audio.
        </audio>
        {msg.body && (
          <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4, fontStyle: 'italic' }}>
            {msg.body}
          </div>
        )}
      </div>
    )
  }
  if (msg.media_type === 'video') {
    return (
      <video controls src={msg.media_url} style={{ maxWidth: 320, maxHeight: 320, borderRadius: 6, marginTop: 4 }} />
    )
  }
  return (
    <a
      href={msg.media_url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        textDecoration: 'none',
        color: 'inherit',
        marginTop: 4,
        padding: '6px 10px',
        background: 'rgba(0,0,0,0.06)',
        borderRadius: 6,
        fontSize: 12,
      }}
    >
      <span style={{ fontSize: 18 }}>📄</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
        {msg.media_filename || 'attachment'}
      </span>
    </a>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MessageView({ thread, messages }: Props) {
  const theme = PANEL_THEME[thread.panel]
  const scrollRef = useRef<HTMLDivElement>(null)
  const [speed, setSpeed] = useState<TtsSpeed>(() => getStoredSpeed())

  function handleSpeedChange(s: TtsSpeed) {
    setSpeed(s)
    saveSpeed(s)
  }

  const sorted = useMemo(() => {
    // Newest first — most recent message at the top, right below the compose box
    return [...messages].sort((a, b) => {
      const ta = a.sent_at ? new Date(a.sent_at).getTime() : 0
      const tb = b.sent_at ? new Date(b.sent_at).getTime() : 0
      return tb - ta
    })
  }, [messages])

  // Scroll to TOP only when switching threads — not when new messages arrive
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = 0
  }, [thread.id])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: theme.bg,
        color: theme.text,
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          background: theme.bg,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, flexShrink: 0 }}>
            {thread.contact_name || thread.phone}
          </h2>
          <span style={{ color: theme.muted, fontSize: 12 }}>{thread.phone}</span>
          {thread.is_group && (
            <span style={{ color: theme.muted, fontSize: 11 }}>group</span>
          )}
          {/* Speed presets + thread reader */}
          <SpeedControl speed={speed} onChange={handleSpeedChange} muted={theme.muted} />
          <ThreadSpeaker messages={messages} muted={theme.muted} speed={speed} />
        </div>
        <TagChips threadId={thread.id} panel={thread.panel} />
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0.75rem 1rem' }}>
        {sorted.length === 0 && (
          <div style={{ color: theme.muted, fontSize: 13, padding: '1rem 0', textAlign: 'center' }}>No messages yet.</div>
        )}
        {sorted.map((m, idx) => {
          const prev = sorted[idx - 1]
          const showDay =
            !prev ||
            (m.sent_at &&
              prev.sent_at &&
              new Date(m.sent_at).toDateString() !== new Date(prev.sent_at).toDateString())
          const isOut = m.direction === 'out'
          const rtl = isHebrew(m.body)
          const hasReadableText = !isOut && !!m.body && m.media_type !== 'audio'
          return (
            <div key={m.id}>
              {showDay && (
                <div
                  style={{
                    textAlign: 'center',
                    color: theme.muted,
                    fontSize: 11,
                    margin: '12px 0 8px',
                  }}
                >
                  {formatDay(m.sent_at)}
                </div>
              )}
              {thread.is_group && !isOut && m.from_name && (
                <div
                  style={{
                    fontSize: 11,
                    color: theme.muted,
                    marginLeft: 6,
                    marginBottom: 2,
                  }}
                >
                  {m.from_name}
                </div>
              )}
              {/* Bubble row — inbound gets a tiny speaker button beside it */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 4,
                  justifyContent: isOut ? 'flex-end' : 'flex-start',
                  marginBottom: 6,
                }}
              >
                <div
                  dir={rtl ? 'rtl' : undefined}
                  style={{
                    background: isOut ? theme.outBg : theme.inBg,
                    color: isOut ? theme.outText : theme.inText,
                    padding: '0.45rem 0.7rem',
                    borderRadius: 12,
                    maxWidth: '70%',
                    fontSize: 14,
                    lineHeight: 1.35,
                    wordBreak: 'break-word',
                    boxShadow: '0 1px 1px rgba(0,0,0,0.06)',
                  }}
                >
                  {m.body && m.media_type !== 'audio' && (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                  )}
                  <MediaBlock msg={m} />
                  <div
                    style={{
                      fontSize: 10,
                      opacity: 0.7,
                      marginTop: 2,
                      textAlign: rtl ? 'left' : 'right',
                    }}
                  >
                    {formatTime(m.sent_at)}
                  </div>
                </div>
                {/* Per-message speaker — only on inbound text messages */}
                {hasReadableText && <MessageSpeaker text={m.body!} speed={speed} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
