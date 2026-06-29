/**
 * Tile data shapes for /center/v2 band 2 — the iPhone-grid canvas.
 *
 * Tiles compose existing query results (briefing.active_deals, investor
 * cadence, unread WhatsApp threads). No new server endpoints — keep the
 * v2 surface presentation-only.
 */

export type TileChannel =
  | 'investor'
  | '305'
  | '718'
  | 'imsg'
  | 'sms'
  | 'live'
  | 'warn'
  | 'fail'
  | 'gold'

export type DealTileData = {
  id: number
  title: string
  value: number
  currency: string
  stage: string
  pipedriveUrl: string
  /** Color of the top bar — defaults to gold for active. */
  channel: TileChannel
  /** Optional one-line status under the title. */
  subtitle?: string
}

export type InvestorTileData = {
  pipedriveContactId: number | null
  threadId: string | null
  name: string
  /** "12d ago" / "today" / "—". */
  lastReply: string
  channel: TileChannel
}

export type LiveThreadTileData = {
  threadId: string
  contactName: string
  panel: '305' | '718' | 'investor' | string
  preview: string
  unreadCount: number
  channel: TileChannel
}

/** Map a thread `panel` value to one of our channel colors. */
export function panelToChannel(
  panel: string | null | undefined,
  isInvestor: boolean,
): TileChannel {
  if (isInvestor) return 'investor'
  if (panel === '305') return '305'
  if (panel === '718') return '718'
  return 'sms'
}
