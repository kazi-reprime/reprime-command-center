/* eslint-disable */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store/useStore'
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
    default: {
      // Send to Nora AI and get a real reply
      const userMessage = p.raw || ''
      try {
        // Broadcast thinking status
        window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'thinking' } }))

        const res = await fetch('/api/nora/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage }),
        })

        if (!res.ok) return { ok: false, msg: 'Nora couldn\'t respond — try again' }

        const data = await res.json() as { reply?: string; message?: string }
        const reply = data.reply || data.message || ''

        if (!reply) return { ok: false, msg: 'No response from Nora' }

        // Save conversation as a note
        fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Voice: ' + userMessage.slice(0, 50),
            content: '**You said:** ' + userMessage + '\n\n**Nora replied:** ' + reply,
            tags: ['nora-voice', 'auto-transcription'],
          }),
        }).catch(() => {}) // Fire and forget

        // Speak the reply via ElevenLabs TTS
        window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'speaking' } }))
        try {
          const ttsRes = await fetch('/api/voice/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: reply }),
          })
          if (ttsRes.ok) {
            const audioBlob = await ttsRes.blob()
            const audioUrl = URL.createObjectURL(audioBlob)
            const audio = new Audio(audioUrl)
            await audio.play().catch(() => {})
            audio.onended = () => {
              URL.revokeObjectURL(audioUrl)
              window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'idle' } }))
            }
          } else {
            window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'idle' } }))
          }
        } catch (e) {
          window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'idle' } }))
        }
      } catch (e) {
        window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'idle' } }))
      }

      return { ok: true, msg: '' }
    }
  }
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function VoiceShell() {
  const [state, setState] = useState<ShellState>('idle')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [lastCommand, setLastCommand] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const setNoraStatus = useStore(s => s.setNoraStatus)
  const isSpeaking = useStore(s => s.noraStatus === 'speaking')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nora-state-change', { detail: { state } }))
      // Sync state to global store if needed
      if (state === 'recording') setNoraStatus('listening')
      else if (state === 'parsing') setNoraStatus('thinking')
      else if (state === 'idle' || state === 'sent') setNoraStatus('idle')
    }
  }, [state, setNoraStatus])

  const recogRef = useRef<SRLike | null>(null)
  const accFinalRef = useRef('')
  const interimRef = useRef('')
  const minConfRef = useRef(1)
  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const recordingRef = useRef(false)
  const sentTimerRef = useRef<number | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const handleStop = () => {
      // 1. Abort any pending fetch (AI request or TTS)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }

      // 2. Kill current audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current.src = ''
        currentAudioRef.current = null
      }

      // 3. Reset states
      setState('idle')
      setNoraStatus('idle')
      window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'idle' } }))
    }
    window.addEventListener('nora:stop-speaking', handleStop)
    return () => window.removeEventListener('nora:stop-speaking', handleStop)
  }, [setNoraStatus])

  const handleDispatchIntent = useCallback(async (p: ParsedIntent): Promise<DispatchOutcome> => {
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
        } catch {}
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
      case 'briefing':
        window.dispatchEvent(new Event('center:open-briefing'))
        return { ok: true, msg: 'Opening morning briefing...' }

      case 'stop':
        window.dispatchEvent(new Event('nora:stop-speaking'))
        return { ok: true, msg: 'Stopping...' }

      case 'unknown':
      default: {
        const userMessage = p.raw || ''
        try {
          // If already busy, kill previous
          if (abortControllerRef.current) abortControllerRef.current.abort()
          const ctrl = new AbortController()
          abortControllerRef.current = ctrl

          window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'thinking' } }))
          setNoraStatus('thinking')
          const res = await fetch('/api/nora/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage }),
            signal: ctrl.signal,
          })
          if (!res.ok) {
            setNoraStatus('idle')
            return { ok: false, msg: 'Nora couldn\'t respond' }
          }
          const data = await res.json() as { reply?: string; message?: string }
          const reply = data.reply || data.message || ''
          if (!reply) {
            setNoraStatus('idle')
            return { ok: false, msg: 'No response from Nora' }
          }

          fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: 'Voice: ' + userMessage.slice(0, 50),
              content: '**You said:** ' + userMessage + '\n\n**Nora replied:** ' + reply,
              tags: ['nora-voice', 'auto-transcription'],
            }),
          }).catch(() => {})

          window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'speaking' } }))
          setNoraStatus('speaking')
          try {
            const ttsRes = await fetch('/api/voice/speak', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: reply }),
              signal: ctrl.signal,
            })
            if (ttsRes.ok) {
              const audioBlob = await ttsRes.blob()
              const audioUrl = URL.createObjectURL(audioBlob)
              const audio = new Audio(audioUrl)
              currentAudioRef.current = audio
              await audio.play().catch(() => {})
              audio.onended = () => {
                URL.revokeObjectURL(audioUrl)
                currentAudioRef.current = null
                setNoraStatus('idle')
                window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'idle' } }))
              }
            } else {
              setNoraStatus('idle')
              window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'idle' } }))
            }
          } catch {
            setNoraStatus('idle')
            window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'idle' } }))
          }
          window.dispatchEvent(new CustomEvent('nora:reply', { detail: { text: reply } }))
          return { ok: true, msg: reply.slice(0, 100) }
        } catch (err) {
          if ((err as Error).name === 'AbortError') return { ok: true, msg: 'Stopped' }
          setNoraStatus('idle')
          window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'idle' } }))
          return { ok: false, msg: 'Error: ' + (err as Error).message }
        } finally {
          abortControllerRef.current = null
        }
      }
    }
  }, [])

  const cleanup = useCallback(() => {
    try {
      recogRef.current?.abort()
    } catch {}
    recogRef.current = null
    const mr = mediaRecRef.current
    mediaRecRef.current = null
    if (mr && mr.state !== 'inactive') {
      try { mr.stop() } catch {}
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      cleanup()
      if (sentTimerRef.current !== null) window.clearTimeout(sentTimerRef.current)
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream)
      mediaRecRef.current = rec
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      rec.start()
    } catch {}
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
      } catch {}
    }
    setState('recording')
  }, [])

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return
    recordingRef.current = false
    setState('parsing')
    try { recogRef.current?.stop() } catch {}
    recogRef.current = null
    const recorder = mediaRecRef.current
    mediaRecRef.current = null
    let blob: Blob | null = null
    if (recorder && recorder.state !== 'inactive') {
      blob = await new Promise<Blob>((resolve) => {
        const chunks = audioChunksRef.current
        const finalize = () => {
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        }
        recorder.onstop = finalize
        try { recorder.stop() } catch { finalize() }
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
      const endpoint = noSR ? '/api/voice/transcribe-en' : '/api/voice/transcribe-he'
      try {
        const fd = new FormData()
        fd.append('audio', new File([blob], 'voice.webm', { type: blob.type }))
        const res = await fetch(endpoint, { method: 'POST', body: fd })
        if (res.ok) {
          const data = (await res.json()) as { text?: string }
          if (data.text) finalText = data.text.trim()
        }
      } catch {}
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
    const outcome = await handleDispatchIntent(parsed)
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
  }, [handleDispatchIntent])

  useEffect(() => {
    const onStart = () => {
      void startRecording()
    }
    const onStop = () => {
      stopRecording()
    }
    const onInterrupted = () => {
      // Handled by handleStop in another useEffect, but good to have here too
      stopRecording()
    }

    window.addEventListener('nora:start-recording', onStart)
    window.addEventListener('nora:stop-recording', onStop)
    window.addEventListener('nora:stop-speaking', onInterrupted)

    return () => {
      window.removeEventListener('nora:start-recording', onStart)
      window.removeEventListener('nora:stop-recording', onStop)
      window.removeEventListener('nora:stop-speaking', onInterrupted)
    }
  }, [startRecording, stopRecording])

  const pulsing = state === 'listening' || state === 'recording' || state === 'parsing'
  const leftLine = (() => {
    if (state === 'idle') return statusMsg || 'READY FOR COMMANDS'
    if (state === 'listening') return 'PREPARING AUDIO CAPTURE...'
    if (state === 'recording') return liveTranscript || 'LISTENING...'
    if (state === 'parsing') return 'SYNTHESIZING INTENT...'
    return statusMsg || 'COMMAND EXECUTED'
  })()

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      fontFamily: 'inherit',
      position: 'relative',
    }}>
      <style>{`
        @keyframes waveform-bounce {
          0%, 100% { height: 4px; }
          50% { height: 20px; }
        }
        .waveform-bar {
          width: 3px;
          background: #FFCC33;
          border-radius: 99px;
          transition: height 0.2s ease-in-out;
        }
        @keyframes voice-pulse-glow {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.4); opacity: 0.6; }
        }
      `}</style>

      {/* ── Status Indicator (Orb) ── */}
      <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: DOT_COLOR[state],
          boxShadow: `0 0 20px ${DOT_GLOW[state]}`,
          transition: 'all 0.3s ease',
          animation: pulsing ? 'voice-pulse-glow 1.2s ease-in-out infinite' : undefined,
        }} />
      </div>

      {/* ── Waveform (Visualizer) ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 3, width: 44, height: 20, flexShrink: 0,
        opacity: pulsing ? 1 : 0.1, transition: 'opacity 0.3s ease'
      }}>
        {[1,2,3,4,5,6,7,8].map(i => (
          <div key={i} className="waveform-bar" style={{
            animation: pulsing ? `waveform-bounce 0.8s ease-in-out infinite ${i * 0.1}s` : 'none',
            background: state === 'recording' ? '#ef4444' : state === 'parsing' ? '#A855F7' : '#FFCC33',
            height: pulsing ? undefined : 4
          }} />
        ))}
      </div>

      {/* ── Live Transcript / Status Text ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          fontSize: 9, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: pulsing ? DOT_COLOR[state] : 'rgba(255,204,51,0.4)',
          marginBottom: 1, transition: 'color 0.3s'
        }}>
          {state === 'idle' ? 'Nora System' : `Mode: ${state}`}
        </div>
        <div style={{
          fontSize: 14, fontWeight: 700, color: '#fff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: '-0.01em', textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
          {leftLine}
        </div>
      </div>

      {/* ── Last Command Shadow ── */}
      {lastCommand && state === 'idle' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
          background: 'rgba(255,204,51,0.04)', borderRadius: 12, border: '1px solid rgba(255,204,51,0.08)',
          maxWidth: 300, flexShrink: 1, overflow: 'hidden'
        }}>
          <span style={{ fontSize: 9, fontWeight: 900, color: 'rgba(255,204,51,0.3)', textTransform: 'uppercase' }}>Last</span>
          <span style={{ fontSize: 11, color: 'rgba(255,204,51,0.6)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{lastCommand}</span>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {(noraStatus === 'speaking' || noraStatus === 'thinking') && (
          <button
            onClick={() => window.dispatchEvent(new Event('nora:stop-speaking'))}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 99, padding: '8px 20px',
              color: '#ef4444', fontSize: 11, fontWeight: 900,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              textTransform: 'uppercase', letterSpacing: '0.12em',
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.2)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'
              e.currentTarget.style.transform = 'scale(1.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            <span style={{ fontSize: 16 }}>⏹</span> STOP NORA
          </button>
        )}
        
        <div style={{
          fontSize: 10, fontWeight: 800, color: 'rgba(255,204,51,0.25)',
          background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: 8,
          border: '1px solid rgba(255,204,51,0.05)', whiteSpace: 'nowrap'
        }}>
          HOLD <span style={{ color: '#FFCC33' }}>SPACE</span> TO TALK
        </div>
      </div>
    </div>
  )
}
