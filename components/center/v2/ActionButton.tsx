'use client'

/**
 * ActionButton — big square action button for the v2 top strip.
 *
 * Spec §3 band 1: 6 buttons in the HUD (Briefing / Cadence / Secretary /
 * Settings / New Deal / New Note). Each is icon + 1-word Lexend label.
 * Memory ui_density_preference.md: Gideon prefers many big buttons over
 * compact toggles — these are deliberately oversized.
 */

type ActionButtonProps = {
  icon: string
  label: string
  onClick: () => void
  title?: string
  /** Optional small badge on the corner (e.g. "3"). */
  badge?: string | number | null
}

export default function ActionButton({
  icon,
  label,
  onClick,
  title,
  badge,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
      style={{
        position: 'relative',
        width: 64,
        height: 64,
        borderRadius: 12,
        background: 'rgba(255, 204, 51, 0.10)',
        border: '1px solid rgba(255, 204, 51, 0.45)',
        color: '#FFCC33',
        fontFamily: 'inherit',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        flexShrink: 0,
        transition: 'background 120ms, border-color 120ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 204, 51, 0.18)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 204, 51, 0.10)'
      }}
    >
      <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>
        {icon}
      </span>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        {label}
      </span>
      {badge != null && badge !== '' && (
        <span
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            background: 'var(--c-fail)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 800,
            borderRadius: 999,
            padding: '1px 6px',
            letterSpacing: '0.04em',
            border: '1px solid rgba(14, 52, 112, 0.96)',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}
