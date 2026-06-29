'use client'

// Soft-scheduling UI: "Suggested focus" surface used by BriefingModal and
// PipelineColumn. Reads `suggested_focus` from /api/briefing/today and offers
// a one-click "Start this now" that:
//   1. Dispatches `center:open-window` for code3's WindowManager (target
//      'bucket-item') so the item opens in a kiosk window.
//   2. Starts a 90-minute focus countdown, persisted in localStorage so
//      reloads don't lose it.
//
// The timer is a single global slot — starting a new focus replaces any
// running one. That's intentional: Gideon focuses on one thing at a time.

import { useCallback, useEffect, useMemo, useState } from 'react'

export interface SuggestedFocusItem {
  gap_start: string
  gap_end: string
  item_id: string
  title: string
  priority: number
}

const FOCUS_TIMER_KEY = 'center-focus-timer-v1'
const DEFAULT_FOCUS_MINUTES = 90

interface FocusTimerState {
  item_id: string
  title: string
  started_at: number // ms
  ends_at: number // ms
}

function loadTimer(): FocusTimerState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(FOCUS_TIMER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FocusTimerState
    if (typeof parsed.ends_at !== 'number') return null
    if (parsed.ends_at <= Date.now()) {
      window.localStorage.removeItem(FOCUS_TIMER_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function saveTimer(state: FocusTimerState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FOCUS_TIMER_KEY, JSON.stringify(state))
  } catch {
    /* quota — ignore */
  }
}

function clearTimer(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(FOCUS_TIMER_KEY)
  } catch {
    /* ignore */
  }
}

function dispatchOpenBucketItem(item_id: string, title: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('center:open-window', {
      detail: {
        target: 'bucket-item',
        opts: {
          id: 'focus-' + item_id,
          componentProps: { itemId: item_id, title },
        },
      },
    })
  )
}

