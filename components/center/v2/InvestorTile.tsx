'use client'

import Tile from './Tile'
import type { InvestorTileData } from '@/lib/center/v2/tiles'

/**
 * InvestorTile — single investor tile in the v2 canvas.
 *
 * Memory `investor_panel_chat_first.md` is the load-bearing rule here:
 * clicking the tile opens the WhatsApp chat in the dock — never the
 * profile. The profile is only reachable from the chat header's
 * dedicated `★ Open Profile` button.
 */
export default function InvestorTile({ investor }: { investor: InvestorTileData }) {
  return (
    <Tile
      channel={investor.channel}
      title={investor.name}
      subtitle={investor.lastReply ? `Last reply ${investor.lastReply}` : '—'}
      meta="Investor"
      onClick={() => {
        if (typeof window === 'undefined') return
        // Memory: investor_panel_chat_first.md — row click goes to chat,
        // never the profile. The InvestorCadenceWindow already routes its
        // row clicks to chat with the ★ Open Profile button in the chat
        // header, so we open it there until the kiosk has a dedicated
        // chat-pane in the v2 dock. Profile-only is forbidden per memory.
        window.dispatchEvent(
          new CustomEvent('center:open-window', {
            detail: {
              target: 'investor-cadence',
              opts: {
                componentProps: {
                  focusContactId: investor.pipedriveContactId,
                  focusName: investor.name,
                },
              },
            },
          }),
        )
      }}
    />
  )
}
