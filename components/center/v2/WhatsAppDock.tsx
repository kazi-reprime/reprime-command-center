'use client'

import { useQuery } from '@tanstack/react-query'
import WhatsAppPanelV2 from './WhatsAppPanelV2'

/**
 * WhatsAppDock — band 4 of /center/v2. Four cards across the bottom:
 * 305 / 718 / iMessage / Investors. Counts and the most-recent preview
 * come from the same /api/briefing/today payload v1 already drives.
 *
 * Click handlers dispatch the existing window events:
 *   - Investors → opens Pipedrive in a window (existing target) for now.
 *     Will swap to InvestorChatPanel when that exposes a public open
 *     event without modal-rebuilding.
 *   - 305 / 718 / iMessage → opens the chat list view; we use the
 *     existing search modal as the canonical landing point so the dock
 *     never traps Gideon in an iframe.
 */

const REFETCH_MS = 60_000

interface BriefingThread {
  id: string
  contact_name: string | null
  panel: string | null
  is_investor: boolean
  unread_count: number
  last_message_preview: string | null
}

interface BriefingPayload {
  unread: {
    total: number
    by_panel: { '305': number; '718': number; investors: number }
  }
  recent_investors?: BriefingThread[]
  pending_followups?: BriefingThread[]
}

function dispatchSearch(query: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('center:open-search', { detail: { query } }),
  )
}

function dispatchOpenWindow(target: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('center:open-window', { detail: { target } }),
  )
}

function pickPreview(threads: BriefingThread[] | undefined, panel: '305' | '718' | 'investors'): string {
  if (!threads || threads.length === 0) return ''
  const match = threads.find((t) => {
    if (panel === 'investors') return t.is_investor
    return t.panel === panel && !t.is_investor
  })
  if (!match) return ''
  const name = match.contact_name ?? '?'
  const text = match.last_message_preview ?? ''
  return text ? `${name}: ${text}` : name
}

export default function WhatsAppDock() {
  const briefing = useQuery({
    queryKey: ['briefing', 'today', 'whatsapp-dock-v2'],
    queryFn: async (): Promise<BriefingPayload> => {
      const res = await fetch('/api/briefing/today', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as BriefingPayload
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })

  const unread = briefing.data?.unread.by_panel ?? {
    '305': 0,
    '718': 0,
    investors: 0,
  }
  const followups = briefing.data?.pending_followups ?? []
  const investorThreads = briefing.data?.recent_investors ?? []

  return (
    <div
      data-component="whatsapp-dock-v2"
      style={{
        flexShrink: 0,
        display: 'flex',
        gap: 14,
        padding: '14px 18px',
        background: 'rgba(14, 52, 112, 0.55)',
        borderTop: '1px solid rgba(255, 204, 51, 0.18)',
        fontFamily: 'inherit',
      }}
    >
      <WhatsAppPanelV2
        channel="305"
        title="305"
        subtitle="RePrime business"
        unreadCount={unread['305']}
        preview={pickPreview(followups, '305')}
        onClick={() => dispatchSearch('panel:305 ')}
      />
      <WhatsAppPanelV2
        channel="718"
        title="718"
        subtitle="Personal WhatsApp"
        unreadCount={unread['718']}
        preview={pickPreview(followups, '718')}
        onClick={() => dispatchSearch('panel:718 ')}
      />
      <WhatsAppPanelV2
        channel="imsg"
        title="iMessage"
        subtitle="iMessage threads"
        unreadCount={0}
        preview="Mac server (BlueBubbles) feeds iMessage threads"
        onClick={() => dispatchSearch('panel:imessage ')}
      />
      <WhatsAppPanelV2
        channel="investor"
        title="Investors"
        subtitle="Star contacts"
        unreadCount={unread.investors}
        preview={pickPreview(investorThreads, 'investors')}
        onClick={() => dispatchOpenWindow('investor-cadence')}
      />
    </div>
  )
}
