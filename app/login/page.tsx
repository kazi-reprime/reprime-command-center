'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { gold, navy, NAVY, status } from '@/lib/design-tokens'

const ALLOWED_EMAIL = 'g@reprime.com'
// Body font alias — points at the global Lexend stack via globals.css
// (--rp-font-body). Includes a Poppins fallback for graceful degradation.
const FONT_STACK = 'var(--rp-font-body)'

export default function Login() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Fallback (magic-link) state — only surfaced when the code path fails or the
  // user opts in via the small "Trouble?" link.
  const [showFallback, setShowFallback] = useState(false)
  const [fallbackSent, setFallbackSent] = useState(false)
  const [fallbackLoading, setFallbackLoading] = useState(false)

  const submitCode = async () => {
    if (loading || !code) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (res.ok) {
        window.location.href = '/cockpit'
        return
      }
      if (res.status === 401) {
        setError('Incorrect code.')
      } else {
        setError('Sign-in failed. Try the email link below.')
        setShowFallback(true)
      }
    } catch {
      setError('Sign-in failed. Try the email link below.')
      setShowFallback(true)
    }
    setLoading(false)
  }

  // Lockout insurance — original magic-link flow to g@reprime.com.
  const sendMagicLink = async () => {
    if (fallbackLoading) return
    setFallbackLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: ALLOWED_EMAIL,
      options: {
        emailRedirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback`
            : '',
      },
    })
    setFallbackLoading(false)
    if (otpError) setError(otpError.message)
    else setFallbackSent(true)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !loading) submitCode()
  }

  return (
    <main
      onKeyDown={onKeyDown}
      style={{
        minHeight: '100vh',
        background: `radial-gradient(ellipse at 50% 0%, rgba(255, 204, 51, 0.06), rgba(14, 52, 112, 0) 60%), ${NAVY}`,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT_STACK,
        padding: '2rem 1rem',
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: '100%',
          padding: '2.5rem 2.25rem',
          background: navy.surfaceDeep,
          border: `1px solid ${gold[25]}`,
          borderRadius: 12,
          boxShadow:
            '0 24px 64px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,204,51,0.04) inset',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '1.25rem',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.svg"
            alt="RePrime Terminal"
            width={92}
            height={92}
            style={{
              borderRadius: 8,
              border: `1px solid ${gold[35]}`,
            }}
          />
        </div>

        <h1
          style={{
            color: '#FFCC33',
            margin: 0,
            textAlign: 'center',
            fontSize: '1.5rem',
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          Command Center
        </h1>
        <p
          style={{
            color: gold[70],
            margin: '0.5rem 0 0',
            textAlign: 'center',
            fontSize: '0.85rem',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          RePrime Group
        </p>

        <div
          style={{
            height: 1,
            background: `linear-gradient(to right, transparent, ${gold[25]}, transparent)`,
            margin: '1.75rem 0',
          }}
        />

        <label
          htmlFor="access-code"
          style={{
            display: 'block',
            color: gold[70],
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
          }}
        >
          Access code
        </label>
        <input
          id="access-code"
          type="password"
          autoFocus
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter team access code"
          aria-label="Access code"
          style={{
            width: '100%',
            padding: '0.85rem 1rem',
            background: 'rgba(0,0,0,0.20)',
            color: '#fff',
            border: `1px solid ${gold[18]}`,
            borderRadius: 6,
            fontSize: '1rem',
            fontFamily: FONT_STACK,
            letterSpacing: '0.12em',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        <button
          type="button"
          onClick={submitCode}
          disabled={loading || !code}
          style={{
            marginTop: '1.5rem',
            width: '100%',
            padding: '1rem',
            background: loading || !code ? gold[55] : '#FFCC33',
            color: NAVY,
            border: 'none',
            borderRadius: 6,
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            cursor: loading || !code ? 'not-allowed' : 'pointer',
            fontFamily: FONT_STACK,
            transition: 'background 120ms ease',
          }}
        >
          {loading ? 'Entering…' : 'Enter Command Center'}
        </button>

        {error && (
          <p
            role="alert"
            style={{
              color: status.error,
              marginTop: '1rem',
              marginBottom: 0,
              fontSize: '0.85rem',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}

        {/* Fallback — small, secondary magic-link path. Lockout insurance. */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          {fallbackSent ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                padding: '0.85rem',
                background: gold[8],
                border: `1px solid ${gold[35]}`,
                borderRadius: 6,
                color: '#FFCC33',
                fontSize: '0.85rem',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ display: 'block', marginBottom: 4 }}>
                Email link sent to {ALLOWED_EMAIL}.
              </strong>
              <span style={{ color: gold[70], fontSize: '0.8rem' }}>
                Click the link to sign in. It expires in one hour.
              </span>
            </div>
          ) : !showFallback ? (
            <button
              type="button"
              onClick={() => setShowFallback(true)}
              style={{
                background: 'none',
                border: 'none',
                color: gold[55],
                fontSize: '0.75rem',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontFamily: FONT_STACK,
                padding: 0,
              }}
            >
              Trouble? Sign in with email link
            </button>
          ) : (
            <button
              type="button"
              onClick={sendMagicLink}
              disabled={fallbackLoading}
              style={{
                background: 'none',
                border: `1px solid ${gold[25]}`,
                borderRadius: 6,
                color: gold[70],
                fontSize: '0.8rem',
                letterSpacing: '0.04em',
                padding: '0.6rem 1rem',
                cursor: fallbackLoading ? 'not-allowed' : 'pointer',
                fontFamily: FONT_STACK,
              }}
            >
              {fallbackLoading
                ? 'Sending…'
                : `Email a sign-in link to ${ALLOWED_EMAIL}`}
            </button>
          )}
        </div>

        <p
          style={{
            color: gold[55],
            fontSize: '0.7rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginTop: '2rem',
            marginBottom: 0,
            fontWeight: 500,
          }}
        >
          RePrime team access
        </p>
      </div>
    </main>
  )
}
