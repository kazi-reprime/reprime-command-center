'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GOLD, NAVY, gold } from '@/lib/design-tokens'

/**
 * SettingsWindow — kiosk preferences mounted via WindowManager.
 *
 * Persists to localStorage under STORAGE_KEY and emits the
 * `center:settings-changed` CustomEvent on every mutation so other tracks
 * can subscribe and honor the values without importing this file.
 *
 * No actual feature logic lives here — this is the persistence + UI layer
 * only. Other tracks own the side effects (TTS speed, mic key, toast
 * duration, theme) by listening for the change event.
 */

export const STORAGE_KEY = 'center:settings:v1'
export const SETTINGS_CHANGED_EVENT = 'center:settings-changed'

export type ColumnKey = 'pipeline' | 'inbox' | 'bucket' | 'crew'
export type TtsSpeed = 1.0 | 1.5 | 2.0 | 2.5
export type MicKey = 'spacebar' | 'ctrl-shift-v'
export type ToastDuration = 8 | 12 | 20 | 'sticky'
export type ThemeMode = 'dark' | 'light'
/**
 * Body font choice for the kiosk. Default is `lexend` (May 5, 2026 switch
 * on peer-reviewed dyslexia evidence). `poppins` is kept as a per-session
 * override for callers who want to compare or fall back. The picker is
 * always visible; Lexend is the default state across new installs.
 */
export type FontChoice = 'lexend' | 'poppins'
export type LetterSpacing = 'normal' | 'wide' | 'wider'
export type ReadingPanelTint = 'cream' | 'navy'

export interface CenterSettings {
  columns: Record<ColumnKey, boolean>
  voice: {
    ttsSpeed: TtsSpeed
    micKey: MicKey
  }
  notifications: {
    reminderToast: ToastDuration
  }
  display: {
    theme: ThemeMode
    font: FontChoice
    letterSpacing: LetterSpacing
    readingPanelTint: ReadingPanelTint
  }
}

export const DEFAULT_SETTINGS: CenterSettings = {
  columns: { pipeline: true, inbox: true, bucket: true, crew: true },
  voice: { ttsSpeed: 2.0, micKey: 'spacebar' },
  notifications: { reminderToast: 12 },
  display: {
    theme: 'dark',
    font: 'lexend',
    letterSpacing: 'normal',
    readingPanelTint: 'cream',
  },
}

function readSettings(): CenterSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<CenterSettings> | null
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS
    return {
      columns: { ...DEFAULT_SETTINGS.columns, ...(parsed.columns ?? {}) },
      voice: { ...DEFAULT_SETTINGS.voice, ...(parsed.voice ?? {}) },
      notifications: {
        ...DEFAULT_SETTINGS.notifications,
        ...(parsed.notifications ?? {}),
      },
      display: { ...DEFAULT_SETTINGS.display, ...(parsed.display ?? {}) },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function writeSettings(next: CenterSettings) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage may be disabled — silent fallback, in-memory only
  }
  window.dispatchEvent(
    new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: next }),
  )
}

const COLUMN_LABELS: Record<ColumnKey, string> = {
  pipeline: 'Pipeline',
  inbox: 'Inbox',
  bucket: 'Bucket',
  crew: 'Crew',
}

const TTS_SPEEDS: TtsSpeed[] = [1.0, 1.5, 2.0, 2.5]
const MIC_KEYS: { value: MicKey; label: string }[] = [
  { value: 'spacebar', label: 'Spacebar' },
  { value: 'ctrl-shift-v', label: 'Ctrl + Shift + V' },
]
const TOAST_OPTIONS: { value: ToastDuration; label: string }[] = [
  { value: 8, label: '8 seconds' },
  { value: 12, label: '12 seconds' },
  { value: 20, label: '20 seconds' },
  { value: 'sticky', label: 'Sticky (until dismissed)' },
]
const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'dark', label: 'Dark (kiosk)' },
  { value: 'light', label: 'Light' },
]

const FONT_OPTIONS: { value: FontChoice; label: string }[] = [
  { value: 'lexend', label: 'Lexend (default)' },
  { value: 'poppins', label: 'Poppins' },
]
const LETTER_SPACING_OPTIONS: { value: LetterSpacing; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Wide' },
  { value: 'wider', label: 'Wider' },
]
const READING_TINT_OPTIONS: { value: ReadingPanelTint; label: string }[] = [
  { value: 'cream', label: 'Cream (default)' },
  { value: 'navy', label: 'Navy' },
]

