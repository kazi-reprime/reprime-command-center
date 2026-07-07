/**
 * useNora — Single unified hook for all Nora AI interactions.
 *
 * Every Nora surface (NoraFloating, NoraDeskColumn, VoiceShell, Command
 * Palette) uses this hook instead of duplicating fetch/state logic.
 *
 * Provides:
 * - sendMessage(text) — send a text message to Nora
 * - sendVoice(audioBlob) — send voice audio for STT → Nora → TTS
 * - approve(approvalId) — approve a pending high-impact action
 * - dismiss(approvalId) — dismiss a pending approval
 * - messages — shared conversation history (from Zustand)
 * - status — 'idle' | 'thinking' | 'speaking' | 'listening'
 * - toolTrace — array of tool calls Nora made in the last turn
 * - pendingApprovals — actions waiting for user confirmation
 */

'use client'

import { useCallback, useRef, useState } from 'react'
import { useStore } from '@/lib/store/useStore'
import type { NoraMessage } from '@/lib/store/useStore'
import { buildNoraContext } from '@/lib/nora/noraContext'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ToolTraceEntry {
  agentId: string
  toolName: string
  input: Record<string, unknown>
  output: string
  durationMs: number
}

export interface PendingApproval {
  id: string
  action: string
  description: string
  agentId: string
  params: Record<string, unknown>
}

interface NoraResponse {
  reply: string
  language?: 'en' | 'he'
  agentId?: string
  toolTrace?: ToolTraceEntry[]
  pendingApprovals?: PendingApproval[]
  provider?: string
  error?: string
}

