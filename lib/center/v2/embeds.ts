/**
 * Embedded-browser surface registry — five tabs Gideon flips between
 * without leaving the kiosk.
 *
 * Pipedrive / Gmail / Perplexity render inline as iframes when the surface
 * is expanded. CoStar and Inforuptcy ship X-Frame-Options that block
 * embedding, so they fall back to "open in tab". The chip surfaces this
 * by showing a ↗ glyph instead of expanding.
 */

export type EmbedKey = 'perplexity' | 'pipedrive' | 'gmail' | 'costar' | 'inforuptcy'

export type EmbedTab = {
  key: EmbedKey
  label: string
  url: string
  /** When true, X-Frame-Options blocks the iframe; show open-in-tab UX. */
  externalOnly: boolean
}

export const EMBED_TABS: EmbedTab[] = [
  {
    key: 'perplexity',
    label: 'Perplexity',
    url: 'https://www.perplexity.ai/',
    externalOnly: false,
  },
  {
    key: 'pipedrive',
    label: 'Pipedrive',
    url: 'https://reprimegroup.pipedrive.com/',
    externalOnly: false,
  },
  {
    key: 'gmail',
    label: 'Gmail',
    url: 'https://mail.google.com/',
    externalOnly: false,
  },
  {
    key: 'costar',
    label: 'CoStar',
    url: 'https://www.costar.com/',
    externalOnly: true,
  },
  {
    key: 'inforuptcy',
    label: 'Inforuptcy',
    url: 'https://inforuptcy.com/',
    externalOnly: true,
  },
]
