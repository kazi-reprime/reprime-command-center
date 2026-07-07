'use client'

import { useSyncExternalStore } from 'react'

/**
 * Window kinds — discriminated union of what a window can host.
 *
 * - iframe   : embeds a URL (Perplexity, Pipedrive, Gmail). Subject to
 *              X-Frame-Options on the target. Falls back to a manual "open
 *              in new tab" affordance inside the window if the frame is
 *              blocked.
 * - external : known X-Frame-blocked target (CoStar, LoopNet). The window
 *              renders a CTA panel that opens the URL in a new tab; closing
 *              the window does not affect the spawned tab.
 * - component: a registered component key + props. The WindowManager
 *              resolves the key via its registry. Used for BucketItem
 *              detail and InvestorProfile.
 */
export type WindowKind =
  | { type: 'iframe'; url: string; sandbox?: string }
  | { type: 'external'; url: string }
  | { type: 'component'; key: string; props?: Record<string, unknown> }

export type WindowState = {
  id: string
  title: string
  kind: WindowKind
  x: number
  y: number
  width: number
  height: number
  z: number
  minimized: boolean
  /** Reminder id this window was spawned for. Closing the window does NOT
   *  cancel the reminder — the reminder toast still fires and offers
   *  "Reopen" to re-spawn this window. */
  attached_reminder_id?: string
  /** Pre-maximize bounds so toggleMaximize can restore them. */
  prevBounds?: { x: number; y: number; width: number; height: number }
  maximized?: boolean
}

type Listener = () => void

export type StoreSnapshot = {
  windows: ReadonlyArray<WindowState>
  focusedId: string | null
  topZ: number
}

export type OpenOpts = {
  id?: string
  title?: string
  query?: string
  url?: string
  width?: number
  height?: number
  x?: number
  y?: number
  attached_reminder_id?: string
  componentProps?: Record<string, unknown>
}

type Resolved = {
  title: string
  kind: WindowKind
  defaultWidth?: number
  defaultHeight?: number
}

type TargetResolver = (opts: OpenOpts) => Resolved

const TARGETS: Record<string, TargetResolver> = {
  perplexity: (o) => ({
    title: o.title ?? (o.query ? `Perplexity — ${o.query}` : 'Perplexity'),
    kind: {
      type: 'iframe',
      url:
        o.url ??
        `https://www.perplexity.ai/?q=${encodeURIComponent(o.query ?? '')}`,
    },
    defaultWidth: 960,
    defaultHeight: 720,
  }),
  pipedrive: (o) => ({
    title: o.title ?? 'Pipedrive',
    kind: { type: 'iframe', url: o.url ?? 'https://reprimegroup.pipedrive.com/' },
    defaultWidth: 1100,
    defaultHeight: 800,
  }),
  gmail: (o) => ({
    title: o.title ?? 'Gmail',
    kind: { type: 'iframe', url: o.url ?? 'https://mail.google.com/' },
    defaultWidth: 1100,
    defaultHeight: 800,
  }),
  costar: (o) => ({
    title: o.title ?? 'CoStar',
    kind: { type: 'external', url: o.url ?? 'https://www.costar.com/' },
    defaultWidth: 480,
    defaultHeight: 240,
  }),
  loopnet: (o) => ({
    title: o.title ?? 'LoopNet',
    kind: { type: 'external', url: o.url ?? 'https://www.loopnet.com/' },
    defaultWidth: 480,
    defaultHeight: 240,
  }),
  'bucket-item': (o) => ({
    title: o.title ?? 'Bucket item',
    kind: { type: 'component', key: 'bucket-item', props: o.componentProps },
    defaultWidth: 720,
    defaultHeight: 600,
  }),
  'investor-profile': (o) => ({
    title: o.title ?? 'Investor profile',
    kind: {
      type: 'component',
      key: 'investor-profile',
      props: o.componentProps,
    },
    defaultWidth: 880,
    defaultHeight: 720,
  }),
  secretary: (o) => ({
    title: o.title ?? 'Awaiting Reply',
    kind: { type: 'component', key: 'secretary', props: o.componentProps },
    defaultWidth: 720,
    defaultHeight: 720,
  }),
  'investor-cadence': (o) => ({
    title: o.title ?? 'Investor cadence',
    kind: {
      type: 'component',
      key: 'investor-cadence',
      props: o.componentProps,
    },
    defaultWidth: 880,
    defaultHeight: 720,
  }),
  settings: (o) => ({
    title: o.title ?? 'Settings',
    kind: { type: 'component', key: 'settings', props: o.componentProps },
    defaultWidth: 720,
    defaultHeight: 640,
  }),
  // Deal folder — opened from /center/v2 DealTile clicks. Renders the
  // DealFolderWindow component (registered in app/center/v2/page.tsx so v1
  // doesn't pick it up automatically).
  'deal-folder': (o) => ({
    title: o.title ?? 'Deal',
    kind: { type: 'component', key: 'deal-folder', props: o.componentProps },
    defaultWidth: 880,
    defaultHeight: 700,
  }),
  chat: (o) => ({
    title: o.title ?? 'Chat',
    kind: { type: 'component', key: 'chat', props: o.componentProps },
    defaultWidth: 520,
    defaultHeight: 720,
  }),
}


