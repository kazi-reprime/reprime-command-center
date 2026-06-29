'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { parseCommand, type ParsedIntent } from '@/lib/voice/parser'

/**
 * VoiceShell — live voice UI that fills the VoiceShellFooter slot.
 *
 * Capture model:
 *   • Hold spacebar (when no <input>/<textarea> is focused) to record.
 *   • Ctrl+Shift+V (or Cmd+Shift+V) toggles record from any focus.
 *   • Browser-native SpeechRecognition handles English in real time.
 *   • A parallel MediaRecorder always captures audio so we can re-transcribe
 *     via /api/voice/transcribe-he (Hebrew detected) or /api/voice/transcribe-en
 *     (SpeechRecognition unavailable, e.g. Firefox).
 *
 * State machine:
 *   idle → listening → recording → parsing → sent → idle
 *   - idle      gold dot
 *   - listening gold pulse (mic warming up)
 *   - recording red pulse  (capturing speech)
 *   - parsing   violet pulse (transcribing + dispatching)
 *   - sent      green flash for 1s
 *
 * Dispatch contract (no imports of lib/windows/store):
 *   - Windows         → CustomEvent('center:open-window',   { detail: { target, opts } })
 *   - Search modal    → CustomEvent('center:open-search',   { detail: { query } })
 *   - Quick call      → CustomEvent('center:open-call',     { detail: { name } })
 *   - Quick email     → CustomEvent('center:open-email',    { detail: { name, subject, body } })
 *   - Briefing modal  → CustomEvent('center:open-briefing')
 *   - Bucket/Crew     → POST /api/bucket | /api/bucket/[id]/remind | /api/crew/delegate
 *                       Each fails soft with a one-line spoken-style message
 *                       if the endpoint is not yet deployed.
 */

// ── Web Speech API shim ────────────────────────────────────────────────────────
// Chrome/Edge ship this prefixed; lib.dom doesn't always include it. Same shape
// as components/chat/MicButton.tsx — mirrored here so this component stays
// self-contained.
interface SRAlternative {
  readonly transcript: string
  readonly confidence: number
}
interface SRResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SRAlternative
}
interface SREvent {
  readonly resultIndex: number
  readonly results: { length: number; [index: number]: SRResult }
}
interface SRLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SREvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

function getSpeechRecognition(): (new () => SRLike) | null {
  if (typeof window === 'undefined') return null
  return (
    (window as unknown as { SpeechRecognition?: new () => SRLike })
      .SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SRLike })
      .webkitSpeechRecognition ??
    null
  )
}

const HEBREW_RE = /[֐-׿]/

