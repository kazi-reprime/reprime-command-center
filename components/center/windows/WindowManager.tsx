'use client'

import { useEffect, type ReactNode } from 'react'
import {
  windowsStore,
  useWindows,
  type OpenWindowEventDetail,
  type WindowState,
} from '@/lib/windows/store'
import Window from './Window'

/**
 * Renderer for component-kind windows. Tracks register their components
 * here as they land — Track B (Bucket) plugs in the real BucketItem
 * detail; the Investor track plugs in InvestorProfile.
 */
type ComponentRenderer = (props: Record<string, unknown>) => ReactNode
export type ComponentRegistry = Record<string, ComponentRenderer>

const DEFAULT_REGISTRY: ComponentRegistry = {
  'bucket-item': (props) => (
    <BucketItemDetailStub
      {...(props as { itemId?: string; title?: string })}
    />
  ),
  'investor-profile': (props) => (
    <InvestorProfileStub
      {...(props as { id?: string; name?: string })}
    />
  ),
}

type Props = {
  /** Optional component renderers; merged over DEFAULT_REGISTRY. */
  registry?: ComponentRegistry
}

/**
 * WindowManager — global manager mounted at the kiosk root.
 *
 * Sits in a fixed-position overlay above the four-column canvas. The
 * overlay itself is pointer-events:none so the comms columns underneath
 * stay clickable; each window flips pointer-events:auto on its own box.
 *
 * Listens for the `center:open-window` CustomEvent so other tracks (voice
 * shell, briefing, reminder toast) can open windows without importing
 * this file.
 */
export default function WindowManager({ registry }: Props) {
  const { windows, focusedId } = useWindows()

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<OpenWindowEventDetail>
      const detail = ce.detail
      if (!detail || !detail.target) return
      windowsStore.open(detail.target, detail.opts ?? {})
    }
    window.addEventListener('center:open-window', handler)
    return () => window.removeEventListener('center:open-window', handler)
  }, [])

  const reg: ComponentRegistry = { ...DEFAULT_REGISTRY, ...(registry ?? {}) }

  return (
    <div
      data-component="window-manager"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        pointerEvents: 'none',
      }}
    >
      {windows
        .filter((w) => !w.minimized)
        .map((w) => (
          <Window key={w.id} state={w} isFocused={w.id === focusedId}>
            {renderBody(w, reg)}
          </Window>
        ))}
    </div>
  )
}

function renderBody(state: WindowState, registry: ComponentRegistry): ReactNode {
  if (state.kind.type === 'iframe') {
    return (
      <iframe
        src={state.kind.url}
        title={state.title}
        sandbox={state.kind.sandbox}
        style={{
          width: '100%',
          height: '100%',
          border: 0,
          background: '#fff',
        }}
      />
    )
  }
  if (state.kind.type === 'external') {
    return <ExternalTabFallback url={state.kind.url} title={state.title} />
  }
  const renderFn = registry[state.kind.key]
  if (!renderFn) {
    return (
      <div style={{ padding: 24, fontSize: 13 }}>
        No renderer registered for component key{' '}
        <code>{state.kind.key}</code>.
      </div>
    )
  }
  return <>{renderFn(state.kind.props ?? {})}</>
}

function ExternalTabFallback({
  url,
  title,
}: {
  url: string
  title: string
}) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 13, color: '#F5EFD8', maxWidth: 320 }}>
        {title} blocks embedding. Open it in a new tab — closing this
        window does not close the tab.
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          padding: '8px 16px',
          background: 'rgba(255, 204, 51, 0.85)',
          color: '#0E3470',
          textDecoration: 'none',
          borderRadius: 6,
          fontWeight: 600,
          fontSize: 13,
          fontFamily: 'inherit',
        }}
      >
        Open {title} in new tab
      </a>
    </div>
  )
}

function BucketItemDetailStub({
  itemId,
  title,
}: {
  itemId?: string
  title?: string
}) {
  return (
    <div style={{ padding: 24, fontSize: 13, lineHeight: 1.55 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
        {title ?? 'Bucket item'}
      </div>
      <div style={{ color: '#9DB3D6', fontSize: 12 }}>
        Detail view for <code>{itemId ?? '—'}</code> wires in with Track B
        (feat/center-bucket).
      </div>
    </div>
  )
}

function InvestorProfileStub({
  id,
  name,
}: {
  id?: string
  name?: string
}) {
  return (
    <div style={{ padding: 24, fontSize: 13, lineHeight: 1.55 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
        Investor profile
      </div>
      <div style={{ color: '#9DB3D6', fontSize: 12 }}>
        {name ?? id ?? '—'} — full slide-in mounts here when the Investor
        track wires its renderer into the WindowManager registry.
      </div>
    </div>
  )
}