interface VoiceResponse {
  transcript: string
  reply: string
  language?: string
  audioUrl?: string | null
  agentId?: string
  toolTrace?: ToolTraceEntry[]
  error?: string
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useNora() {
  const [toolTrace, setToolTrace] = useState<ToolTraceEntry[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [activeToolName, setActiveToolName] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Read from shared store
  const messages = useStore(s => s.noraMessages)
  const noraStatus = useStore(s => s.noraStatus)
  const addNoraMessage = useStore(s => s.addNoraMessage)
  const setNoraStatus = useStore(s => s.setNoraStatus)
  const language = useStore(s => s.language)
  const updateLastNoraMessage = useStore(s => s.updateLastNoraMessage)
  const removeLastEmptyNoraMessage = useStore(s => s.removeLastEmptyNoraMessage)

  const isLoading = noraStatus === 'thinking'

  // ── Send Text Message ──────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string): Promise<string | null> => {
    const trimmed = text.trim()
    if (!trimmed) return null

    // If Nora is already responding, interrupt her first
    if (isLoading) {
      abortRef.current?.abort()
      removeLastEmptyNoraMessage()
    }

    // Abort any in-flight request and start fresh
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    // Add user message to shared store
    const userMsg: NoraMessage = { sender: 'user', text: trimmed, timestamp: new Date() }
    addNoraMessage(userMsg)

    // Update status
    setNoraStatus('thinking')
    setActiveToolName(null)
    setToolTrace([])
    setPendingApprovals([])

    // Broadcast for backwards compatibility with CustomEvent listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'thinking' } }))
    }

    try {
      // Build context from shared store + browser state
      const context = buildNoraContext()

      // Build conversation history (last 10 turns)
      const history = messages.slice(-10).map(m => ({
        role: m.sender === 'nora' ? 'assistant' as const : 'user' as const,
        content: m.text,
      }))

      const res = await fetch('/api/nora/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          lang: language === 'HE' ? 'he' : 'en',
          history,
          context,
        }),
        signal: abortRef.current.signal,
      })

      if (res.ok) {
        const data: NoraResponse = await res.json()
        const reply = data.reply || data.error || 'I couldn\'t process that. Try again.'

        // Store tool trace
        if (data.toolTrace?.length) {
          setToolTrace(data.toolTrace)
        }

        // Store pending approvals
        if (data.pendingApprovals?.length) {
          setPendingApprovals(data.pendingApprovals)
        }

        // Add assistant message
        const assistantMsg: NoraMessage = {
          sender: 'nora',
          text: reply,
          agentId: data.agentId,
          timestamp: new Date(),
        }
        addNoraMessage(assistantMsg)

        // Broadcast reply for backwards compat
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('nora:reply', { detail: { text: reply, agentId: data.agentId } }))
        }

        return reply
      } else {
        const errorMsg = 'Something went wrong. Please try again.'
        addNoraMessage({ sender: 'nora', text: errorMsg, timestamp: new Date() })
        return null
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null

      const errorMsg = 'Network error. Check your connection.'
      addNoraMessage({ sender: 'nora', text: errorMsg, timestamp: new Date() })
      return null
    } finally {
      setNoraStatus('idle')
      setActiveToolName(null)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'idle' } }))
      }
    }
  }, [isLoading, messages, language, addNoraMessage, setNoraStatus, removeLastEmptyNoraMessage])

  // ── Send Voice ─────────────────────────────────────────────────────────

  const sendVoice = useCallback(async (audioBlob: Blob): Promise<VoiceResponse | null> => {
    if (isLoading) return null

    setNoraStatus('listening')

    try {
      // Convert blob to base64
      const buffer = await audioBlob.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))

      const history = messages.slice(-10).map(m => ({
        role: m.sender === 'nora' ? 'assistant' as const : 'user' as const,
        content: m.text,
      }))

      setNoraStatus('thinking')

      const res = await fetch('/api/nora/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: base64,
          format: 'webm',
          language: language === 'HE' ? 'he' : undefined,
          history,
        }),
      })

      if (res.ok) {
        const data: VoiceResponse = await res.json()

        // Add both user transcript and assistant reply to store
        if (data.transcript) {
          addNoraMessage({ sender: 'user', text: data.transcript, timestamp: new Date() })
        }
        if (data.reply) {
          addNoraMessage({
            sender: 'nora',
            text: data.reply,
            agentId: data.agentId,
            timestamp: new Date(),
          })
        }

        if (data.toolTrace?.length) {
          setToolTrace(data.toolTrace)
        }

        // Play TTS audio if available
        if (data.audioUrl && typeof window !== 'undefined') {
          setNoraStatus('speaking')
          try {
            const audio = new Audio(data.audioUrl)
            audio.onended = () => setNoraStatus('idle')
            audio.onerror = () => setNoraStatus('idle')
            await audio.play()
          } catch {
            setNoraStatus('idle')
          }
        }

        return data
      }
      return null
    } catch {
      addNoraMessage({ sender: 'nora', text: 'Voice processing failed. Try typing instead.', timestamp: new Date() })
      return null
    } finally {
      if (noraStatus !== 'speaking') {
        setNoraStatus('idle')
      }
    }
  }, [isLoading, messages, language, addNoraMessage, setNoraStatus, noraStatus])

  // ── Approve / Dismiss ──────────────────────────────────────────────────

  const approve = useCallback(async (approvalId: string) => {
    const approval = pendingApprovals.find(a => a.id === approvalId)
    if (!approval) return

    setNoraStatus('thinking')
    try {
      const res = await fetch('/api/nora/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, action: approval.action, params: approval.params }),
      })

      if (res.ok) {
        const data = await res.json() as { reply?: string; success?: boolean }
        addNoraMessage({
          sender: 'nora',
          text: data.reply || `✅ ${approval.description} — done.`,
          timestamp: new Date(),
        })
      } else {
        addNoraMessage({
          sender: 'nora',
          text: `❌ Failed to execute: ${approval.description}`,
          timestamp: new Date(),
        })
      }
    } catch {
      addNoraMessage({
        sender: 'nora',
        text: 'Network error while executing action.',
        timestamp: new Date(),
      })
    } finally {
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId))
      setNoraStatus('idle')
    }
  }, [pendingApprovals, addNoraMessage, setNoraStatus])

  const dismiss = useCallback((approvalId: string) => {
    setPendingApprovals(prev => prev.filter(a => a.id !== approvalId))
    addNoraMessage({
      sender: 'nora',
      text: 'Action cancelled.',
      timestamp: new Date(),
    })
  }, [addNoraMessage])

  // ── Cancel / Interrupt ─────────────────────────────────────────────────

  const cancel = useCallback(() => {
    // 1. Abort any in-flight HTTP request (chat or streaming)
    abortRef.current?.abort()
    abortRef.current = null

    // 2. Clean up empty streaming placeholder (if streaming hadn't produced text yet)
    removeLastEmptyNoraMessage()

    // 3. If the last Nora message has partial content, mark it as interrupted
    const currentMessages = useStore.getState().noraMessages
    const lastMsg = currentMessages[currentMessages.length - 1]
    if (lastMsg && lastMsg.sender === 'nora' && lastMsg.text.length > 1) {
      const updateLast = useStore.getState().updateLastNoraMessage
      // Only add the marker if it doesn't already end with one
      if (!lastMsg.text.endsWith('⏹')) {
        updateLast(lastMsg.text.trimEnd() + ' ⏹')
      }
    }

    // 4. Reset all status
    setNoraStatus('idle')
    setActiveToolName(null)

    // 5. Broadcast for any listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'idle' } }))
      window.dispatchEvent(new CustomEvent('nora:interrupted'))
    }
  }, [setNoraStatus, removeLastEmptyNoraMessage])

  // ── Send Streaming Message (SSE) ───────────────────────────────────────

  const sendStreamingMessage = useCallback(async (text: string): Promise<string | null> => {
    const trimmed = text.trim()
    if (!trimmed) return null

    // Interrupt any in-progress response
    if (isLoading) {
      abortRef.current?.abort()
      removeLastEmptyNoraMessage()
    }

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const userMsg: NoraMessage = { sender: 'user', text: trimmed, timestamp: new Date() }
    addNoraMessage(userMsg)
    setNoraStatus('thinking')
    setToolTrace([])

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'thinking' } }))
    }

    try {
      const context = buildNoraContext()
      const history = messages.slice(-10).map(m => ({
        role: m.sender === 'nora' ? 'assistant' as const : 'user' as const,
        content: m.text,
      }))

      const res = await fetch('/api/nora/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history, context }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        // Fallback to non-streaming
        return sendMessage(trimmed)
      }

      // Add a placeholder message that we'll update
      addNoraMessage({ sender: 'nora', text: '', timestamp: new Date() })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullReply = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6)) as { type: string; text?: string; name?: string; reply?: string; message?: string; durationMs?: number }
            if (data.type === 'token') {
              fullReply += data.text
              updateLastNoraMessage(fullReply)
            } else if (data.type === 'tool_start') {
              setActiveToolName(data.name ?? null)
            } else if (data.type === 'tool_end') {
              setActiveToolName(null)
              setToolTrace(prev => [...prev, {
                agentId: 'orchestrator',
                toolName: data.name || 'unknown',
                input: {},
                output: '',
                durationMs: data.durationMs || 0,
              }])
            } else if (data.type === 'done') {
              updateLastNoraMessage(data.reply || fullReply)
            } else if (data.type === 'error') {
              updateLastNoraMessage(`⚠️ ${data.message}`)
            }
          } catch { /* skip malformed SSE lines */ }
        }
      }

      return fullReply || null
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null
      addNoraMessage({ sender: 'nora', text: 'Network error. Check your connection.', timestamp: new Date() })
      return null
    } finally {
      setNoraStatus('idle')
      setActiveToolName(null)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'idle' } }))
      }
    }
  }, [isLoading, messages, addNoraMessage, setNoraStatus, updateLastNoraMessage, sendMessage, removeLastEmptyNoraMessage])

  return {
    // State
    messages,
    status: noraStatus,
    isLoading,
    toolTrace,
    pendingApprovals,
    activeToolName,

    // Actions
    sendMessage,
    sendStreamingMessage,
    sendVoice,
    approve,
    dismiss,
    cancel,
  }
}
