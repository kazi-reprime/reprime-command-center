'use client'

import type { TileChannel } from '@/lib/center/v2/tiles'

/**
 * WhatsAppPanelV2 — single dock panel card.
 *
 * Spec §3 band 4: thick colored top bar + tinted background per channel,
 * unread count top-right, headline preview below. Click expands the
 * panel into the WhatsApp window.
 */

const CHANNEL_BG: Record<TileChannel, string> = {
  '305': 'rgba(240, 180, 0, 0.12)',
  '718': 'rgba(37, 211, 102, 0.12)',
  imsg: 'rgba(10, 132, 255, 0.12)',
  sms: 'rgba(255, 149, 0, 0.12)',
  investor: 'rgba(255, 204, 51, 0.14)',
  live: 'rgba(168, 85, 247, 0.12)',
  warn: 'rgba(245, 158, 11, 0.12)',
  fail: 'rgba(239, 68, 68, 0.12)',
  gold: 'rgba(255, 204, 51, 0.10)',
}

const CHANNEL_BAR: Record<TileChannel, string> = {
  '305': 'var(--c-channel-305)',
  '718': 'var(--c-channel-718)',
  imsg: 'var(--c-channel-imsg)',
  sms: 'var(--c-channel-sms)',
  investor: 'var(--c-investor)',
  live: 'var(--c-live-now)',
  warn: 'var(--c-warn)',
  fail: 'var(--c-fail)',
  gold: '#FFCC33',
}

type WhatsAppPanelV2Props = {
  channel: TileChannel
  title: string
  subtitle?: string
  unreadCount: number
  /** Headline preview line (most recent thread). */
  preview?: string
  onClick: () => void
}

export default function WhatsAppPanelV2({
  channel,
  title,
  subtitle,
  unreadCount,
  preview,
  onClick,
}: WhatsAppPanelV2Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 200,
        minHeight: 140,
        background: CHANNEL_BG[channel] ?? 'rgba(255, 204, 51, 0.10)',
        border: '1px solid rgba(255, 204, 51, 0.18)',
        borderRadius: 12,
        padding: '20px 16px 14px',
        textAlign: 'left',
        color: '#F5EFD8',
        fontFamily: 'inherit',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        overflow: 'hidden',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 8,
          background: CHANNEL_BAR[channel] ?? '#FFCC33',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#FFCC33',
            letterSpacing: '-0.005em',
          }}
        >
          {title}
        </div>
        {unreadCount > 0 && (
          <span
            style={{
              background: CHANNEL_BAR[channel] ?? '#FFCC33',
              color: '#0E3470',
              fontSize: 12,
              fontWeight: 800,
              borderRadius: 999,
              padding: '2px 10px',
              letterSpacing: '0.04em',
            }}
          >
            {unreadCount}
          </span>
        )}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#F5EFD8',
            opacity: 0.7,
          }}
        >
          {subtitle}
        </div>
      )}
      {preview && (
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.45,
            color: '#F5EFD8',
            opacity: 0.85,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            marginTop: 2,
          }}
        >
          {preview}
        </div>
      )}
    </button>
  )
}
