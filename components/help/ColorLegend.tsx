'use client'

import { useEffect, useState } from 'react'

type LegendItem = {
  color: string
  label: string
  hint: string
}

const ITEMS: LegendItem[] = [
  { color: '#F0B400', label: '305',       hint: 'RePrime business · Quo' },
  { color: '#25D366', label: '718 / OK',   hint: 'Personal WhatsApp · sent / delivered' },
  { color: '#0A84FF', label: 'iMessage',   hint: 'iMessage thread' },
  { color: '#FF9500', label: 'SMS',        hint: 'SMS fallback' },
  { color: '#FFCC33', label: '★ Investor', hint: 'Investor · Terminal · meetings' },
  { color: '#A855F7', label: 'Live now',   hint: 'In progress · meeting starting' },
  { color: '#F59E0B', label: 'Heads-up',   hint: 'Expiring soon · attention' },
  { color: '#EF4444', label: 'Failed',     hint: 'Failed / Blocked / Critical' },
]

const DISMISS_KEY = 'color-legend-collapsed-v1'

export default function ColorLegend() {
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const v = localStorage.getItem(DISMISS_KEY)
      setCollapsed(v === '1')
    } catch {}
    setMounted(true)
  }, [])

  function toggle() {
    setCollapsed((v) => {
      const next = !v
      try {
        localStorage.setItem(DISMISS_KEY, next ? '1' : '0')
      } catch {}
      return next
    })
  }

  if (!mounted) return null

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggle}
        title="Show color legend"
        style={{
          background: 'rgba(14, 52, 112, 0.92)',
          color: '#FFCC33',
          border: 0,
          borderBottom: '1px solid rgba(255, 204, 51, 0.18)',
          fontFamily: 'inherit',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          padding: '4px 12px',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          flexShrink: 0,
        }}
      >
        ▾ color legend
      </button>
    )
  }

  return (
    <div
      style={{
        background: 'rgba(14, 52, 112, 0.92)',
        borderBottom: '1px solid rgba(255, 204, 51, 0.18)',
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
        overflowX: 'auto',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.18em',
          color: 'rgba(255, 204, 51, 0.55)',
          textTransform: 'uppercase',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        Legend
      </div>

      {ITEMS.map((it) => (
        <div
          key={it.label}
          title={it.hint}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: 3,
              background: it.color,
              boxShadow: `0 0 0 1px ${it.color}33`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color: '#F5EFD8',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            {it.label}
          </span>
        </div>
      ))}

      <button
        type="button"
        onClick={toggle}
        title="Hide legend"
        style={{
          marginLeft: 'auto',
          background: 'transparent',
          border: '1px solid rgba(255, 204, 51, 0.35)',
          color: 'rgba(255, 204, 51, 0.75)',
          padding: '2px 8px',
          fontSize: 10,
          letterSpacing: '0.10em',
          cursor: 'pointer',
          fontFamily: 'inherit',
          flexShrink: 0,
        }}
      >
        Hide
      </button>
    </div>
  )
}