function isFieldFocused(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

// ── State machine ──────────────────────────────────────────────────────────────
type ShellState = 'idle' | 'listening' | 'recording' | 'parsing' | 'sent'

const DOT_COLOR: Record<ShellState, string> = {
  idle: 'rgba(255, 204, 51, 0.45)',
  listening: '#FFCC33',
  recording: '#ef4444',
  parsing: '#a78bfa',
  sent: '#22c55e',
}

const DOT_GLOW: Record<ShellState, string> = {
  idle: 'rgba(255, 204, 51, 0.55)',
  listening: 'rgba(255, 204, 51, 0.85)',
  recording: 'rgba(239, 68, 68, 0.85)',
  parsing: 'rgba(167, 139, 250, 0.85)',
  sent: 'rgba(34, 197, 94, 0.85)',
}

// ── Dispatch ───────────────────────────────────────────────────────────────────
type DispatchOutcome = {
  /** Whether the command produced a real action (drives green flash). */
  ok: boolean
  /** Status line shown on the footer after the action. */
  msg: string
}

async function dispatchIntent(p: ParsedIntent): Promise<DispatchOutcome> {
  switch (p.intent) {
    case 'add_to_bucket': {
      const r = await fetch('/api/bucket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: p.params.text }),
      }).catch(() => null)
      if (!r || !r.ok) return { ok: false, msg: "Bucket isn't wired yet" }
      return { ok: true, msg: 'Added to bucket' }
    }
    case 'remind': {
      const r = await fetch('/api/bucket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: p.params.text }),
      }).catch(() => null)
      if (!r || !r.ok) return { ok: false, msg: "Reminders aren't wired yet" }
      try {
        const j = (await r.json()) as { id?: string }
        if (j.id) {
          await fetch(`/api/bucket/${j.id}/remind`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minutes: p.params.minutes }),
          }).catch(() => null)
        }
      } catch {
        /* swallow — bucket POST already succeeded */
      }
      return { ok: true, msg: `Reminder set for ${p.params.minutes}m` }
    }
    case 'delegate': {
      const r = await fetch('/api/crew/delegate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: p.params.name, text: p.params.text }),
      }).catch(() => null)
      if (!r || !r.ok) return { ok: false, msg: "Crew isn't wired yet" }
      return { ok: true, msg: `Sent to ${p.params.name}` }
    }
    case 'open_window': {
      window.dispatchEvent(
        new CustomEvent('center:open-window', {
          detail: { target: p.params.target, opts: p.params.opts },
        }),
      )
      return { ok: true, msg: `Opening ${p.params.target}` }
    }
    case 'search': {
      window.dispatchEvent(
        new CustomEvent('center:open-search', {
          detail: { query: p.params.text },
        }),
      )
      return { ok: true, msg: `Search: ${p.params.text}` }
    }
    case 'call': {
      window.dispatchEvent(
        new CustomEvent('center:open-call', {
          detail: { name: p.params.name },
        }),
      )
      return { ok: true, msg: `Calling ${p.params.name}` }
    }
    case 'email': {
      window.dispatchEvent(
        new CustomEvent('center:open-email', {
          detail: {
            name: p.params.name,
            subject: p.params.subject,
            body: p.params.body,
          },
        }),
      )
      return { ok: true, msg: `Email to ${p.params.name}` }
    }
    case 'briefing': {
      window.dispatchEvent(new CustomEvent('center:open-briefing'))
      return { ok: true, msg: 'Briefing' }
    }
    case 'unknown':
    default:
      return { ok: false, msg: "Didn't catch that — try again" }
  }
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function VoiceShell() {
  const [state, setState] = useState<ShellState>('idle')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [lastCommand, setLastCommand] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  // Refs survive re-renders — keyboard listener captures startRecording
  // synchronously, and the SR/MediaRecorder callbacks fire outside React.
  const recogRef = useRef<SRLike | null>(null)
  const accFinalRef = useRef('')
  const interimRef = useRef('')
  const minConfRef = useRef(1)
  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const recordingRef = useRef(false)
  const sentTimerRef = useRef<number | null>(null)

  const cleanup = useCallback(() => {
    try {
      recogRef.current?.abort()
    } catch {
      /* ignore */
    }
    recogRef.current = null
    const mr = mediaRecRef.current
    mediaRecRef.current = null
    if (mr && mr.state !== 'inactive') {
      try {
        mr.stop()
      } catch {
        /* ignore */
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      cleanup()
      if (sentTimerRef.current !== null) {
        window.clearTimeout(sentTimerRef.current)
      }
    }
  }, [cleanup])

  const startRecording = useCallback(async () => {
    if (recordingRef.current) return
    recordingRef.current = true

    if (sentTimerRef.current !== null) {
      window.clearTimeout(sentTimerRef.current)
      sentTimerRef.current = null
    }

    setStatusMsg('')
    setLiveTranscript('')
    accFinalRef.current = ''
    interimRef.current = ''
    minConfRef.current = 1
    audioChunksRef.current = []
    setState('listening')

    // Mic stream + recorder for transcribe-he / transcribe-en fallback.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream)
      mediaRecRef.current = rec
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      rec.start()
    } catch {
      // Mic blocked or unavailable — SpeechRecognition may still work; if it
      // doesn't either, stopRecording will surface the empty-transcript path.
    }

    // Browser-native SpeechRecognition for live English transcript.
    const SR = getSpeechRecognition()
    if (SR) {
      const r = new SR()
      r.lang = 'en-US'
      r.continuous = true
      r.interimResults = true
      r.onresult = (e) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i]
          const alt = result[0]
          const chunk = alt.transcript.trim()
          if (!chunk) continue
          if (result.isFinal) {
            accFinalRef.current = accFinalRef.current
              ? `${accFinalRef.current} ${chunk}`
              : chunk
            if (typeof alt.confidence === 'number' && alt.confidence > 0) {
              minConfRef.current = Math.min(minConfRef.current, alt.confidence)
            }
          } else {
            interim = chunk
          }
        }
        interimRef.current = interim
        const merged = (
          accFinalRef.current + (interim ? ` ${interim}` : '')
        ).trim()
        setLiveTranscript(merged)
      }
      r.onerror = (e) => {
        if (e.error === 'aborted') return
        if (e.error === 'not-allowed') {
          setStatusMsg('Mic blocked — allow mic access')
        } else if (e.error !== 'no-speech') {
          setStatusMsg(`Voice error: ${e.error}`)
        }
      }
      r.onend = () => {
        if (recogRef.current === r) recogRef.current = null
      }
      try {
        r.start()
        recogRef.current = r
      } catch {
        // Already running or denied — MediaRecorder fallback covers it.
      }
    }

    // Promote to "recording" once setup is done.
    setState('recording')
  }, [])

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return
    recordingRef.current = false

    setState('parsing')

    try {
      recogRef.current?.stop()
    } catch {
      /* ignore */
    }
    recogRef.current = null

    // Drain MediaRecorder into a single blob.
    const recorder = mediaRecRef.current
    mediaRecRef.current = null
    let blob: Blob | null = null
    if (recorder && recorder.state !== 'inactive') {
      blob = await new Promise<Blob>((resolve) => {
        const chunks = audioChunksRef.current
        const finalize = () => {
          resolve(
            new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }),
          )
        }
        recorder.onstop = finalize
        try {
          recorder.stop()
        } catch {
          finalize()
        }
      })
    } else if (audioChunksRef.current.length > 0) {
      blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    const srTranscript = (accFinalRef.current || interimRef.current).trim()
    const hasHebrew = HEBREW_RE.test(srTranscript)
    const lowConf = srTranscript.length > 0 && minConfRef.current < 0.5
    const noSR = srTranscript.length === 0

    let finalText = srTranscript
    if (blob && blob.size > 0 && (hasHebrew || lowConf || noSR)) {
      const endpoint = noSR
        ? '/api/voice/transcribe-en'
        : '/api/voice/transcribe-he'
      try {
        const fd = new FormData()
        fd.append(
          'audio',
          new File([blob], 'voice.webm', { type: blob.type }),
        )
        const res = await fetch(endpoint, { method: 'POST', body: fd })
        if (res.ok) {
          const data = (await res.json()) as { text?: string }
          if (data.text) finalText = data.text.trim()
        }
      } catch {
        // Fall back to whatever SR captured (which may be empty).
      }
    }

    setLiveTranscript('')

    if (!finalText) {
      setState('idle')
      setStatusMsg("Didn't catch that — try again")
      setLastCommand('')
      return
    }

    setLastCommand(finalText)

    const parsed = parseCommand(finalText)
    const outcome = await dispatchIntent(parsed)
    setStatusMsg(outcome.msg)
    if (outcome.ok) {
      setState('sent')
      sentTimerRef.current = window.setTimeout(() => {
        setState('idle')
        sentTimerRef.current = null
      }, 1000)
    } else {
      setState('idle')
    }
  }, [])

  // ── Hotkeys ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+V / Cmd+Shift+V — toggles, always works.
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === 'V' || e.key === 'v')
      ) {
        e.preventDefault()
        if (recordingRef.current) void stopRecording()
        else void startRecording()
        return
      }

      // Hold spacebar — only when no field focused, no modifiers, no auto-repeat.
      if (
        e.code === 'Space' &&
        !e.repeat &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.shiftKey
      ) {
        if (isFieldFocused()) return
        e.preventDefault()
        void startRecording()
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && recordingRef.current) {
        e.preventDefault()
        void stopRecording()
      }
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [startRecording, stopRecording])

  // ── Render ────────────────────────────────────────────────────────────────
  const pulsing =
    state === 'listening' || state === 'recording' || state === 'parsing'

  const leftLine = (() => {
    if (state === 'idle') {
      return statusMsg || 'Hold space to talk'
    }
    if (state === 'listening') return 'Listening…'
    if (state === 'recording') return liveTranscript || 'Recording…'
    if (state === 'parsing') return 'Parsing…'
    return statusMsg || 'Sent'
  })()

  return (
    <>
      <style>{`
        @keyframes voice-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.18); opacity: 0.7; }
        }
        @keyframes voice-flash {
          0%   { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55); }
          100% { box-shadow: 0 0 0 14px rgba(34, 197, 94, 0); }
        }
      `}</style>
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: DOT_COLOR[state],
          boxShadow: `0 0 0 1px ${DOT_GLOW[state]}`,
          flexShrink: 0,
          transition: 'background 0.18s, box-shadow 0.18s',
          animation: pulsing
            ? 'voice-pulse 1.1s ease-in-out infinite'
            : state === 'sent'
              ? 'voice-flash 1s ease-out'
              : undefined,
        }}
      />
      <span
        aria-live="polite"
        style={{
          color: state === 'recording' && liveTranscript ? '#FFE0A8' : '#F5EFD8',
          fontSize: 16,
          fontWeight: 500,
          letterSpacing: '0.02em',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {leftLine}
      </span>
      {lastCommand && state !== 'recording' && (
        <span
          aria-hidden
          style={{
            color: 'rgba(245, 239, 216, 0.55)',
            fontSize: 13,
            fontWeight: 400,
            letterSpacing: '0.02em',
            flexShrink: 0,
            maxWidth: '40%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={lastCommand}
        >
          “{lastCommand}”
        </span>
      )}
    </>
  )
}
