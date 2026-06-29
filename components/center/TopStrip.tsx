'use client'

import { useQuery } from '@tanstack/react-query'
import ColorLegend from '@/components/help/ColorLegend'
import HealthPill from './HealthPill'
import IdentityPickerSlot from './IdentityPickerSlot'

const COLD_REFETCH_MS = 60_000

type CadenceStatus = 'cold' | 'cooling' | 'warm' | 'hot'

interface CadenceItem {
  status: CadenceStatus
}

interface CadencePayload {
  items: CadenceItem[]
}

/**
 * TopStrip — pinned top of /center kiosk.
 *
 * Layout: [ColorLegend (flex)] [Briefing pill] [Secretary pill] [Cadence pill] [IdentityPickerSlot]
 *
 * The Briefing pill dispatches an `open-briefing` window event. Secretary
 * and Cadence pills dispatch `center:open-window` with their respective
 * targets, which the WindowManager listens for. The Cadence pill carries
 * a live "N cold" badge so the count is visible without opening the
 * window. Decoupling here keeps the shell free of business-logic imports.
 */
export default function TopStrip() {
  const cadence = useQuery({
    queryKey: ['investor-cadence', 'cold-count'],
    queryFn: async (): Promise<CadencePayload> => {
      const res = await fetch('/api/investors/cadence', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as CadencePayload
    },
    refetchInterval: COLD_REFETCH_MS,
    staleTime: COLD_REFETCH_MS,
    retry: false,
  })

  const coldCount =
    cadence.data?.items.filter((i) => i.status === 'cold').length ?? 0

  function openBriefing() {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event('open-briefing'))
  }

  function openSecretary() {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent('center:open-window', {
        detail: { target: 'secretary' },
      }),
    )
  }

  function openCadence() {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent('center:open-window', {
        detail: { target: 'investor-cadence' },
      }),
    )
  }

  function openSettings() {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent('center:open-window', {
        detail: { target: 'settings' },
      }),
    )
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        height: 64,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'stretch',
        background: 'rgba(14, 52, 112, 0.96)',
        borderBottom: '1px solid rgba(255, 204, 51, 0.22)',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ColorLegend />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={openBriefing}
          title="Open morning briefing"
          style={{
            background: 'rgba(255, 204, 51, 0.10)',
            color: '#FFCC33',
            border: '1px solid rgba(255, 204, 51, 0.45)',
            borderRadius: 999,
            padding: '6px 18px',
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Briefing
        </button>

        <button
          type="button"
          onClick={openSecretary}
          title="Open Secretary — outbound asks awaiting reply"
          style={{
            background: 'rgba(255, 204, 51, 0.10)',
            color: '#FFCC33',
            border: '1px solid rgba(255, 204, 51, 0.45)',
            borderRadius: 999,
            padding: '6px 18px',
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Secretary
        </button>

        <button
          type="button"
          onClick={openCadence}
          title="Open investor cadence — coldest first"
          style={{
            background: 'rgba(255, 204, 51, 0.10)',
            color: '#FFCC33',
            border: '1px solid rgba(255, 204, 51, 0.45)',
            borderRadius: 999,
            padding: '6px 14px 6px 18px',
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          Cadence
          {coldCount > 0 && (
            <span
              aria-label={`${coldCount} cold investors`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'var(--c-fail)',
                color: '#fff',
                borderRadius: 999,
                padding: '1px 8px',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'none',
              }}
            >
              {coldCount} cold
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={openSettings}
          title="Open Settings"
          aria-label="Open Settings"
          style={{
            background: 'rgba(255, 204, 51, 0.10)',
            color: '#FFCC33',
            border: '1px solid rgba(255, 204, 51, 0.45)',
            borderRadius: 999,
            width: 36,
            height: 32,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'inherit',
            fontSize: 16,
            lineHeight: 1,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {'⚙'}
        </button>

        <HealthPill />

        <IdentityPickerSlot />
      </div>
    </div>
  )
}
