'use client'

import { useEffect, useRef, useState } from 'react'

type Language = 'en' | 'he'
type State = 'idle' | 'recording'

type Props = {
  language: Language
  onTranscript: (text: string, rtl?: boolean) => void
}

// ── Browser Speech Recognition type shim ─────────────────────────────────────
// The Web Speech API is implemented in Chrome/Edge. TypeScript's lib.dom doesn't
// always include the webkit-prefixed variant; cast through unknown to be safe.
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: { readonly transcript: string }
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: { length: number; [index: number]: SpeechRecognitionResultLike }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  return (
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition ??
    null
  )
}

const FLAG: Record<Language, string> = { en: '🇺🇸', he: '🇮🇱' }
const LABEL: Record<Language, string> = { en: 'EN', he: 'HE' }

export default function MicButton({ language, onTranscript }: Props) {
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)
  const recogRef = useRef<SpeechRecognitionLike | null>(null)
  const accRef = useRef<string>('')      // accumulated final results
  const interimRef = useRef<string>('')  // latest interim (fallback if finals empty)

  // Cleanup on unmount
  useEffect(() => {
    return () => { recogRef.current?.abort() }
  }, [])

  const start = () => {
    const SpeechRec = getSpeechRecognition()
    if (!SpeechRec) {
      setError('Speech recognition not supported — use Chrome or Edge')
      return
    }

    setError(null)
    accRef.current = ''
    interimRef.current = ''

    const rec = new SpeechRec()
    rec.lang = language === 'he' ? 'he-IL' : 'en-US'
    rec.continuous = true
    rec.interimResults = true  // capture interim too — used as fallback in onend

    rec.onresult = (e: SpeechRecognitionEventLike) => {
      let latestInterim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript.trim()
        if (!chunk) continue
        if (e.results[i].isFinal) {
          accRef.current = accRef.current ? `${accRef.current} ${chunk}` : chunk
        } else {
          latestInterim = chunk
        }
      }
      if (latestInterim) interimRef.current = latestInterim
    }

    rec.onerror = (e: { error: string }) => {
      // 'aborted' fires when we call abort() — not a real error
      if (e.error !== 'aborted') {
        setError(
          e.error === 'no-speech'
            ? 'No speech detected'
            : e.error === 'not-allowed'
            ? 'Microphone blocked — allow mic access in browser'
            : e.error
        )
      }
      setState('idle')
      recogRef.current = null
    }

    rec.onend = () => {
      // Chrome sometimes fires onend before delivering the final onresult.
      // Fall back to the last interim result so the transcript is never lost.
      const text = (accRef.current || interimRef.current).trim()
      if (text) onTranscript(text, language === 'he')
      setState('idle')
      recogRef.current = null
    }

    try {
      rec.start()
      recogRef.current = rec
      setState('recording')
    } catch {
      setError('Could not start microphone')
      setState('idle')
    }
  }

  const stop = () => {
    // .stop() asks recognition to finalize any in-progress speech before ending
    // (vs .abort() which discards it). onend fires after final onresult.
    recogRef.current?.stop()
  }

  const onClick = () => {
    if (state === 'idle') start()
    else stop()
  }

  const recording = state === 'recording'

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '0.3rem 0.55rem',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: '1.5px solid',
    transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
    userSelect: 'none',
    outline: 'none',
  }

  const style: React.CSSProperties = recording
    ? {
        ...baseStyle,
        background: '#dc2626',
        borderColor: '#ef4444',
        color: '#fff',
        boxShadow: '0 0 0 3px rgba(220,38,38,0.35)',
        animation: 'mic-pulse 1s ease-in-out infinite',
      }
    : {
        ...baseStyle,
        background: 'rgba(255,255,255,0.07)',
        borderColor: 'rgba(255,255,255,0.18)',
        color: '#fff',
      }

  return (
    <>
      <style>{`
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(220,38,38,0.35); }
          50%       { box-shadow: 0 0 0 6px rgba(220,38,38,0.15); }
        }
      `}</style>
      <button
        type="button"
        onClick={onClick}
        title={
          error
            ? `⚠ ${error}`
            : recording
            ? `Click to stop — transcript will appear in the box (${LABEL[language]})`
            : `Record voice in ${language === 'he' ? 'Hebrew' : 'English'} — click once to start, again to stop`
        }
        aria-label={`Record voice in ${language === 'he' ? 'Hebrew' : 'English'}`}
        style={style}
      >
        <span aria-hidden>{FLAG[language]}</span>
        <span aria-hidden>{recording ? '⏹' : '🎤'}</span>
        <span>{LABEL[language]}</span>
      </button>
    </>
  )
}
