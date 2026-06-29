'use client'

import type { ReactNode } from 'react'
import type { TileChannel } from '@/lib/center/v2/tiles'

/**
 * Tile — shared visual primitive for the v2 band-2 grid.
 *
 * Spec §3 band 2 + §1.2 Apple HIG: rounded square, ~150–200px on the short
 * axis, 16-px gutter, big Lexend bold label, colored top bar that carries
 * channel/status meaning per the meaning-based palette. Click target fills
 * the whole tile to honor the 44pt minimum.
 */

const CHANNEL_COLORS: Record<TileChannel, string> = {
  investor: 'var(--c-investor)',
  '305': 'var(--c-channel-305)',
  '718': 'var(--c-channel-718)',
  imsg: 'var(--c-channel-imsg)',
  sms: 'var(--c-channel-sms)',
  live: 'var(--c-live-now)',
  warn: 'var(--c-warn)',
  fail: 'var(--c-fail)',
  gold: '#FFCC33',
}

type TileProps = {
  channel: TileChannel
  title: string
  subtitle?: string | null
  meta?: string | null
  badge?: string | number | null
  onClick?: () => void
  children?: ReactNode
  /** Set to true to render as a "live now" tile with a pulse indicator. */
  pulse?: boolean
}

export default function Tile({
  channel,
  title,
  subtitle,
  meta,
  badge,
  onClick,
  children,
  pulse,
}: TileProps) {
  const accent = CHANNEL_COLORS[channel] ?? '#FFCC33'
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative',
        background: 'rgba(14, 52, 112, 0.55)',
        border: '1px solid rgba(255, 204, 51, 0.22)',
        borderRadius: 12,
        overflow: 'hidden',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        color: '#F5EFD8',
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 150,
        padding: '14px 16px 12px',
      }}
      onMouseEnter={(e) => {
        if (!onClick) return
        e.currentTarget.style.background = 'rgba(14, 52, 112, 0.78)'
      }}
      onMouseLeave={(e) => {
        if (!onClick) return
        e.currentTarget.style.background = 'rgba(14, 52, 112, 0.55)'
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: accent,
        }}
      />
      {pulse && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'var(--c-live-now)',
            boxShadow: '0 0 0 4px rgba(168, 85, 247, 0.25)',
          }}
        />
      )}
      <div
        style={{
          marginTop: 4,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '-0.005em',
          lineHeight: 1.2,
          color: '#FFCC33',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 13,
            color: '#F5EFD8',
            opacity: 0.9,
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
      )}
      {meta && (
        <div
          style={{
            fontSize: 11,
            color: '#F5EFD8',
            opacity: 0.65,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontWeight: 600,
            marginTop: 'auto',
          }}
        >
          {meta}
        </div>
      )}
      {badge != null && badge !== '' && (
        <span
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            background: accent,
            color: '#0E3470',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.04em',
            borderRadius: 999,
            padding: '2px 8px',
          }}
        >
          {badge}
        </span>
      )}
      {children}
    </button>
  )
}
