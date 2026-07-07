/* eslint-disable */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Message = { role: 'user' | 'assistant'; content: string; timestamp: Date }

/**
 * NoraFloating — Floating AI assistant accessible from anywhere in the cockpit.
 * Purple gradient bubble in bottom-right corner, expands to full chat panel.
 * Streams responses from /api/nora/chat.
 */
export default function NoraFloating() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState<'en' | 'he'>('en')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Broadcast Nora status
    window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'thinking' } }))

    try {
      const res = await fetch('/api/nora/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          lang,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const reply = data.reply || data.message || 'I couldn\'t process that. Try again.'
        const assistantMsg: Message = { role: 'assistant', content: reply, timestamp: new Date() }
        setMessages(prev => [...prev, assistantMsg])

        // Auto-save as note
        fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Nora Chat: ' + text.slice(0, 40),
            content: '**User:** ' + text + '\n\n**Nora:** ' + reply,
            tags: ['nora-chat'],
          }),
        }).catch(() => {})
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          timestamp: new Date(),
        }])
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Network error. Check your connection.',
        timestamp: new Date(),
      }])
    }

    window.dispatchEvent(new CustomEvent('nora:status', { detail: { status: 'idle' } }))
    setLoading(false)
  }, [input, loading, lang, messages])

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
            {loading ? 'Thinking...' : 'AI Executive Assistant'}
          </div>
        </div>
        {/* Language toggle */}
        <button onClick={() => setLang(l => l === 'en' ? 'he' : 'en')}
          style={{
            background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)',
            borderRadius: 6, padding: '3px 8px', color: '#A855F7',
            fontSize: 10, fontWeight: 700, cursor: 'pointer',
          }}>
          {lang === 'en' ? 'EN' : 'עב'}
        </button>
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
        {messages.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            color: 'rgba(255,255,255,0.2)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 40 }}>🤖</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Hi, I&apos;m Nora</div>
            <div style={{ fontSize: 11 }}>
              Ask me anything about the command center,<br />
              send messages, schedule meetings, or search contacts.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
              {['What meetings today?', 'Show unread WhatsApp', 'Draft an email', 'Search Pipedrive'].map(q => (
                <button key={q} onClick={() => { setInput(q); setTimeout(sendMessage, 100) }}
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
            display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '85%', padding: '8px 12px',
              borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(124,58,237,0.15))'
                : 'rgba(255,255,255,0.05)',
              border: msg.role === 'user'
                ? '1px solid rgba(168,85,247,0.3)'
                : '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{
                color: 'rgba(255,255,255,0.85)', fontSize: 13,
                lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.content}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9, textAlign: 'right', marginTop: 4 }}>
                {msg.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {loading && (
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
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={lang === 'en' ? 'Ask Nora anything...' : '...שאלו את נורה'}
          dir={lang === 'he' ? 'rtl' : 'ltr'}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(168,85,247,0.15)', borderRadius: 12,
            padding: '10px 14px', color: '#fff', fontSize: 13,
            outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}
          style={{
            background: input.trim() ? 'linear-gradient(135deg, #A855F7, #7C3AED)' : 'rgba(168,85,247,0.1)',
            border: 'none', borderRadius: 10, width: 38, height: 38,
            color: '#fff', cursor: input.trim() && !loading ? 'pointer' : 'default',
            fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: input.trim() ? 1 : 0.4,
          }}>
          {loading ? '⏳' : '➤'}
        </button>
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 0.2 } 50% { opacity: 1 } }
      `}</style>
    </div>
  )
}
