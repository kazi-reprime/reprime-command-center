'use client'

import { useEffect, useState } from 'react'

const NAVY = '#0E3470'
const GOLD = '#FFCC33'
const TEXT = '#F5EFD8'
const MUTED = '#8C8771'

interface Shortcut {
  keys: string[]
  label: string
  group: 'Quick actions' | 'Navigation'
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl', 'K'], label: 'Search across all chats', group: 'Quick actions' },
  { keys: ['Ctrl', 'D'], label: 'Quick call (dial a number)', group: 'Quick actions' },
  { keys: ['Ctrl', 'E'], label: 'Compose email', group: 'Quick actions' },
  { keys: ['Ctrl', 'J'], label: 'Open notes', group: 'Quick actions' },
  { keys: ['Ctrl', 'B'], label: 'Morning briefing', group: 'Quick actions' },
  { keys: ['?'], label: 'Show this help', group: 'Navigation' },
  { keys: ['Esc'], label: 'Close any modal', group: 'Navigation' },
]

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
}

export default function ShortcutHelp() {
  const [open, setOpen] = useState(false)
  const [mac, setMac] = useState(false)

  useEffect(() => {
    setMac(isMac())
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return

      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  if (!open) return null

  const cmdKey = mac ? '⌘' : 'Ctrl'
  const groups: Array<Shortcut['group']> = ['Quick actions', 'Navigation']

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(7, 16, 30, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9100,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: NAVY,
          border: `1px solid ${GOLD}55`,
          width: '100%',
          maxWidth: 480,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${GOLD}33`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: GOLD, fontSize: 14, fontWeight: 700, letterSpacing: '0.06em' }}>⌨ Keyboard shortcuts</div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={escBtn}>ESC</button>
        </div>

        <div style={{ padding: '14px 18px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {groups.map((g) => (
            <div key={g}>
              <div style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>
                {g}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {SHORTCUTS.filter((s) => s.group === g).map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: `1px solid ${GOLD}11`,
                    }}
                  >
                    <div style={{ color: TEXT, fontSize: 13 }}>{s.label}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {s.keys.map((k, j) => (
                        <kbd
                          key={j}
                          style={{
                            background: 'rgba(255, 204, 51, 0.12)',
                            border: `1px solid ${GOLD}55`,
                            color: GOLD,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontFamily: 'inherit',
                            letterSpacing: '0.04em',
                            fontWeight: 600,
                            minWidth: 24,
                            textAlign: 'center',
                          }}
                        >
                          {k === 'Ctrl' ? cmdKey : k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '10px 18px', borderTop: `1px solid ${GOLD}22`, fontSize: 10, color: MUTED, letterSpacing: '0.06em', textAlign: 'center' }}>
          Press <kbd style={{ color: GOLD }}>?</kbd> anywhere to toggle this · {mac ? 'Mac' : 'Windows/Linux'} bindings shown
        </div>
      </div>
    </div>
  )
}

const escBtn: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${GOLD}55`,
  color: GOLD,
  padding: '4px 10px',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '0.10em',
}
