/**
 * RePrime brand tokens — single source of truth.
 *
 * Migration brief (May 3, 2026): one gold (#FFCC33 Imperial Gold) and one navy (#0E3470).
 * Hierarchy comes from opacity, never from a different gold hex.
 *
 * Brand reference: dashboard/_terminal-design-reference/brand/TerminalLogo.jsx
 *                  dashboard/_terminal-design-reference/brand/CLAUDE_CODE_MIGRATION_BRIEF.md
 *
 * RULE: do not introduce new navy or gold hex values. Use these tokens or rgba() with
 * the brand RGB triplets defined below.
 */

/** Imperial Gold — the only brand gold. */
export const GOLD = '#FFCC33' as const

/** Brand Navy — the only brand navy. */
export const NAVY = '#0E3470' as const

/** Cream paper. Used as a content-card background on navy. */
export const CREAM = '#F4EEE0' as const

/** Cream gradient stops used on speech bubbles and confirmation letters. */
export const CREAM_TOP = '#F8F0DA' as const
export const CREAM_BOTTOM = '#EFE2C4' as const

/** Brand RGB triplets — for building rgba() values. */
export const GOLD_RGB = '255, 204, 51' as const
export const NAVY_RGB = '14, 52, 112' as const

/**
 * Gold opacity scale. Hierarchy comes from these levels — never from a different hex.
 * Match call sites that previously used legacy gold variants:
 *   #FFD700 / #FFEC8A / #BC9C45 / #D4B86A → gold[100]
 *   #E8B840                                → gold[85]
 *   #C4A84E                                → gold[85]
 *   #B09040                                → gold[70]
 *   #A88B40 / #A08A3E                      → gold[55]
 *   subtle borders                         → gold[35] / gold[25] / gold[15]
 */
export const gold = {
  100: GOLD,
  92:  `rgba(${GOLD_RGB}, 0.92)`,
  85:  `rgba(${GOLD_RGB}, 0.85)`,
  70:  `rgba(${GOLD_RGB}, 0.70)`,
  55:  `rgba(${GOLD_RGB}, 0.55)`,
  45:  `rgba(${GOLD_RGB}, 0.45)`,
  35:  `rgba(${GOLD_RGB}, 0.35)`,
  25:  `rgba(${GOLD_RGB}, 0.25)`,
  18:  `rgba(${GOLD_RGB}, 0.18)`,
  15:  `rgba(${GOLD_RGB}, 0.15)`,
  12:  `rgba(${GOLD_RGB}, 0.12)`,
  10:  `rgba(${GOLD_RGB}, 0.10)`,
  8:   `rgba(${GOLD_RGB}, 0.08)`,
  6:   `rgba(${GOLD_RGB}, 0.06)`,
  4:   `rgba(${GOLD_RGB}, 0.04)`,
} as const

/**
 * Navy opacity scale. Used for surface elevation and depth — every navy variation derives
 * from the single brand navy via opacity. No separate navy hex values anywhere.
 *
 *   surfaceDeep — replaces #0A1F44 (deeper surface, modal backgrounds)
 *   border      — replaces #1A3560 (elevated surface borders)
 *   labelOnCream — replaces #7A5A30 / #5A3F18 in cream-bubble label/name positions
 */
export const navy = {
  100:         NAVY,
  surfaceDeep: `rgba(${NAVY_RGB}, 0.85)`,
  border:      `rgba(${NAVY_RGB}, 0.70)`,
  labelOnCream:    `rgba(${NAVY_RGB}, 0.55)`,
  nameOnCream:     NAVY,
} as const

/**
 * Pro Max Light Theme tokens — high-contrast, modern, glassmorphic.
 * Used for the Command Center redesign.
 */
export const PRO_MAX = {
  background: '#FFFFFF',
  surface: {
    main: '#FFFFFF',
    soft: '#F9FAFB',
    glass: 'rgba(255, 255, 255, 0.85)',
  },
  border: {
    main: 'rgba(0, 0, 0, 0.05)',
    soft: 'rgba(0, 0, 0, 0.03)',
  },
  text: {
    main: '#111827',
    muted: '#6B7280',
    inverse: '#FFFFFF',
  },
  accent: {
    blue: '#3B82F6',
    purple: '#A855F7',
    gold: '#FFCC33',
    navy: '#0E3470',
  },
  status: {
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  }
} as const

/** Convenience export matching the contract in TerminalLogo.jsx. */
export const REPRIME_BRAND = {
  gold: GOLD,
  navy: NAVY,
  cream: CREAM,
  black: '#000000',
  white: '#FFFFFF',
} as const

/** Non-brand functional colors — updated for Pro Max parity. */
export const status = {
  success: PRO_MAX.status.success,
  warning: PRO_MAX.status.warning,
  error:   PRO_MAX.status.error,
  info:    PRO_MAX.status.info,
  amber:   '#FFBC7D',
  teal:    '#009080',
} as const

/**
 * Typography tokens — single source of truth for the body font stack.
 *
 * Switched from Poppins to Lexend on May 5, 2026 on peer-reviewed dyslexia
 * evidence (Shaver-Troup studies; BDA 2023 endorsement). Settings panel
 * retains a per-session font override. Lexend is loaded via next/font in
 * app/layout.tsx and exposed as the CSS variable --font-lexend; globals.css
 * wires it into body via --rp-font-body with a Poppins fallback for
 * graceful degradation. Terminal-recipient pages keep their locked Playfair
 * design and are not affected by this token.
 *
 * Consumers that previously read a Poppins token name should keep importing
 * `body` (the alias is stable) — the value resolves to the active Lexend
 * stack at runtime.
 */
export const typography = {
  /** Body / "Poppins-style" alias. Stable name, Lexend value. */
  body: 'var(--rp-font-body)',
  /** Explicit Lexend reference for callers that want to bypass the alias. */
  lexend: 'var(--font-lexend), Lexend, sans-serif',
  /** Full fallback chain — match the body stack for parity. */
  fontStack:
    'var(--font-lexend), Lexend, Poppins, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
} as const

/**
 * Stable alias preserved for any historical consumer that was reading a
 * "poppins" token name. Now points at the Lexend body stack so existing
 * imports keep working without code changes.
 */
export const POPPINS = typography.body
