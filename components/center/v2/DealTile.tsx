'use client'

import Tile from './Tile'
import type { DealTileData } from '@/lib/center/v2/tiles'

/**
 * DealTile — single active-deal tile in the v2 canvas.
 *
 * Click opens the DealFolderWindow via WindowManager (target `deal-folder`).
 * The folder groups everything related to that deal — bucket items,
 * reminders, related investors, threads, files — without duplicating the
 * Pipedrive deep link (rendered inside the folder header).
 */

function formatCurrency(value: number, currency: string): string {
  if (!Number.isFinite(value) || value === 0) return ''
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `$${Math.round(value).toLocaleString('en-US')}`
  }
}

export default function DealTile({ deal }: { deal: DealTileData }) {
  const value = formatCurrency(deal.value, deal.currency)
  return (
    <Tile
      channel={deal.channel}
      title={deal.title}
      subtitle={value || undefined}
      meta={deal.stage}
      onClick={() => {
        if (typeof window === 'undefined') return
        window.dispatchEvent(
          new CustomEvent('center:open-window', {
            detail: {
              target: 'deal-folder',
              opts: {
                title: deal.title,
                componentProps: {
                  dealId: deal.id,
                  title: deal.title,
                  pipedriveUrl: deal.pipedriveUrl,
                  stage: deal.stage,
                  value: deal.value,
                  currency: deal.currency,
                },
              },
            },
          }),
        )
      }}
    />
  )
}
