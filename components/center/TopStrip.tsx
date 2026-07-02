'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import HealthPill from './HealthPill'
import IdentityPickerSlot from './IdentityPickerSlot'

const REFETCH_MS = 60_000

type CadenceStatus = 'cold' | 'cooling' | 'warm' | 'hot'
interface CadenceItem { status: CadenceStatus }
interface CadencePayload { items: CadenceItem[] }

interface BriefingPayload {
  meetings: { count: number; items: { id: string; title: string; startTime: string; zoomLink: string | null; attendees: string[] }[] }
  threads?: { unread_305: number; unread_718: number; total_unread: number }
  hebrew?: { date: string; holiday?: string; candles?: string; havdalah?: string }
}

/**
 * TopStrip — terminal-style command bar matching the screenshot.
 *
 * Layout: [TERMINAL branding] [Active task] [Counters] [Action pills]
 * [Language] [Time] [Hebrew date] [Setup] [Health] [Identity]
 */
export default function TopStrip() {
  const [now, setNow] = useState(new Date())
  const [lang, setLang] = useState<'EN' | 'HE'>('EN')
  const [noraStatus, setNoraStatus] = useState<'idle' | 'thinking' | 'speaking'>('idle')

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Listen for Nora status events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.status) setNoraStatus(detail.status)
    }
    window.addEventListener('nora:status', handler)
    return () => window.removeEventListener('nora:status', handler)
  }, [])

  const cadence = useQuery<CadencePayload>({
    queryKey: ['investor-cadence', 'cold-count'],
    queryFn: async () => {
      const res = await fetch('/api/investors/cadence', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: false,
  })

  const briefing = useQuery<BriefingPayload>({
    queryKey: ['briefing-today'],
    queryFn: async () => {
      const res = await fetch('/api/briefing/today', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: 2,
  })

  const hebcal = useQuery({
    queryKey: ['hebcal'],
    queryFn: async () => {
      const res = await fetch('/api/hebcal', { cache: 'no-store' })
      if (!res.ok) return null
      return res.json()
    },
    refetchInterval: 300_000, // 5 min
    staleTime: 300_000,
    retry: 1,
  })

  const coldCount = (cadence.data?.items ?? []).filter(i => i.status === 'cold').length
  const meetingCount = briefing.data?.meetings?.count ?? 0
  const unreadMsg = briefing.data?.threads?.total_unread ?? 0

  // Current/next meeting for apex task display
  const meetings = briefing.data?.meetings?.items ?? []
  const currentMeeting = meetings.find(m => {
    const s = new Date(m.startTime)
    return now >= s && now <= new Date(s.getTime() + 60 * 60_000)
  })
  const apexTask = currentMeeting?.title || meetings[0]?.title || ''
  const apexZoom = currentMeeting?.zoomLink || meetings[0]?.zoomLink || null

  // Hebrew date
  const hebrewDate = briefing.data?.hebrew?.date || hebcal.data?.hebrewDate || ''

  function dispatch(target: string) {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('center:open-window', { detail: { target } }))
  }
  function openBriefing() {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event('open-briefing'))
  }

  const pill = (label: string, onClick: () => void, extra?: React.ReactNode) => (
    <button type="button" onClick={onClick} style={{
      background: 'rgba(255,204,51,0.08)', color: '#FFCC33',
      border: '1px solid rgba(255,204,51,0.3)', borderRadius: 999,
      padding: '4px 12px', fontFamily: 'inherit', fontSize: 10,
      fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
      cursor: 'pointer', flexShrink: 0, display: 'inline-flex',
      alignItems: 'center', gap: 6,
    }}>
      {label}{extra}
    </button>
  )

  const counter = (icon: string, count: number, label: string) => (
    <div title={label} style={{
      display: 'flex', alignItems: 'center', gap: 3,
      color: count > 0 ? '#FFCC33' : 'rgba(255,204,51,0.25)',
      fontSize: 10, fontWeight: 600, flexShrink: 0,
    }}>
      <span style={{ fontSize: 11 }}>{icon}</span>
      <span>{count}</span>
    </div>
  )

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 40,
      flexShrink: 0, display: 'flex', alignItems: 'center',
      background: 'rgba(8, 20, 48, 0.98)',
      borderBottom: '1px solid rgba(255,204,51,0.22)',
      fontFamily: 'inherit', padding: '0 12px', gap: 8,
      height: 48, overflowX: 'auto',
    }}>
      {/* Terminal branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginRight: 4 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: 'linear-gradient(135deg, #FFCC33, #F0B400)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800, color: '#0E3470',
        }}>RC</div>
        <div>
          <div style={{ color: '#FFCC33', fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', lineHeight: 1 }}>
            TERMINAL
          </div>
          <div style={{ color: 'rgba(255,204,51,0.3)', fontSize: 7, letterSpacing: '0.08em' }}>by RePrime</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: 'rgba(255,204,51,0.1)', flexShrink: 0 }} />

      {/* Apex task */}
      {apexTask && (
        <div style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6,
          overflow: 'hidden',
        }}>
          <span style={{ fontSize: 10, color: 'rgba(255,204,51,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {apexTask}
          </span>
        </div>
      )}
      {!apexTask && <div style={{ flex: 1 }} />}

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: 'rgba(255,204,51,0.1)', flexShrink: 0 }} />

      {/* Live counters */}
      {counter('💬', unreadMsg, 'Unread messages')}
      {counter('📧', meetingCount, 'Meetings today')}
      {counter('📋', 0, 'Tasks')}

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: 'rgba(255,204,51,0.1)', flexShrink: 0 }} />

      {/* Nora status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
        color: noraStatus === 'idle' ? 'rgba(255,204,51,0.3)' : noraStatus === 'thinking' ? '#A855F7' : '#25D366',
        fontSize: 9, fontWeight: 600,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: noraStatus === 'idle' ? 'rgba(255,204,51,0.2)' : noraStatus === 'thinking' ? '#A855F7' : '#25D366',
        }} />
        Nora: {noraStatus}
      </div>

      {/* Talk to Nora */}
      <button type="button" onClick={() => {
        // Focus the Nora input or open voice
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('center:focus-nora'))
        }
      }} style={{
        background: 'var(--rp-gold, #FFCC33)', color: '#0E3470',
        border: 'none', borderRadius: 999, padding: '4px 10px',
        fontFamily: 'inherit', fontSize: 9, fontWeight: 800,
        cursor: 'pointer', flexShrink: 0, letterSpacing: '0.05em',
      }}>
        Talk to Nora
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: 'rgba(255,204,51,0.1)', flexShrink: 0 }} />

      {/* Action pills */}
      {pill('🔍', () => {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('center:open-search'))
      })}
      {pill('📝', () => {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('center:open-email'))
      })}
      {pill('Briefing', openBriefing)}
      {pill('Secretary', () => dispatch('secretary'))}
      {pill('Cadence', () => dispatch('investor-cadence'), coldCount > 0 ? (
        <span style={{
          background: 'var(--c-fail, #EF4444)', color: '#fff', borderRadius: 999,
          padding: '0px 6px', fontSize: 9, fontWeight: 800, textTransform: 'none',
        }}>{coldCount}</span>
      ) : undefined)}

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: 'rgba(255,204,51,0.1)', flexShrink: 0 }} />

      {/* Language toggle */}
      <button type="button" onClick={() => setLang(l => l === 'EN' ? 'HE' : 'EN')}
        style={{
          background: 'rgba(255,204,51,0.08)', color: '#FFCC33',
          border: '1px solid rgba(255,204,51,0.2)', borderRadius: 4,
          padding: '2px 8px', fontFamily: 'inherit', fontSize: 10,
          fontWeight: 700, cursor: 'pointer', flexShrink: 0,
        }}
      >{lang}</button>

      {/* Live time */}
      <div style={{ color: 'rgba(255,204,51,0.5)', fontSize: 10, fontWeight: 600, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
      </div>

      {/* Hebrew date */}
      {hebrewDate && (
        <div style={{ color: 'rgba(255,204,51,0.25)', fontSize: 9, flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {hebrewDate}
        </div>
      )}

      {/* Setup warning */}
      <button type="button" onClick={() => dispatch('settings')}
        title="Setup required"
        style={{
          background: 'rgba(245,158,11,0.1)', color: '#F59E0B',
          border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4,
          padding: '2px 8px', fontFamily: 'inherit', fontSize: 9,
          fontWeight: 700, cursor: 'pointer', flexShrink: 0,
        }}
      >⚠ setup</button>

      {/* Settings gear */}
      <button type="button" onClick={() => dispatch('settings')}
        title="Settings" aria-label="Settings"
        style={{
          background: 'rgba(255,204,51,0.08)', color: '#FFCC33',
          border: '1px solid rgba(255,204,51,0.2)', borderRadius: 999,
          width: 28, height: 28, display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', fontFamily: 'inherit', fontSize: 14,
          cursor: 'pointer', flexShrink: 0,
        }}
      >⚙</button>

      {/* Health + Identity */}
      <HealthPill />
      <IdentityPickerSlot />

      {/* Join Now (if active meeting has zoom) */}
      {apexZoom && (
        <a href={apexZoom} target="_blank" rel="noopener noreferrer" style={{
          background: 'var(--rp-gold, #FFCC33)', color: '#0E3470',
          borderRadius: 999, padding: '4px 10px', fontSize: 9,
          fontWeight: 800, textDecoration: 'none', flexShrink: 0,
          letterSpacing: '0.05em',
        }}>
          Join Now
        </a>
      )}
    </div>
  )
}
