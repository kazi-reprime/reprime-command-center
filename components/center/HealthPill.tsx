'use client'

import { useEffect, useState } from 'react'

type Overall = 'ok' | 'degraded' | 'down'

interface Health {
  sha: string
  deployedAt: string | null
  env: Record<string, boolean>
  db: { reachable: boolean; latencyMs: number }
  overall: Overall
}

const POLL_MS = 60_000

export default function HealthPill() {
  const [health, setHealth] = useState<Health | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as Health
        if (!cancelled) setHealth(data)
      } catch {
        // swallow — pill stays in last-known state
      }
    }
    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const overall: Overall = health?.overall ?? 'ok'
  const missingEnvs = health
    ? Object.entries(health.env)
        .filter(([, v]) => !v)
        .map(([k]) => k)
    : []

  const dotColor =
    overall === 'down'
      ? 'var(--c-fail)'
      : overall === 'degraded'
        ? 'var(--c-warn)'
        : 'var(--c-channel-718)'

  const label =
    overall === 'down'
      ? 'down'
      : overall === 'degraded'
        ? `degraded (${missingEnvs.length})`
        : 'ok'

  const shaShort = health ? health.sha.slice(0, 7) : 'dev'
  const dbLabel = health
    ? health.db.reachable
      ? `${health.db.latencyMs}ms`
      : 'unreachable'
    : '…'

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`Health: ${overall} · db ${dbLabel} · sha ${shaShort}`}
        style={{
          height: 24,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255, 204, 51, 0.10)',
          color: '#FFCC33',
          border: '1px solid rgba(255, 204, 51, 0.45)',
          borderRadius: 999,
          padding: '0 10px',
          fontFamily: 'inherit',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: dotColor,
            display: 'inline-block',
          }}
        />
        {label}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 49,
              background: 'transparent',
            }}
          />
          <div
            role="dialog"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              background: 'rgba(10, 31, 68, 0.98)',
              color: '#F4EEE0',
              border: '1px solid rgba(255, 204, 51, 0.30)',
              borderRadius: 8,
              padding: 14,
              minWidth: 280,
              fontSize: 11,
              zIndex: 50,
              boxShadow: '0 8px 24px rgba(0,0,0,0.40)',
            }}
          >
            <div
              style={{
                fontWeight: 700,
                marginBottom: 8,
                color: '#FFCC33',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Status: {overall}
            </div>
            <div style={{ marginBottom: 4, opacity: 0.85 }}>
              DB: {dbLabel}
            </div>
            <div style={{ marginBottom: 4, opacity: 0.85 }}>
              SHA: {shaShort}
            </div>
            {health?.deployedAt && (
              <div style={{ marginBottom: 4, opacity: 0.85 }}>
                Deployed: {health.deployedAt}
              </div>
            )}
            {missingEnvs.length > 0 ? (
              <>
                <div
                  style={{
                    fontWeight: 700,
                    marginTop: 10,
                    marginBottom: 4,
                    color: 'var(--c-warn)',
                  }}
                >
                  Missing env ({missingEnvs.length})
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 16,
                    lineHeight: 1.6,
                    color: 'var(--c-fail)',
                  }}
                >
                  {missingEnvs.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </>
            ) : (
              <div
                style={{
                  marginTop: 10,
                  color: 'var(--c-channel-718)',
                  fontWeight: 600,
                }}
              >
                All required env vars present.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