export default function SettingsWindow() {
  const [settings, setSettings] = useState<CenterSettings>(DEFAULT_SETTINGS)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setSettings(readSettings())
    setHydrated(true)
  }, [])

  const update = useCallback(
    (mutator: (prev: CenterSettings) => CenterSettings) => {
      setSettings((prev) => {
        const next = mutator(prev)
        writeSettings(next)
        return next
      })
    },
    [],
  )

  const setColumn = useCallback(
    (key: ColumnKey, value: boolean) => {
      update((prev) => ({
        ...prev,
        columns: { ...prev.columns, [key]: value },
      }))
    },
    [update],
  )

  const setTtsSpeed = useCallback(
    (value: TtsSpeed) => {
      update((prev) => ({ ...prev, voice: { ...prev.voice, ttsSpeed: value } }))
    },
    [update],
  )

  const setMicKey = useCallback(
    (value: MicKey) => {
      update((prev) => ({ ...prev, voice: { ...prev.voice, micKey: value } }))
    },
    [update],
  )

  const setToast = useCallback(
    (value: ToastDuration) => {
      update((prev) => ({
        ...prev,
        notifications: { ...prev.notifications, reminderToast: value },
      }))
    },
    [update],
  )

  const setTheme = useCallback(
    (value: ThemeMode) => {
      update((prev) => ({ ...prev, display: { ...prev.display, theme: value } }))
    },
    [update],
  )

  const setFont = useCallback(
    (value: FontChoice) => {
      update((prev) => ({ ...prev, display: { ...prev.display, font: value } }))
    },
    [update],
  )

  const setLetterSpacing = useCallback(
    (value: LetterSpacing) => {
      update((prev) => ({
        ...prev,
        display: { ...prev.display, letterSpacing: value },
      }))
    },
    [update],
  )

  const setReadingTint = useCallback(
    (value: ReadingPanelTint) => {
      update((prev) => ({
        ...prev,
        display: { ...prev.display, readingPanelTint: value },
      }))
    },
    [update],
  )

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: NAVY,
      color: '#fff',
      fontFamily: 'inherit',
      overflow: 'hidden',
    }),
    [],
  )

  return (
    <div data-component="settings-window" style={containerStyle}>
      <header
        style={{
          padding: '0.85rem 1.1rem',
          borderBottom: `1px solid ${gold[25]}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            fontSize: 18,
            color: GOLD,
            lineHeight: 1,
          }}
        >
          {'⚙'}
        </span>
        <div
          style={{
            color: GOLD,
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
          }}
        >
          Settings
        </div>
      </header>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.1rem 1.1rem 1.6rem',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {!hydrated ? (
          <div style={{ color: gold[70], fontSize: 13 }}>Loading…</div>
        ) : (
          <>
            <Section title="Columns" hint="Show or hide each kiosk column.">
              <ButtonRow>
                {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
                  <BigToggle
                    key={key}
                    label={COLUMN_LABELS[key]}
                    active={settings.columns[key]}
                    onClick={() => setColumn(key, !settings.columns[key])}
                  />
                ))}
              </ButtonRow>
            </Section>

            <Section
              title="Voice"
              hint="Speechify-style playback speed and the push-to-talk key."
            >
              <SubLabel>Playback speed</SubLabel>
              <ButtonRow>
                {TTS_SPEEDS.map((speed) => (
                  <BigToggle
                    key={speed}
                    label={`${speed.toFixed(1)}x`}
                    active={settings.voice.ttsSpeed === speed}
                    onClick={() => setTtsSpeed(speed)}
                  />
                ))}
              </ButtonRow>
              <SubLabel style={{ marginTop: 14 }}>Mic key</SubLabel>
              <ButtonRow>
                {MIC_KEYS.map((opt) => (
                  <BigToggle
                    key={opt.value}
                    label={opt.label}
                    active={settings.voice.micKey === opt.value}
                    onClick={() => setMicKey(opt.value)}
                  />
                ))}
              </ButtonRow>
            </Section>

            <Section
              title="Notifications"
              hint="How long reminder toasts stay on screen."
            >
              <ButtonRow>
                {TOAST_OPTIONS.map((opt) => (
                  <BigToggle
                    key={String(opt.value)}
                    label={opt.label}
                    active={settings.notifications.reminderToast === opt.value}
                    onClick={() => setToast(opt.value)}
                  />
                ))}
              </ButtonRow>
            </Section>

            <Section
              title="Display"
              hint="Kiosk default is dark. Light is for daytime side screens."
            >
              <ButtonRow>
                {THEME_OPTIONS.map((opt) => (
                  <BigToggle
                    key={opt.value}
                    label={opt.label}
                    active={settings.display.theme === opt.value}
                    onClick={() => setTheme(opt.value)}
                  />
                ))}
              </ButtonRow>
            </Section>

            <Section
              title="Font"
              hint="Lexend is the default — built for dyslexic readers. Poppins is the previous default; pick it any time you want to compare."
            >
              <ButtonRow>
                {FONT_OPTIONS.map((opt) => (
                  <BigToggle
                    key={opt.value}
                    label={opt.label}
                    active={settings.display.font === opt.value}
                    onClick={() => setFont(opt.value)}
                  />
                ))}
              </ButtonRow>
              <SubLabel style={{ marginTop: 14 }}>Letter spacing</SubLabel>
              <ButtonRow>
                {LETTER_SPACING_OPTIONS.map((opt) => (
                  <BigToggle
                    key={opt.value}
                    label={opt.label}
                    active={settings.display.letterSpacing === opt.value}
                    onClick={() => setLetterSpacing(opt.value)}
                  />
                ))}
              </ButtonRow>
            </Section>

            <Section
              title="Reading panels"
              hint="Cream tint is the default — easier on the eye for sentence-length reading. Navy keeps the trader-grade look."
            >
              <ButtonRow>
                {READING_TINT_OPTIONS.map((opt) => (
                  <BigToggle
                    key={opt.value}
                    label={opt.label}
                    active={settings.display.readingPanelTint === opt.value}
                    onClick={() => setReadingTint(opt.value)}
                  />
                ))}
              </ButtonRow>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          color: GOLD,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
        }}
      >
        {title}
      </div>
      {hint && (
        <div
          style={{
            color: gold[70],
            fontSize: 12,
            lineHeight: 1.4,
            marginTop: -4,
          }}
        >
          {hint}
        </div>
      )}
      {children}
    </section>
  )
}

function SubLabel({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        color: gold[55],
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function ButtonRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
      }}
    >
      {children}
    </div>
  )
}

function BigToggle({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        minHeight: 48,
        padding: '10px 18px',
        borderRadius: 8,
        border: `1px solid ${active ? GOLD : gold[25]}`,
        background: active ? gold[18] : 'transparent',
        color: active ? GOLD : '#fff',
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: active ? 700 : 500,
        letterSpacing: '0.02em',
        cursor: 'pointer',
        transition: 'background 120ms, border-color 120ms, color 120ms',
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  )
}
