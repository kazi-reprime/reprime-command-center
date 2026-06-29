'use client'

import { windowsStore, useWindows } from '@/lib/windows/store'

/**
 * WindowTaskbar — strip above the voice shell footer with one pill per
 * minimized window. Click to restore + focus.
 *
 * Renders nothing when no windows are minimized (zero visual weight when
 * empty). Uses sticky bottom positioning so it sits inside the kiosk
 * column-flex above VoiceShellFooter.
 */
export default function WindowTaskbar() {
  const { windows } = useWindows()
  const minimized = windows.filter((w) => w.minimized)
  if (minimized.length === 0) return null

  return (
    <div
      data-component="window-taskbar"
      style={{
        flexShrink: 0,
        zIndex: 38,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        background: 'rgba(14, 52, 112, 0.94)',
        borderTop: '1px solid rgba(255, 204, 51, 0.18)',
        overflowX: 'auto',
        fontFamily: 'inherit',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(245, 239, 216, 0.55)',
          flexShrink: 0,
          marginRight: 4,
        }}
      >
        Minimized
      </span>
      {minimized.map((w) => (
        <button
          key={w.id}
          type="button"
          onClick={() => windowsStore.restore(w.id)}
          title={`Restore ${w.title}`}
          style={{
            height: 30,
            padding: '0 12px',
            border: '1px solid rgba(255, 204, 51, 0.32)',
            borderRadius: 6,
            background: 'rgba(255, 204, 51, 0.08)',
            color: '#F5EFD8',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            maxWidth: 240,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          {w.title}
        </button>
      ))}
    </div>
  )
}
