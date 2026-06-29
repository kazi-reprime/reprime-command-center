'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { GOLD, NAVY } from '@/lib/design-tokens'
import InvestorProfileBody from './InvestorProfileBody'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InvestorTask {
  id: string
  status: 'open' | 'done'
  title: string
  meta: string
  daysLate?: number
}

export interface InvestorEvent {
  id: string
  icon: string
  time: string
  title: string
  body: string
}

export interface InvestorRecommendation {
  headline: string
  detail: string
  actions: { label: string; variant: 'primary' | 'secondary' | 'tertiary' }[]
}

export interface InvestorProfileData {
  id: string
  /** Pipedrive Person id — used as the foreign key when scheduling reminders, etc. */
  pipedriveContactId: number | null
  name: string
  phone: string
  email: string | null
  company: string | null
  lastContactAt: string | null
  lastContactChannel: string | null
  lastContactMessage: string | null
  taggedDaysAgo: number | null
  /** Tier letter parsed from Pipedrive TAG (`investor-A-principal` → A). */
  tier: 'A' | 'B' | 'C' | 'D' | null
  /** Role parsed from Pipedrive TAG. */
  role: 'principal' | 'connector' | null
  /** Pipedrive deals associated with this contact (open status). */
  activeDealsCount: number
  /** Human-readable last meeting time, e.g. "5d ago" or null. */
  lastMeetingAgo: string | null
  summary: string | null
  recommendation: InvestorRecommendation | null
  tasks: InvestorTask[]
  notes: string
  timeline: InvestorEvent[]
  tabCounts: {
    timeline: number
    emails: number
    whatsapp: number
    calls: number
    meetings: number
    tasks: number
  }
}

// ── Mock data ─────────────────────────────────────────────────────────────────

