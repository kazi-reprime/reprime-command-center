'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  SETTINGS_CHANGED_EVENT,
  STORAGE_KEY,
  type CenterSettings,
} from './SettingsWindow'

/**
 * SettingsApplier — reads `center:settings:v1` from localStorage and applies
 * the display-side knobs (font choice, letter-spacing, reading-panel tint)
 * to the `<html>` element via CSS variables that the kiosk styles already
 * consume.
 *
 * - `--rp-font-body` switches between the Lexend stack (default) and the
 *   Poppins fallback chain when the user picks Poppins from Settings.
 * - `--rp-letter-spacing` is consumed by reading-panel components and the
 *   v2 surfaces so dyslexia-friendly tracking is selectable per session.
 * - `--rp-reading-bg` flips between cream and navy for v2 reading panels.
 *
 * Mounts as a FOOTER_OVERLAY in lib/center/slots.tsx so both /center and
 * /center/v2 honor the active settings without each route managing its own
 * subscription.
 */

const FONT_STACKS: Record<'lexend' | 'poppins', string> = {
  // Lexend first (loaded via next/font), Poppins fallback.
  lexend:
    'var(--font-lexend), Lexend, Poppins, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  // Poppins first per user override; Lexend stays as a fallback so the
  // body still has a dyslexia-optimized option if Poppins fails to load.
  poppins:
    'Poppins, var(--font-lexend), Lexend, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
}

const LETTER_SPACING: Record<'normal' | 'wide' | 'wider', string> = {
  normal: '0',
  wide: '0.02em',
  wider: '0.04em',
}

const READING_BG: Record<'cream' | 'navy', string> = {
  cream:
    'linear-gradient(180deg, var(--rp-cream, #F4EEE0) 0%, #F8F0DA 60%, #EFE2C4 100%)',
  navy: 'rgba(14, 52, 112, 0.85)',
}

const READING_FG: Record<'cream' | 'navy', string> = {
  cream: '#3B2F1A',
  navy: '#F5EFD8',
}

function readSettings(): CenterSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<CenterSettings> | null
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      display: { ...DEFAULT_SETTINGS.display, ...(parsed.display ?? {}) },
    } as CenterSettings
  } catch {
    return DEFAULT_SETTINGS
  }
}

function apply(settings: CenterSettings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const font = settings.display.font ?? 'lexend'
  const ls = settings.display.letterSpacing ?? 'normal'
  const tint = settings.display.readingPanelTint ?? 'cream'

  root.style.setProperty('--rp-font-body', FONT_STACKS[font])
  root.style.setProperty('--rp-letter-spacing', LETTER_SPACING[ls])
  root.style.setProperty('--rp-reading-bg', READING_BG[tint])
  root.style.setProperty('--rp-reading-fg', READING_FG[tint])
}

export default function SettingsApplier() {
  const [, setTick] = useState(0)

  useEffect(() => {
    apply(readSettings())
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<CenterSettings>
      const next = ce.detail ?? readSettings()
      apply(next)
      setTick((t) => t + 1)
    }
    window.addEventListener(SETTINGS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onChange)
  }, [])

  return null
}