const INITIAL: StoreSnapshot = {
  windows: [],
  focusedId: null,
  topZ: 100,
}

let _state: StoreSnapshot = INITIAL
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l()
}

function update(producer: (s: StoreSnapshot) => StoreSnapshot) {
  _state = producer(_state)
  emit()
}

let idCounter = 0
function genId() {
  idCounter += 1
  return `win-${Date.now().toString(36)}-${idCounter}`
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function viewport() {
  if (typeof window === 'undefined') return { w: 1280, h: 800 }
  return { w: window.innerWidth, h: window.innerHeight }
}

function defaultPosition(width: number, height: number, count: number) {
  const { w, h } = viewport()
  const cx = Math.max(0, Math.round((w - width) / 2))
  const cy = Math.max(60, Math.round((h - height) / 2))
  // Cascade by 24px per existing window so multiple opens don't stack identically.
  const offset = (count % 6) * 24
  return {
    x: clamp(cx + offset, 0, Math.max(0, w - width)),
    y: clamp(cy + offset, 60, Math.max(60, h - height - 120)),
  }
}

function focusReducer(s: StoreSnapshot, id: string): StoreSnapshot {
  const target = s.windows.find((w) => w.id === id)
  if (!target) return s
  const newZ = s.topZ + 1
  return {
    ...s,
    windows: s.windows.map((w) => (w.id === id ? { ...w, z: newZ } : w)),
    focusedId: id,
    topZ: newZ,
  }
}

export const windowsStore = {
  getSnapshot(): StoreSnapshot {
    return _state
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  open(target: string, opts: OpenOpts = {}): string {
    const resolver = TARGETS[target]
    if (!resolver) {
      // Unknown target — log + no-op so callers don't crash the kiosk.
      // eslint-disable-next-line no-console
      console.warn(`[windows] unknown target "${target}"`)
      return ''
    }
    const resolved = resolver(opts)
    const width = opts.width ?? resolved.defaultWidth ?? 720
    const height = opts.height ?? resolved.defaultHeight ?? 560
    const id = opts.id ?? genId()

    update((s) => {
      const existing = s.windows.find((w) => w.id === id)
      if (existing) {
        // Same id reopened: focus + un-minimize, do not duplicate.
        return focusReducer(
          {
            ...s,
            windows: s.windows.map((w) =>
              w.id === id ? { ...w, minimized: false } : w,
            ),
          },
          id,
        )
      }
      const pos = defaultPosition(width, height, s.windows.length)
      const next: WindowState = {
        id,
        title: opts.title ?? resolved.title,
        kind: resolved.kind,
        x: opts.x ?? pos.x,
        y: opts.y ?? pos.y,
        width,
        height,
        z: s.topZ + 1,
        minimized: false,
        attached_reminder_id: opts.attached_reminder_id,
      }
      return {
        windows: [...s.windows, next],
        focusedId: id,
        topZ: s.topZ + 1,
      }
    })
    return id
  },
  close(id: string) {
    update((s) => {
      const remaining = s.windows.filter((w) => w.id !== id)
      const newFocus =
        s.focusedId === id
          ? remaining.length > 0
            ? remaining[remaining.length - 1].id
            : null
          : s.focusedId
      return { ...s, windows: remaining, focusedId: newFocus }
    })
  },
  minimize(id: string) {
    update((s) => ({
      ...s,
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, minimized: true } : w,
      ),
      focusedId: s.focusedId === id ? null : s.focusedId,
    }))
  },
  restore(id: string) {
    update((s) =>
      focusReducer(
        {
          ...s,
          windows: s.windows.map((w) =>
            w.id === id ? { ...w, minimized: false } : w,
          ),
        },
        id,
      ),
    )
  },
  focus(id: string) {
    update((s) => focusReducer(s, id))
  },
  move(id: string, x: number, y: number) {
    update((s) => {
      const { w: vw, h: vh } = viewport()
      return {
        ...s,
        windows: s.windows.map((wnd) => {
          if (wnd.id !== id) return wnd
          const cx = clamp(x, -wnd.width + 80, Math.max(0, vw - 80))
          const cy = clamp(y, 0, Math.max(0, vh - 60))
          return { ...wnd, x: cx, y: cy, maximized: false }
        }),
      }
    })
  },
  resize(id: string, width: number, height: number) {
    update((s) => {
      const { w: vw, h: vh } = viewport()
      return {
        ...s,
        windows: s.windows.map((wnd) => {
          if (wnd.id !== id) return wnd
          return {
            ...wnd,
            width: clamp(width, 320, vw),
            height: clamp(height, 200, vh),
            maximized: false,
          }
        }),
      }
    })
  },
  toggleMaximize(id: string) {
    update((s) => {
      const { w: vw, h: vh } = viewport()
      return {
        ...s,
        windows: s.windows.map((wnd) => {
          if (wnd.id !== id) return wnd
          if (wnd.maximized && wnd.prevBounds) {
            return {
              ...wnd,
              ...wnd.prevBounds,
              maximized: false,
              prevBounds: undefined,
            }
          }
          // Maximize: leave space for top strip, taskbar, voice shell footer.
          const margin = 16
          const topPad = 32
          const bottomPad = 96 + 44 + margin
          return {
            ...wnd,
            prevBounds: {
              x: wnd.x,
              y: wnd.y,
              width: wnd.width,
              height: wnd.height,
            },
            x: margin,
            y: topPad,
            width: vw - margin * 2,
            height: vh - topPad - bottomPad,
            maximized: true,
          }
        }),
      }
    })
  },
}

// React hook — full snapshot. Components that only need a slice can read
// it from the snapshot directly; we keep the hook simple to stay
// useSyncExternalStore-correct (snapshot reference must be stable per render).
export function useWindows(): StoreSnapshot {
  return useSyncExternalStore(
    windowsStore.subscribe,
    windowsStore.getSnapshot,
    () => INITIAL,
  )
}

// Loosely-coupled trigger for other tracks (voice shell, briefing, columns):
// dispatch the global `center:open-window` CustomEvent and the WindowManager
// listens for it. This lets code1's voice parser open windows without
// importing this file directly.
export type OpenWindowEventDetail = { target: string; opts?: OpenOpts }

export function dispatchOpenWindow(target: string, opts: OpenOpts = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<OpenWindowEventDetail>('center:open-window', {
      detail: { target, opts },
    }),
  )
}
