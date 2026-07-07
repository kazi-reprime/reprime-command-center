/**
 * useNoraVoice — Talk-to-Nora voice session management
 *
 * Records audio → sends to /api/nora/voice → plays back TTS response.
 * REST-based turn-taking (no WebSocket needed).
 */

'use client'

import { useCallback, useRef, useState } from 'react'

interface VoiceTurn {
  transcript: string
  reply: string
  language: string
  audioUrl: string | null
  agentId?: string
}

export function useNoraVoice() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [turns, setTurns] = useState<VoiceTurn[]>([])
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.start(250) // Collect in 250ms chunks
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
    } catch (err) {
      setError(`Microphone access failed: ${(err as Error).message}`)
    }
  }, [])

  const stopRecording = useCallback(async () => {
    const mediaRecorder = mediaRecorderRef.current
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return

    return new Promise<void>((resolve) => {
      mediaRecorder.onstop = async () => {
        setIsRecording(false)
        setIsProcessing(true)

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          const arrayBuffer = await audioBlob.arrayBuffer()
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              '',
            ),
          )

          // Build history from previous turns
          const history = turns.flatMap(t => [
            { role: 'user', content: t.transcript },
            { role: 'assistant', content: t.reply },
          ])

          const res = await fetch('/api/nora/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio: base64,
              format: 'webm',
              history,
            }),
          })

          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || `Voice API failed: ${res.status}`)
          }

          const result = await res.json() as VoiceTurn

          setTurns(prev => [...prev, result])

          // Play back TTS audio if available
          if (result.audioUrl) {
            playAudio(result.audioUrl)
          }
        } catch (err) {
          setError((err as Error).message)
        } finally {
          setIsProcessing(false)
        }

        // Stop all tracks
        mediaRecorder.stream.getTracks().forEach(t => t.stop())
        resolve()
      }

      mediaRecorder.stop()
    })
  }, [turns])

  const playAudio = useCallback((url: string) => {
    setIsPlaying(true)
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => setIsPlaying(false)
    audio.onerror = () => setIsPlaying(false)
    audio.play().catch(() => setIsPlaying(false))
  }, [])

  const stopPlayback = useCallback(() => {
    audioRef.current?.pause()
    setIsPlaying(false)
  }, [])

  const clearHistory = useCallback(() => {
    setTurns([])
    setError(null)
  }, [])

  return {
    isRecording,
    isProcessing,
    isPlaying,
    turns,
    error,
    startRecording,
    stopRecording,
    stopPlayback,
    clearHistory,
    lastTurn: turns[turns.length - 1] || null,
  }
}
