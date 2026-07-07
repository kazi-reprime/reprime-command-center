/* eslint-disable */
'use client'

import Canvas from '@/components/center/Canvas'
import TopStrip from '@/components/center/TopStrip'
import ActiveTaskBanner from '@/components/center/ActiveTaskBanner'
import RelationshipStrip from '@/components/center/RelationshipStrip'
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
 * Layout bands (matching screenshot):
 *   1. TopStrip          — branding + pills + identity
 *   2. ActiveTaskBanner  — red/gold status bar for current meeting/focus
 *   3. RelationshipStrip — Investors / Family / Others contact chips
 *   4. Canvas + Columns  — 8-column kiosk (Calendar, Pipeline, Inbox, Notes,
 *                          Comms, Bucket, Crew, Nora's Desk)
 *   5. VoiceShellFooter  — voice capture bar
 *
 * Mount points come from lib/center/slots.tsx. Add new columns, windows,
 * or overlays THERE, NOT here. This file is for layout chrome only.
 */
export default function CenterPage() {
  return (
    <>
      <TopStrip />
      <ActiveTaskBanner />
      <RelationshipStrip />

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