function formatGapWindow(startIso: string, endIso: string): string {
  const s = new Date(startIso)
  const e = new Date(endIso)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return ''
  const fmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${fmt.format(s)} – ${fmt.format(e)}`
}

function priorityLabel(p: number): string {
  if (p <= 1) return 'P1'
  if (p === 2) return 'P2'
  if (p === 3) return 'P3'
  if (p === 4) return 'P4'
  return 'P5'
}

function priorityColor(p: number): string {
  if (p <= 1) return '#FFB400'
  if (p === 2) return '#FFCC33'
  return 'var(--rp-gold-lite)'
}

// ── Live countdown hook ──────────────────────────────────────────────────────

function useFocusTimer(): {
  timer: FocusTimerState | null
  remainingMs: number
  start: (item_id: string, title: string, gapMinutes?: number) => void
  cancel: () => void
} {
  const [timer, setTimer] = useState<FocusTimerState | null>(() => loadTimer())
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    if (!timer) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [timer])

  // Cross-tab sync via storage event.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== FOCUS_TIMER_KEY) return
      setTimer(loadTimer())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // Auto-clear when expired.
  useEffect(() => {
    if (!timer) return
    if (now >= timer.ends_at) {
      clearTimer()
      setTimer(null)
    }
  }, [now, timer])

  const start = useCallback(
    (item_id: string, title: string, gapMinutes?: number) => {
      const minutes = gapMinutes && gapMinutes > 0
        ? Math.min(DEFAULT_FOCUS_MINUTES, gapMinutes)
        : DEFAULT_FOCUS_MINUTES
      const startedAt = Date.now()
      const state: FocusTimerState = {
        item_id,
        title,
        started_at: startedAt,
        ends_at: startedAt + minutes * 60_000,
      }
      saveTimer(state)
      setTimer(state)
      setNow(Date.now())
    },
    []
  )

  const cancel = useCallback(() => {
    clearTimer()
    setTimer(null)
  }, [])

  const remainingMs = timer ? Math.max(0, timer.ends_at - now) : 0
  return { timer, remainingMs, start, cancel }
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Public hook (exported for any other surface that needs it) ───────────────

export function useFocusActions() {
  const { timer, remainingMs, start, cancel } = useFocusTimer()
  const startFocus = useCallback(
    (item: SuggestedFocusItem) => {
      const gapMin = Math.round(
        (new Date(item.gap_end).getTime() - new Date(item.gap_start).getTime()) / 60_000
      )
      dispatchOpenBucketItem(item.item_id, item.title)
      start(item.item_id, item.title, gapMin)
    },
    [start]
  )
  return { timer, remainingMs, startFocus, cancelFocus: cancel }
}

// ── Inline running-timer pill (shown when a timer is active) ─────────────────

function RunningTimerPill({
  timer,
  remainingMs,
  onCancel,
}: {
  timer: FocusTimerState
  remainingMs: number
  onCancel: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(168, 85, 247, 0.10)',
        border: '1px solid var(--c-live-now)',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 12,
      }}
      data-component="focus-timer-pill"
    >
      <span style={{ color: 'var(--c-live-now)', fontWeight: 700, letterSpacing: 0.5 }}>
        ● Focus
      </span>
      <span style={{ color: 'var(--rp-white)', fontWeight: 600 }}>
        {formatCountdown(remainingMs)}
      </span>
      <span
        style={{
          color: 'var(--rp-gold-lite)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 200,
        }}
        title={timer.title}
      >
        {timer.title}
      </span>
      <button
        type="button"
        onClick={onCancel}
        style={{
          background: 'transparent',
          border: '1px solid var(--rp-gold-lite)',
          color: 'var(--rp-gold-lite)',
          fontSize: 10,
          padding: '2px 6px',
          borderRadius: 4,
          cursor: 'pointer',
          fontFamily: 'inherit',
          letterSpacing: 0.5,
        }}
        aria-label="Cancel focus timer"
      >
        STOP
      </button>
    </div>
  )
}

// ── Modal-style section (used in BriefingModal) ──────────────────────────────

const NAVY = '#0E3470'
const GOLD = '#FFCC33'
const TEXT = '#F5EFD8'
const MUTED = '#8C8771'
const VIOLET = '#A855F7'

export function SuggestedFocusSection({ items }: { items: SuggestedFocusItem[] }) {
  const { timer, remainingMs, startFocus, cancelFocus } = useFocusActions()
  const [open, setOpen] = useState<boolean>(true)

  const hasItems = items.length > 0
  const hasTimer = Boolean(timer)
  if (!hasItems && !hasTimer) return null

  return (
    <div data-component="suggested-focus-section">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 0,
          color: GOLD,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: 8,
        }}
        aria-expanded={open}
      >
        <span>Suggested Focus</span>
        <span style={{ color: MUTED, fontSize: 11 }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {timer && (
            <RunningTimerPill timer={timer} remainingMs={remainingMs} onCancel={cancelFocus} />
          )}
          {items.map((it) => {
            const isActive = timer?.item_id === it.item_id
            return (
              <div
                key={it.item_id}
                style={{
                  background: 'rgba(255, 204, 51, 0.05)',
                  border: `1px solid ${isActive ? VIOLET : GOLD + '44'}`,
                  borderLeft: `3px solid ${isActive ? VIOLET : GOLD}`,
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        color: priorityColor(it.priority),
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.10em',
                      }}
                    >
                      {priorityLabel(it.priority)}
                    </span>
                    <span style={{ color: MUTED, fontSize: 11 }}>
                      {formatGapWindow(it.gap_start, it.gap_end)}
                    </span>
                  </div>
                  <div
                    style={{
                      color: TEXT,
                      fontSize: 13,
                      fontWeight: 600,
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={it.title}
                  >
                    {it.title}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startFocus(it)}
                  disabled={isActive}
                  style={{
                    background: isActive ? 'transparent' : GOLD,
                    color: isActive ? VIOLET : NAVY,
                    border: `1px solid ${isActive ? VIOLET : GOLD}`,
                    fontWeight: 700,
                    fontSize: 11,
                    padding: '6px 10px',
                    borderRadius: 4,
                    cursor: isActive ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isActive ? 'Running…' : 'Start this now'}
                </button>
              </div>
            )
          })}
          {!hasItems && timer && (
            <div style={{ color: MUTED, fontSize: 11 }}>
              Focus already running — finish or stop above to suggest more.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Mini-card (used in PipelineColumn) ───────────────────────────────────────

export function SuggestedFocusMiniCard({ items }: { items: SuggestedFocusItem[] }) {
  const { timer, remainingMs, startFocus, cancelFocus } = useFocusActions()
  const top = items[0]

  if (!top && !timer) return null

  return (
    <section
      data-section="suggested-focus"
      style={{
        padding: '0.85rem 1rem',
        borderBottom: '1px solid var(--rp-border)',
      }}
    >
      <div
        style={{
          color: 'var(--rp-gold)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 8,
        }}
      >
        Suggested Focus
      </div>
      {timer && (
        <div style={{ marginBottom: top ? 8 : 0 }}>
          <RunningTimerPill timer={timer} remainingMs={remainingMs} onCancel={cancelFocus} />
        </div>
      )}
      {top && (
        <div
          style={{
            background: 'var(--rp-surface)',
            border: '1px solid var(--rp-border)',
            borderLeft: `3px solid ${timer?.item_id === top.item_id ? 'var(--c-live-now)' : 'var(--rp-gold)'}`,
            borderRadius: 6,
            padding: '0.55rem 0.75rem',
            fontSize: 13,
            color: 'var(--rp-white)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  color: priorityColor(top.priority),
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                }}
              >
                {priorityLabel(top.priority)}
              </span>
              <span style={{ color: 'var(--rp-gold-lite)', fontSize: 11 }}>
                {formatGapWindow(top.gap_start, top.gap_end)}
              </span>
            </div>
            <div
              style={{
                fontWeight: 600,
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={top.title}
            >
              {top.title}
            </div>
          </div>
          <button
            type="button"
            onClick={() => startFocus(top)}
            disabled={timer?.item_id === top.item_id}
            style={{
              background: timer?.item_id === top.item_id ? 'transparent' : 'var(--rp-gold)',
              color: timer?.item_id === top.item_id ? 'var(--c-live-now)' : 'var(--rp-navy)',
              border: `1px solid ${timer?.item_id === top.item_id ? 'var(--c-live-now)' : 'var(--rp-gold)'}`,
              fontWeight: 700,
              fontSize: 11,
              padding: '6px 10px',
              borderRadius: 4,
              cursor: timer?.item_id === top.item_id ? 'default' : 'pointer',
              fontFamily: 'inherit',
              letterSpacing: 0.4,
              whiteSpace: 'nowrap',
            }}
          >
            {timer?.item_id === top.item_id ? 'Running…' : 'Start this now'}
          </button>
        </div>
      )}
    </section>
  )
}