export const MOCK_INVESTORS: InvestorProfileData[] = [
  {
    id: 'mock-david-cohen',
    pipedriveContactId: null,
    name: 'David Cohen',
    phone: '+1 (305) 555-0192',
    email: 'david@cohencap.com',
    company: 'Cohen Capital',
    lastContactAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    lastContactChannel: '2h ago · WhatsApp 305 (inbound)',
    lastContactMessage: '"Sounds good, see you Tuesday at 9"',
    taggedDaysAgo: 14,
    tier: 'A',
    role: 'principal',
    activeDealsCount: 2,
    lastMeetingAgo: '5d ago',
    summary:
      'David runs Cohen Capital. He has $40 million to invest in Florida real estate.\n\n' +
      'He likes two of your deals right now:\n' +
      '• Harvard Plaza — this is the main one. Steve still owes him a price list.\n' +
      '• 500 Bailey — early interest, no commitment yet.\n\n' +
      'He prefers WhatsApp on the 305 line. He always wants to be paid every 3 months — that is a hard rule for him.\n\n' +
      'Your next call with him is Tuesday at 9 AM Central.',
    recommendation: {
      headline: "Wait for Steve's price list. Then text David.",
      detail:
        "David asked Steve for prices on Harvard Plaza. Steve has not sent them yet — it's been 3 days.\n\n" +
        'Step 1: Remind Steve today.\n' +
        'Step 2: When Steve sends the prices, text David on WhatsApp 305 with the file.',
      actions: [
        { label: 'Remind Steve now', variant: 'primary' },
        { label: 'Draft WhatsApp to David', variant: 'secondary' },
        { label: 'Wait — no action', variant: 'tertiary' },
      ],
    },
    tasks: [
      {
        id: 'task-1',
        status: 'open',
        title: 'Pull comps for Harvard Plaza',
        meta: '→ Steve · WhatsApp · sent Mon 9:14 AM',
        daysLate: 3,
      },
    ],
    notes:
      "Met at Mendy's Hanukkah party 2025. Comes from textile money, second generation. Wife runs a non-profit. Loves Florida deals — does not touch anything north of Atlanta. Prefers I send him short voice notes, not long emails.",
    timeline: [
      {
        id: 'ev-1',
        icon: '💬',
        time: 'Today · 2h ago · WhatsApp 305',
        title: '"Sounds good, see you Tuesday at 9"',
        body: 'Reply to your slot confirmation. No action needed — the meeting is locked in.',
      },
      {
        id: 'ev-2',
        icon: '✉',
        time: 'Yesterday · 4:12 PM · Email',
        title: 'Re: Harvard Plaza — first look',
        body: "David's reply: he likes the building but wants Steve to pull a price list of similar buildings sold in 2024–2026 before he commits.",
      },
      {
        id: 'ev-3',
        icon: '📞',
        time: '2 days ago · Zoom · 43 min',
        title: 'First call — Terminal introduction',
        body: 'Two deals discussed: Harvard Plaza and 500 Bailey. David asked Steve for a price list. Recording + full transcript saved.',
      },
      {
        id: 'ev-4',
        icon: '✉',
        time: '1 week ago · Terminal invitation sent',
        title: 'Terminal Introduction — David Cohen',
        body: 'Slot confirmed: Tuesday May 5, 9:00 AM Central · 30 min · Zoom',
      },
      {
        id: 'ev-5',
        icon: '💬',
        time: '2 weeks ago · WhatsApp 305',
        title: 'First contact',
        body: 'Introduced via Mendy Tuitou. Brief intro about Cohen Capital — $40 million to invest in Florida real estate.',
      },
    ],
    tabCounts: { timeline: 38, emails: 12, whatsapp: 22, calls: 3, meetings: 2, tasks: 1 },
  },
  {
    id: 'mock-mendy-tuitou',
    pipedriveContactId: null,
    name: 'Mendy Tuitou',
    phone: '+1 (305) 555-0137',
    email: 'mendy@tuitougroup.com',
    company: 'Tuitou Group',
    lastContactAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    lastContactChannel: '3h ago · WhatsApp 305 (inbound)',
    lastContactMessage: '"Got the term sheet, will review tonight"',
    taggedDaysAgo: 30,
    tier: 'B',
    role: 'principal',
    activeDealsCount: 1,
    lastMeetingAgo: 'No meetings yet',
    summary:
      'Mendy is your main connector in the Sephardic community. He has introduced you to at least 4 investors including David Cohen.\n\n' +
      'He is interested in 500 Bailey at $2.5M. He reviewed the term sheet today.\n\n' +
      'He responds fast on WhatsApp 305. Very relationship-driven — he prefers short, personal messages over formal docs.',
    recommendation: {
      headline: 'Follow up on 500 Bailey term sheet tomorrow morning.',
      detail:
        "Mendy said he'd review it tonight. Send a short WhatsApp tomorrow morning asking what he thinks. Keep it casual — one line, no pressure.",
      actions: [
        { label: 'Draft WhatsApp to Mendy', variant: 'primary' },
        { label: 'Wait — no action', variant: 'tertiary' },
      ],
    },
    tasks: [],
    notes: '',
    timeline: [
      {
        id: 'ev-1',
        icon: '💬',
        time: 'Today · 3h ago · WhatsApp 305',
        title: '"Got the term sheet, will review tonight"',
        body: 'He received the 500 Bailey term sheet you sent. Reviewing it tonight.',
      },
      {
        id: 'ev-2',
        icon: '📋',
        time: 'Today · 4h ago',
        title: '500 Bailey term sheet sent',
        body: 'PDF sent via WhatsApp 305.',
      },
      {
        id: 'ev-3',
        icon: '💬',
        time: '3 days ago · WhatsApp 305',
        title: 'Introduction — David Cohen',
        body: 'Mendy introduced you to David Cohen. "He has money to put in Florida, call him."',
      },
    ],
    tabCounts: { timeline: 18, emails: 3, whatsapp: 14, calls: 1, meetings: 0, tasks: 0 },
  },
  {
    id: 'mock-levi-biton',
    pipedriveContactId: null,
    name: 'Levi Izhak Biton',
    phone: '+1 (718) 555-0281',
    email: null,
    company: null,
    lastContactAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    lastContactChannel: '5 days ago · WhatsApp 718 (outbound)',
    lastContactMessage: '"Let\'s talk Q3 — I have a window opening up"',
    taggedDaysAgo: 45,
    tier: 'D',
    role: 'principal',
    activeDealsCount: 0,
    lastMeetingAgo: 'No meetings yet',
    summary:
      'Levi is a private investor from Brooklyn. He said he will have capital available in Q3 2026.\n\n' +
      'No specific deal has been pitched yet. He expressed general interest in commercial Florida real estate.\n\n' +
      'He uses WhatsApp on the 718 line only. Response time is typically 1–2 days.',
    recommendation: {
      headline: 'Ping him in 3 weeks when Q3 starts.',
      detail:
        "He said his window opens in Q3. It is now early May — reach out in late June or early July with a deal that fits his profile.",
      actions: [
        { label: 'Schedule reminder', variant: 'primary' },
        { label: 'Wait — no action', variant: 'tertiary' },
      ],
    },
    tasks: [],
    notes: '',
    timeline: [
      {
        id: 'ev-1',
        icon: '💬',
        time: '5 days ago · WhatsApp 718',
        title: '"Let\'s talk Q3"',
        body: 'He replied to your follow-up. Expressed interest for Q3.',
      },
      {
        id: 'ev-2',
        icon: '💬',
        time: '3 weeks ago · WhatsApp 718',
        title: 'Initial contact',
        body: 'Met at a Brooklyn event. Added as investor contact.',
      },
    ],
    tabCounts: { timeline: 7, emails: 0, whatsapp: 6, calls: 0, meetings: 0, tasks: 0 },
  },
]

