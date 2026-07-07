/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { useEffect, useRef, useState } from 'react'
import { useNora } from '@/hooks/useNora'

/**
 * NoraFloating — Floating AI assistant accessible from anywhere in the cockpit.
 * Purple gradient bubble in bottom-right corner, expands to full chat panel.
 *
 * Uses the unified useNora() hook — all state is shared across
 * NoraDeskColumn, VoiceShell, and Command Palette.
 */
export default function NoraFloating() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [pendingQuickReply, setPendingQuickReply] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    messages,
    status,
    isLoading,
    toolTrace,
    pendingApprovals,
    sendMessage,
    approve,
    dismiss,
    cancel,
  } = useNora()

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Global keyboard shortcut: Ctrl+Shift+N
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'N' || e.key === 'n')) {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)

    // Listen for focus events from the header "Talk to Nora" button
    const focusHandler = () => setOpen(true)
    window.addEventListener('center:focus-nora', focusHandler)

    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('center:focus-nora', focusHandler)
    }
  }, [])

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride || input).trim()
    if (!text || isLoading) return
    setInput('')
    await sendMessage(text)
  }

  // Handle quick-reply
  useEffect(() => {
    if (pendingQuickReply) {
      handleSend(pendingQuickReply)
      setPendingQuickReply(null)
    }
  }, [pendingQuickReply])

  // Status label
  const statusLabel = status === 'thinking' ? 'Thinking...'
    : status === 'speaking' ? 'Speaking...'
    : status === 'listening' ? 'Listening...'
    : 'AI Executive Assistant'

  if (!open) {
    return (
      <>
        <style>{`
          @keyframes nora-float-pulse {
            0%, 100% { box-shadow: 0 4px 20px rgba(168,85,247,0.3), 0 0 0 0 rgba(168,85,247,0.4); }
            50% { box-shadow: 0 4px 20px rgba(168,85,247,0.5), 0 0 0 8px rgba(168,85,247,0); }
          }
        `}</style>
        <button
          onClick={() => setOpen(true)}
          title="Talk to Nora (Ctrl+Shift+N)"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: '#fff',
            animation: 'nora-float-pulse 3s ease-in-out infinite',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          🤖
        </button>
      </>
    )
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      width: 400, height: 560, borderRadius: 20,
      background: 'rgba(11,20,38,0.98)',
      border: '1px solid rgba(168,85,247,0.2)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(168,85,247,0.1)',
      display: 'flex', flexDirection: 'column',
      backdropFilter: 'blur(20px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px', borderBottom: '1px solid rgba(168,85,247,0.15)',
        background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(124,58,237,0.05))',
        borderRadius: '20px 20px 0 0',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: '#fff',
        }}>🤖</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Nora</div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
            {statusLabel}
          </div>
        </div>
        {/* Close */}
        <button onClick={() => setOpen(false)} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
          cursor: 'pointer', fontSize: 16, padding: '4px 8px',
        }}>✕</button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {messages.length <= 1 && messages[0]?.sender === 'nora' && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            color: 'rgba(255,255,255,0.2)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 40 }}>🤖</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Hi, I&apos;m Nora</div>
            <div style={{ fontSize: 11 }}>
              Your AI executive assistant. Ask me anything,<br />
              send messages, schedule meetings, or draft emails.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
              {[
                '📅 Today\'s schedule',
                '📧 Unread emails',
                '💬 WhatsApp unreads',
                '📝 Create a task',
              ].map(q => (
                <button key={q} onClick={() => setPendingQuickReply(q)}
                  style={{
                    background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)',
                    borderRadius: 8, padding: '5px 10px', color: '#A855F7',
                    fontSize: 10, cursor: 'pointer', fontWeight: 500,
                  }}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '85%', padding: '8px 12px',
              borderRadius: msg.sender === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              background: msg.sender === 'user'
                ? 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(124,58,237,0.15))'
                : 'rgba(255,255,255,0.05)',
              border: msg.sender === 'user'
                ? '1px solid rgba(168,85,247,0.3)'
                : '1px solid rgba(255,255,255,0.05)',
            }}>
              {/* Agent ID badge */}
              {msg.sender === 'nora' && msg.agentId && msg.agentId !== 'orchestrator' && (
                <div style={{
                  fontSize: 9, color: '#A855F7', fontWeight: 700,
                  marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  via {msg.agentId} agent
                </div>
              )}
              <div style={{
                color: 'rgba(255,255,255,0.85)', fontSize: 13,
                lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.text}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9, textAlign: 'right', marginTop: 4 }}>
                {(msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {/* Tool Trace (show what tools Nora used) */}
        {toolTrace.length > 0 && (
          <div style={{
            padding: '6px 10px', borderRadius: 8,
            background: 'rgba(168,85,247,0.05)',
            border: '1px solid rgba(168,85,247,0.1)',
            fontSize: 10, color: 'rgba(168,85,247,0.6)',
          }}>
            {toolTrace.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <span>🔧</span>
                <span style={{ fontWeight: 600 }}>{t.toolName}</span>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>({t.durationMs}ms)</span>
              </div>
            ))}
          </div>
        )}

        {/* Pending Approvals */}
        {pendingApprovals.length > 0 && pendingApprovals.map(a => (
          <div key={a.id} style={{
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}>
            <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, marginBottom: 6 }}>
              ⚠️ Approval Required
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
              {a.description}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => approve(a.id)} style={{
                background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 6, padding: '4px 12px', color: '#22C55E',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>✓ Approve</button>
              <button onClick={() => dismiss(a.id)} style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 6, padding: '4px 12px', color: '#EF4444',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>✕ Cancel</button>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 16px', borderRadius: '12px 12px 12px 4px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)',
              color: 'rgba(168,85,247,0.6)', fontSize: 12,
            }}>
              <span style={{ animation: 'blink 1.5s infinite' }}>●</span>
              <span style={{ animation: 'blink 1.5s infinite 0.3s' }}> ●</span>
              <span style={{ animation: 'blink 1.5s infinite 0.6s' }}> ●</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', borderTop: '1px solid rgba(168,85,247,0.1)',
        borderRadius: '0 0 20px 20px',
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSend()
            if (e.key === 'Escape' && isLoading) { cancel(); e.preventDefault() }
          }}
          placeholder="Ask Nora anything..."
          style={{
            flex: 1, background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(168,85,247,0.15)', borderRadius: 12,
            padding: '10px 14px', color: '#fff', fontSize: 13,
            outline: 'none', fontFamily: 'inherit',
          }}
        />
        {isLoading ? (
          <button onClick={cancel}
            title="Stop Nora (Esc)"
            style={{
              background: 'linear-gradient(135deg, #EF4444, #DC2626)',
              border: 'none', borderRadius: 10, width: 38, height: 38,
              color: '#fff', cursor: 'pointer',
              fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulse-stop 1.5s ease-in-out infinite',
            }}>
            ⏹
          </button>
        ) : (
          <button onClick={() => handleSend()} disabled={!input.trim()}
            style={{
              background: input.trim() ? 'linear-gradient(135deg, #A855F7, #7C3AED)' : 'rgba(168,85,247,0.1)',
              border: 'none', borderRadius: 10, width: 38, height: 38,
              color: '#fff', cursor: input.trim() ? 'pointer' : 'default',
              fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: input.trim() ? 1 : 0.4,
            }}>
            ➤
          </button>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 0.2 } 50% { opacity: 1 } }
        @keyframes pulse-stop { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(0.95); } }
      `}</style>
    </div>
  )
}
