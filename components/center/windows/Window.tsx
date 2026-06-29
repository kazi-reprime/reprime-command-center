'use client'

import { useRef, type PointerEvent, type ReactNode } from 'react'
import { windowsStore, type WindowState } from '@/lib/windows/store'

const HEADER_HEIGHT = 36

type Props = {
  state: WindowState
  isFocused: boolean
  children: ReactNode
}

/**
 * Window — a single OS-style draggable, resizable popup.
 *
 * Drag handle: title bar (full row except the control buttons).
 * Resize handle: SE corner grip.
 * Buttons: minimize, maximize (toggle), close.
 * Click anywhere on the window → focus, z-index up.
 *
 * Pointer-events only; no drag library. setPointerCapture keeps the move
 * stream attached to the originating element even if the cursor leaves it.
 */
export default function Window({ state, isFocused, children }: Props) {
  // Drag and resize state lives in refs so we don't re-render on every
  // pointer move — the store update is the only render trigger.
  const dragRef = useRef<{
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)
  const resizeRef = useRef<{
    startX: number
    startY: number
    origW: number
    origH: number
  } | null>(null)

  const onTitlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-window-control]')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: state.x,
      origY: state.y,
    }
    windowsStore.focus(state.id)
  }
  const onTitlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    windowsStore.move(
      state.id,
      d.origX + (e.clientX - d.startX),
      d.origY + (e.clientY - d.startY),
    )
  }
  const onTitlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    dragRef.current = null
  }

  const onResizePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: state.width,
      origH: state.height,
    }
    windowsStore.focus(state.id)
  }
  const onResizePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current
    if (!r) return
    windowsStore.resize(
      state.id,
      r.origW + (e.clientX - r.startX),
      r.origH + (e.clientY - r.startY),
    )
  }
  const onResizePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    resizeRef.current = null
  }

  return (
    <div
      data-component="center-window"
      data-window-id={state.id}
      data-window-focused={isFocused ? 'true' : 'false'}
      onPointerDown={() => windowsStore.focus(state.id)}
      style={{
        position: 'fixed',
        left: state.x,
        top: state.y,
        width: state.width,
        height: state.height,
        zIndex: state.z,
        pointerEvents: 'auto',
        background: 'rgba(8, 24, 56, 0.96)',
        border: `1px solid ${
          isFocused
            ? 'rgba(255, 204, 51, 0.55)'
            : 'rgba(255, 204, 51, 0.18)'
        }`,
        borderRadius: 10,
        boxShadow: isFocused
          ? '0 14px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 204, 51, 0.18)'
          : '0 8px 22px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#F5EFD8',
        fontFamily: 'inherit',
      }}
    >
      <div
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={onTitlePointerUp}
        onDoubleClick={() => windowsStore.toggleMaximize(state.id)}
        style={{
          height: HEADER_HEIGHT,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 6px 0 12px',
          background: isFocused
            ? 'linear-gradient(180deg, rgba(255, 204, 51, 0.18) 0%, rgba(14, 52, 112, 0.92) 100%)'
            : 'rgba(14, 52, 112, 0.78)',
          borderBottom: '1px solid rgba(255, 204, 51, 0.18)',
          cursor: 'move',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {state.title}
        </span>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <ControlBtn
            label="Minimize"
            onClick={() => windowsStore.minimize(state.id)}
            symbol="–"
          />
          <ControlBtn
            label={state.maximized ? 'Restore' : 'Maximize'}
            onClick={() => windowsStore.toggleMaximize(state.id)}
            symbol={state.maximized ? '❐' : '□'}
          />
          <ControlBtn
            label="Close"
            onClick={() => windowsStore.close(state.id)}
            symbol="×"
            danger
          />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: 'rgba(8, 18, 40, 0.65)',
          position: 'relative',
        }}
      >
        {children}
      </div>

      <div
        data-window-resize
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        aria-label="Resize"
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 16,
          height: 16,
          cursor: 'nwse-resize',
          background:
            'linear-gradient(135deg, transparent 0%, transparent 50%, rgba(255, 204, 51, 0.6) 50%, rgba(255, 204, 51, 0.6) 100%)',
          borderBottomRightRadius: 10,
          touchAction: 'none',
        }}
      />
    </div>
  )
}

function ControlBtn({
  label,
  onClick,
  symbol,
  danger,
}: {
  label: string
  onClick: () => void
  symbol: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      data-window-control
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        width: 28,
        height: 24,
        border: 0,
        borderRadius: 4,
        background: 'transparent',
        color: danger ? '#FECACA' : '#F5EFD8',
        cursor: 'pointer',
        fontSize: 14,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'inherit',
      }}
    >
      {symbol}
    </button>
  )
}
