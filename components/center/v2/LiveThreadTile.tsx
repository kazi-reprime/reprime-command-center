'use client'

import Tile from './Tile'
import type { LiveThreadTileData } from '@/lib/center/v2/tiles'

/**
 * LiveThreadTile — recently-active thread on the v2 canvas. Channel color
 * matches the panel (305 amber / 718 green / iMessage blue / investor
 * gold). Click jumps to the thread inside the WhatsApp dock.
 */
export default function LiveThreadTile({
  thread,
}: {
  thread: LiveThreadTileData
}) {
  return (
    <Tile
      channel={thread.channel}
      title={thread.contactName || 'Unknown'}
      subtitle={thread.preview || '—'}
      meta={`Panel ${thread.panel}`}
      badge={thread.unreadCount > 0 ? thread.unreadCount : null}
      pulse
      onClick={() => {
        if (typeof window === 'undefined') return
        // Live thread tiles open the search modal pre-filtered to that
        // contact — the same chat surface v1 uses. A dedicated
        // dock-pane hand-off lands when WhatsAppDock exposes one.
        window.dispatchEvent(
          new CustomEvent('center:open-search', {
            detail: { query: thread.contactName },
          }),
        )
      }}
    />
  )
}
