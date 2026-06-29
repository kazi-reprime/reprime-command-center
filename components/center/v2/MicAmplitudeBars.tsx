'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * MicAmplitudeBars — 8 thin vertical bars, height driven by the
 * AnalyserNode on the active mic stream. Lives next to the recording-state
 * VoiceMicHero and only renders while the parent is in `recording` state.
 *
 * Implemented stand-alone instead of borrowing VoiceShell internals because
 * VoiceShell owns its own SpeechRecognition + MediaRecorder; we just need
 * a shared visual.
 */
const BARS = 8

type Props = {
  /** When true, request a mic stream and animate. When false, idle bars. */
  active: boolean
}

export default function MicAmplitudeBars({ active }: Props) {
  const [levels, setLevels] = useState<number[]>(() =>
    new Array(BARS).fill(0.15),
  )
  const audioRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) {
      cleanup()
      setLevels((prev) => prev.map(() => 0.15))
      return
    }

    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new Ctx()
        const src = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 64
        src.connect(analyser)
        audioRef.current = ctx
        analyserRef.current = analyser

        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteFrequencyData(data)
          // Pick BARS evenly-spaced bins, normalize 0..1.
          const step = Math.floor(data.length / BARS)
          const next = new Array<number>(BARS)
          for (let i = 0; i < BARS; i++) {
            const v = data[i * step] / 255
            next[i] = Math.max(0.15, v)
          }
          setLevels(next)
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch {
        // Mic blocked — fall back to a soft idle pulse.
      }
    }

    void start()

    return () => {
      cancelled = true
      cleanup()
    }
  }, [active])

  function cleanup() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (audioRef.current && audioRef.current.state !== 'closed') {
      audioRef.current.close().catch(() => {})
    }
    audioRef.current = null
    analyserRef.current = null
  }

  return (
    <div
      aria-hidden
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: 24,
      }}
    >
      {levels.map((v, i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: `${Math.round(8 + v * 22)}px`,
            background: '#FFCC33',
            opacity: 0.55 + v * 0.45,
            borderRadius: 2,
            transition: 'height 80ms linear',
          }}
        />
      ))}
    </div>
  )
}
