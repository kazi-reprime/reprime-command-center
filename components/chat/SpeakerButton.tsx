'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  text: string
}

const HEBREW_RE = /[֐-׿]/

function detectHebrew(text: string): boolean {
  return HEBREW_RE.test(text)
}

type State = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

export default function SpeakerButton({ text }: Props) {
  const [state, setState] = useState<State>('idle')
  const [speed, setSpeed] = useState<number>(1)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [])

  // If text changes, drop the cached audio.
  useEffect(() => {
    audioRef.current?.pause()
    audioRef.current = null
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setState('idle')
  }, [text])

  // Update speed of existing audio element if it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed])

  const fetchAudio = async (): Promise<HTMLAudioElement> => {
    const language = detectHebrew(text) ? 'he' : 'en'
    const res = await fetch('/api/voice/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Speak failed (${res.status}) ${detail}`)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    urlRef.current = url
    const audio = new Audio(url)
    audio.onended = () => setState('idle')
    audio.onpause = () => {
      if (!audio.ended) setState('paused')
    }
    audio.onplay = () => setState('playing')
    audio.playbackRate = speed
    audioRef.current = audio
    return audio
  }

  const onClick = async () => {
    if (!text.trim()) return
    if (state === 'playing') {
      audioRef.current?.pause()
      return
    }
    if (state === 'paused' && audioRef.current) {
      void audioRef.current.play()
      return
    }
    setState('loading')
    try {
      const audio = audioRef.current ?? (await fetchAudio())
      await audio.play()
    } catch (e) {
      console.error(e)
      setState('error')
    }
  }

  const icon =
    state === 'loading'
      ? (
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              animation: 'spin 0.7s linear infinite',
            }}
          />
        )
      : state === 'playing'
        ? '⏸'
        : '🔊'

  return (
    <>
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'loading' || !text.trim()}
      title={
        state === 'error'
          ? 'Playback failed'
          : state === 'playing'
            ? 'Pause'
            : 'Read aloud'
      }
      aria-label="Read aloud"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.3rem 0.55rem',
        borderRadius: 6,
        fontSize: 14,
        border: '1.5px solid',
        borderColor: state === 'error' ? '#ef4444' : state === 'playing' ? '#22c55e' : 'rgba(255,255,255,0.18)',
        background: state === 'playing' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)',
        color: state === 'error' ? '#ef4444' : '#fff',
        cursor: (state === 'loading' || !text.trim()) ? 'not-allowed' : 'pointer',
        opacity: (state === 'loading' || !text.trim()) ? 0.5 : 1,
        fontFamily: 'inherit',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {icon}
    </button>
    <button
      type="button"
      onClick={() => setSpeed(s => s === 1 ? 1.5 : s === 1.5 ? 2 : 1)}
      disabled={state === 'loading'}
      title="Playback Speed"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.3rem 0.4rem',
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 4,
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.18)',
        color: '#fff',
        cursor: 'pointer',
      }}
    >
      {speed}x
    </button>
    </>
  )
}
