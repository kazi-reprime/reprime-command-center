'use client'

type BrowserChipProps = {
  label: string
  active: boolean
  externalOnly: boolean
  onClick: () => void
}

/**
 * BrowserChip — single chip inside BrowserSurface. Shows a ↗ glyph for
 * domains that block X-Frame-Options (CoStar, Inforuptcy) so Gideon
 * knows up front the click opens a new tab instead of an inline frame.
 */
export default function BrowserChip({
  label,
  active,
  externalOnly,
  onClick,
}: BrowserChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active
          ? 'rgba(255, 204, 51, 0.18)'
          : 'rgba(255, 204, 51, 0.06)',
        color: '#FFCC33',
        border: `1px solid ${active ? '#FFCC33' : 'rgba(255, 204, 51, 0.35)'}`,
        borderRadius: 8,
        padding: '4px 12px',
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.06em',
        cursor: 'pointer',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {label}
      {externalOnly && (
        <span aria-hidden style={{ fontSize: 11, opacity: 0.85 }}>
          ↗
        </span>
      )}
    </button>
  )
}