export function mockProfileForName(name: string | null): InvestorProfileData {
  if (name) {
    const lower = name.toLowerCase()
    const match = MOCK_INVESTORS.find((m) => m.name.toLowerCase() === lower)
    if (match) return match
  }
  return MOCK_INVESTORS[0]
}

/**
 * Build a profile from a real DashboardThread row (e.g. a stub investor with
 * just a Pipedrive id, name, and tier). Falls back to a matching mock if the
 * name happens to match (for David / Mendy / Levi narratives), otherwise
 * returns a minimal real-data record so the panel can render.
 */
export function profileFromThread(thread: {
  contact_name: string | null
  phone: string
  pipedrive_contact_id: number | null
  investor_tier: 'A' | 'B' | 'C' | 'D' | null
  investor_role: 'principal' | 'connector' | null
}): InvestorProfileData {
  // If we have a matching mock by name, prefer its rich content but graft real ids/tier.
  const mock = thread.contact_name
    ? MOCK_INVESTORS.find((m) => m.name.toLowerCase() === thread.contact_name!.toLowerCase())
    : null
  if (mock) {
    return {
      ...mock,
      pipedriveContactId: thread.pipedrive_contact_id ?? mock.pipedriveContactId,
      tier: thread.investor_tier ?? mock.tier,
      role: thread.investor_role ?? mock.role,
    }
  }
  // Real stub — minimal record with no AI summary or recommendation yet.
  return {
    id: `pipedrive:${thread.pipedrive_contact_id ?? 'unknown'}`,
    pipedriveContactId: thread.pipedrive_contact_id,
    name: thread.contact_name || thread.phone || 'Unknown',
    phone: thread.phone,
    email: null,
    company: null,
    lastContactAt: null,
    lastContactChannel: null,
    lastContactMessage: null,
    taggedDaysAgo: null,
    tier: thread.investor_tier,
    role: thread.investor_role,
    activeDealsCount: 0,
    lastMeetingAgo: null,
    summary: null,
    recommendation: null,
    tasks: [],
    notes: '',
    timeline: [],
    tabCounts: { timeline: 0, emails: 0, whatsapp: 0, calls: 0, meetings: 0, tasks: 0 },
  }
}

// ── Slide-in wrapper ──────────────────────────────────────────────────────────

interface Props {
  data: InvestorProfileData
  onClose: () => void
}

/**
 * InvestorProfile — slide-in wrapper around InvestorProfileBody.
 *
 * Keeps the original 70%-width fixed-position panel + backdrop + Esc-to-close
 * behavior used on `/`. The actual content has been extracted into
 * InvestorProfileBody so the WindowManager on `/center` can render the same
 * panel inside a floating window.
 *
 * On `/center` the slide-in offers an "↗ Open as window" button that
 * dispatches `center:open-window` and closes itself, escalating to a real
 * floating window. On `/` the button is still rendered (the dispatch is a
 * no-op without a WindowManager listening) — keeping behavior consistent.
 */
export default function InvestorProfile({ data, onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const onOpenAsWindow = () => {
    if (typeof window === 'undefined') return
    const id =
      data.pipedriveContactId != null
        ? `investor-${data.pipedriveContactId}`
        : `investor-${data.id}`
    window.dispatchEvent(
      new CustomEvent('center:open-window', {
        detail: {
          target: 'investor-profile',
          opts: {
            id,
            title: data.name,
            componentProps: {
              pipedriveContactId: data.pipedriveContactId,
              name: data.name,
              fallbackData: data,
            },
          },
        },
      }),
    )
    onClose()
  }

  const panel = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 200,
        }}
      />

      {/* Slide-in container */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '70%',
          background: NAVY,
          borderLeft: `2px solid ${GOLD}`,
          boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
          zIndex: 201,
        }}
      >
        <InvestorProfileBody
          data={data}
          onClose={onClose}
          onOpenAsWindow={onOpenAsWindow}
        />
      </div>
    </>
  )

  if (typeof document === 'undefined') return null
  return createPortal(panel, document.body)
}
