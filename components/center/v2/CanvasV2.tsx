'use client'

import {
  COLUMN_SLOTS,
  ColumnSlotRenderer,
} from '@/lib/center/slots'
import TileGrid from './TileGrid'

/**
 * CanvasV2 — middle band of /center/v2.
 *
 * Top: TileGrid (active deals + investors + live threads) — the
 * iPhone-grid command surface.
 *
 * Bottom: a slim, scrolling row of the existing v1 columns
 * (Pipeline / Inbox / Bucket / Crew). They are wrapped in slimmer
 * containers (60% height) instead of being rebuilt — per the
 * "edit, never rebuild" rule.
 */
export default function CanvasV2() {
  return (
    <div
      data-component="canvas-v2"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        background: 'rgba(255, 204, 51, 0.04)',
      }}
    >
      <TileGrid />

      <div
        data-section="canvas-v2-columns"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(280px, 1fr))',
          gap: 1,
          background: 'rgba(255, 204, 51, 0.06)',
          minHeight: 360,
          flexShrink: 0,
          marginTop: 12,
        }}
      >
        {COLUMN_SLOTS.map((slot) => (
          <div
            key={slot.label}
            style={{
              minHeight: 360,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
            }}
          >
            <ColumnSlotRenderer slot={slot} />
          </div>
        ))}
      </div>
    </div>
  )
}
