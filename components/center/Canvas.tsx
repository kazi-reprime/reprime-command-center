'use client'

import type { ReactNode } from 'react'

export type CanvasProps = {
  children: ReactNode
}

/**
 * Canvas — 4-column CSS grid for the /center kiosk.
 *
 * Native target: 5120 × 1440 (Samsung Odyssey G95NC right monitor at 100%).
 * Each column is one of four equal tracks, ~1280px on the native canvas.
 *
 * Below 5120px the grid keeps four equal columns and the page scrolls
 * horizontally — Gideon's intent is to use this only on the kiosk monitor,
 * so we do not collapse to fewer columns at the chassis layer. Smaller-
 * viewport fallbacks (per build plan §4 Track A) can land in a follow-up
 * media query without rebuilding this component.
 */
export default function Canvas({ children }: CanvasProps) {
  return (
    <div
      data-component="center-canvas"
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 5120,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        columnGap: 1,
        background: 'rgba(255, 204, 51, 0.06)',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </div>
  )
}
