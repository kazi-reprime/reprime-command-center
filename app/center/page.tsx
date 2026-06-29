'use client'

import Canvas from '@/components/center/Canvas'
import TopStrip from '@/components/center/TopStrip'
import VoiceShellFooter from '@/components/center/VoiceShellFooter'
import WindowManager from '@/components/center/windows/WindowManager'
import WindowTaskbar from '@/components/center/windows/WindowTaskbar'
import {
  COLUMN_SLOTS,
  ColumnSlotRenderer,
  FOOTER_OVERLAYS,
  WINDOW_REGISTRY,
} from '@/lib/center/slots'

/**
 * /center — RePrime Command Center kiosk shell.
 *
 * Mount points come from lib/center/slots.tsx. Add new columns, windows,
 * or overlays THERE, NOT here. This file is for layout chrome only.
 */
export default function CenterPage() {
  return (
    <>
      <TopStrip />

      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        <Canvas>
          {COLUMN_SLOTS.map((slot) => (
            <ColumnSlotRenderer key={slot.label} slot={slot} />
          ))}
        </Canvas>
      </main>

      <WindowTaskbar />
      <VoiceShellFooter />
      <WindowManager registry={WINDOW_REGISTRY} />
      {FOOTER_OVERLAYS.map((Overlay, i) => (
        <Overlay key={i} />
      ))}
    </>
  )
}
