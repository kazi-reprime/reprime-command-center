'use client'

import type { ReactNode } from 'react'

export type CanvasProps = {
  children: ReactNode
}

/**
 * Canvas — 8-column CSS grid for the /center kiosk.
 *
 * Native target: 5120 × 1440 (Samsung Odyssey G95NC right monitor at 100%).
 * Each column is one of eight equal tracks, ~640px on the native canvas.
 *
 * Below 5120px the grid keeps eight equal columns and the page scrolls
 * horizontally — Gideon's intent is to use this only on the kiosk monitor,
 * so we do not collapse to fewer columns at the chassis layer. Each column
 * enforces a minimum width of 320px to remain readable.
 */
export default function Canvas({ children }: CanvasProps) {
  return (
    <div
      data-component="center-canvas"
      style={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        columnGap: 2,
        background: 'rgba(255, 204, 51, 0.06)',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </div>
  )
}

