'use client'

import { useEffect, useState } from 'react'
import {
  profileFromThread,
  mockProfileForName,
  type InvestorProfileData,
} from '@/components/panels/InvestorProfile'
import InvestorProfileBody from '@/components/panels/InvestorProfileBody'
import { GOLD, NAVY, gold } from '@/lib/design-tokens'

type Props = {
  /** Pipedrive Person id — the foreign key the window resolves against. */
  pipedriveContactId?: number
  /** Display name shown while data loads + as the title fallback. */
  name?: string
  /**
   * Pre-built profile data, e.g. when the slide-in escalates to a window
   * it forwards the data it already has so the window renders instantly
   * without a re-fetch round-trip.
   */
  fallbackData?: InvestorProfileData
}

type ThreadRow = {
  id: string
  contact_name: string | null
  phone: string
  pipedrive_contact_id: number | null
  investor_tier: 'A' | 'B' | 'C' | 'D' | null
  investor_role: 'principal' | 'connector' | null
}

/**
 * InvestorProfileWindow — WindowManager renderer for the
 * `investor-profile` component-window key.
 *
 * Fetches the investor list from /api/whatsapp/investor-chat-threads,
 * picks the thread matching `pipedriveContactId`, and renders the same
 * InvestorProfileBody the slide-in uses.
 *
 * Mode of operation:
 *   - If `fallbackData` is provided (slide-in escalating into a window)
 *     render immediately using it; refresh in the background once the
 *     thread fetch returns.
 *   - Else mount in a loading state, then resolve the thread.
 *   - If no matching thread is found, fall back to mock-by-name so the
 *     window still renders something useful.
 */
export default function InvestorProfileWindow({
  pipedriveContactId,
  name,
  fallbackData,
}: Props) {
  const [data, setData] = useState<InvestorProfileData | null>(
    fallbackData ?? null,
  )
  const [loading, setLoading] = useState(!fallbackData)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await fetch('/api/whatsapp/investor-chat-threads', {
          credentials: 'include',
        })
        if (!r.ok) {
          throw new Error(`Server returned ${r.status}`)
        }
        const j = (await r.json()) as { threads?: ThreadRow[] }
        if (cancelled) return

        const threads = j.threads ?? []
        let match: ThreadRow | undefined
        if (pipedriveContactId != null) {
          match = threads.find((t) => t.pipedrive_contact_id === pipedriveContactId)
        }
        if (!match && name) {
          const lower = name.toLowerCase()
          match = threads.find(
            (t) => (t.contact_name ?? '').toLowerCase() === lower,
          )
        }

        if (match) {
          setData(
            profileFromThread({
              contact_name: match.contact_name,
              phone: match.phone,
              pipedrive_contact_id: match.pipedrive_contact_id,
              investor_tier: match.investor_tier,
              investor_role: match.investor_role,
            }),
          )
        } else if (!fallbackData) {
          // No real thread, no fallback — render mock-by-name so the
          // window is never blank.
          setData(mockProfileForName(name ?? null))
        }
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setError((err as Error).message)
        setLoading(false)
        if (!data && !fallbackData) {
          // Last-ditch: mock so the window has content.
          setData(mockProfileForName(name ?? null))
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipedriveContactId, name])

  if (loading && !data) {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          background: NAVY,
          color: GOLD,
          fontFamily: 'var(--rp-font-body)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 10,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.30em',
            color: gold[55],
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          Loading investor profile
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {name ?? 'Investor'}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          background: NAVY,
          color: GOLD,
          fontFamily: 'var(--rp-font-body)',
          padding: 24,
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
          No investor data
        </div>
        <div style={{ color: gold[55], fontSize: 12 }}>
          {error ?? 'Could not resolve a profile for this contact.'}
        </div>
      </div>
    )
  }

  // Window mode: no onClose (the Window chrome handles close), no
  // ↗ Open-as-window (you're already in a window).
  return <InvestorProfileBody data={data} />
}
