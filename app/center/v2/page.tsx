'use client'

import WindowManager, {
  type ComponentRegistry,
} from '@/components/center/windows/WindowManager'
import WindowTaskbar from '@/components/center/windows/WindowTaskbar'
import {
  FOOTER_OVERLAYS,
  WINDOW_REGISTRY,
} from '@/lib/center/slots'
import TopStripV2 from '@/components/center/v2/TopStripV2'
import CanvasV2 from '@/components/center/v2/CanvasV2'
import VoiceMicHero from '@/components/center/v2/VoiceMicHero'
import WhatsAppDock from '@/components/center/v2/WhatsAppDock'
import BrowserSurface from '@/components/center/v2/BrowserSurface'
import DealFolderWindow from '@/components/center/v2/DealFolderWindow'

/**
 * /center/v2 — research-driven kiosk rebuild.
 *
 * Visual chassis change only. Data layer, slot registry, voice engine,
 * and column components are reused exactly per the "edit, never rebuild"
 * rule. Once Gideon approves the visuals on /center/v2, /center is
 * swapped over in a tiny follow-up commit.
 *
 * Layout bands (Spec §3):
 *   1. TopStripV2     — KPIs + 6 action buttons + identity
 *   2. CanvasV2       — TileGrid (deals/investors/threads) + slim columns
 *   3. VoiceMicHero   — centered mic, replaces the small VoiceShellFooter dot
 *   4. WhatsAppDock   — 4 channel-colored panels across the bottom
 *   5. BrowserSurface — collapsible Perplexity / Pipedrive / Gmail / CoStar /
 *                       Inforuptcy strip with inline iframe expansion
 *
 * SettingsApplier rides in via FOOTER_OVERLAYS so font / letter-spacing /
 * reading-tint settings apply identically to v1 and v2.
 */

const V2_REGISTRY: ComponentRegistry = {
  ...WINDOW_REGISTRY,
  'deal-folder': (props) => (
    <DealFolderWindow
      {...(props as {
        dealId?: number
        title?: string
        pipedriveUrl?: string
        stage?: string
        value?: number
        currency?: string
      })}
    />
  ),
}

export default function CenterV2Page() {
  return (
    <>
      <TopStripV2 />
      <CanvasV2 />
      <VoiceMicHero />
      <WhatsAppDock />
      <BrowserSurface />
      <WindowTaskbar />
      <WindowManager registry={V2_REGISTRY} />
      {FOOTER_OVERLAYS.map((Overlay, i) => (
        <Overlay key={i} />
      ))}
    </>
  )
}
