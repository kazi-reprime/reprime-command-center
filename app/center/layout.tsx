import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'RePrime Command Center — Kiosk',
  description: 'Single-window kiosk view for the right monitor. 5120×1440.',
}

/**
 * /center kiosk layout — overrides the root layout's vertical flex chrome
 * for the /center subtree only. The root layout wraps children in
 * <Providers>, so this layout intentionally returns a fragment plus a
 * full-canvas wrapper without a new <html> or <body> (Next.js 15 forbids
 * nested html/body and we already have them at the root).
 *
 * Classic / route is untouched — the root layout still renders unchanged
 * for every other route.
 */
export default function CenterLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-route="center"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background:
          'linear-gradient(180deg, #0E3470 0%, #0E3470 60%, rgba(8, 30, 64, 1) 100%)',
        color: '#F5EFD8',
        // Inherit the global Lexend stack (--rp-font-body) — switched from
        // Poppins on May 5, 2026 (see memory/font_and_tts_standard.md). Body
        // CSS in globals.css already wires Lexend with a Poppins fallback.
        fontFamily: 'inherit',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}
