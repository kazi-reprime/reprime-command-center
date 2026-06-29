'use client'

/**
 * KpiCard — single big-number tile for the v2 top strip.
 *
 * Spec §3 band 1: gold number, cream-on-navy small-caps label below. The
 * card is its own clickable region so a glance plus tap is one motion.
 */
type KpiCardProps = {
  value: number | string
  label: string
  /** Optional extra status pill ("3 cold") rendered next to the label. */
  badge?: string | null
  /** Optional click handler — a card with action (e.g. open cadence). */
  onClick?: () => void
  /** Pull-quote tooltip on hover. */
  title?: string
}

export default function KpiCard({
  value,
  label,
  badge,
  onClick,
  title,
}: KpiCardProps) {
  const interactive = typeof onClick === 'function'
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={!interactive}
      style={{
        minWidth: 96,
        padding: '6px 14px',
        background: 'rgba(255, 204, 51, 0.06)',
        border: '1px solid rgba(255, 204, 51, 0.30)',
        borderRadius: 10,
        color: '#FFCC33',
        fontFamily: 'inherit',
        textAlign: 'left',
        cursor: interactive ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1.0,
          color: '#FFCC33',
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            color: '#F5EFD8',
            opacity: 0.85,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        {badge && (
          <span
            style={{
              background: 'var(--c-fail)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 800,
              borderRadius: 999,
              padding: '1px 6px',
              letterSpacing: '0.04em',
            }}
          >
            {badge}
          </span>
        )}
      </div>
    </button>
  )
}
