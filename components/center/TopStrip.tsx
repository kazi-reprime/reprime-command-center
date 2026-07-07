'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from '@/lib/store/useStore'
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

/** Format time for a timezone */
function tzTime(tz: string, now: Date, format: 'short' | 'full' = 'short') {
  try {
    if (format === 'full') {
      return now.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
    }
    return now.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true })
  } catch { return '' }
}

/**
 * TopStrip — premium command bar with dual timezone, Nora status, and live counters.
 *
 * Reads Nora status from the shared Zustand store for instant synchronization
 * with both /center and /cockpit experiences.
 */
export default function TopStrip() {
  const [now, setNow] = useState(new Date())

  // Shared state from Zustand store
  const noraStatus = useStore(s => s.noraStatus)
  const language = useStore(s => s.language)
  const setLanguage = useStore(s => s.setLanguage)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Bridge legacy CustomEvent listeners (for components not yet on Zustand)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.status) {
        useStore.getState().setNoraStatus(detail.status)
      }
    }
    window.addEventListener('nora:status', handler)
    window.addEventListener('nora-state-change', handler)
    return () => {
      window.removeEventListener('nora:status', handler)
      window.removeEventListener('nora-state-change', handler)
    }
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
    refetchInterval: 300_000,
    staleTime: 300_000,
    retry: 1,
  })

  const coldCount = (cadence.data?.items ?? []).filter(i => i.status === 'cold').length
  const meetingCount = briefing.data?.meetings?.count ?? 0
  const unreadMsg = briefing.data?.threads?.total_unread ?? 0
  const meetings = briefing.data?.meetings?.items ?? []
  const currentMeeting = meetings.find(m => {
    const s = new Date(m.startTime)
    return now >= s && now <= new Date(s.getTime() + 60 * 60_000)
  })
  const apexTask = currentMeeting?.title || meetings[0]?.title || ''
  const apexZoom = currentMeeting?.zoomLink || meetings[0]?.zoomLink || null
  const hebrewDate = briefing.data?.hebrew?.date || hebcal.data?.hebrewDate || ''

  function dispatch(target: string) {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('center:open-window', { detail: { target } }))
  }
  function openBriefing() {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event('open-briefing'))
  }

  const noraColors: Record<string, { dot: string; glow: string; label: string }> = {
    idle: { dot: 'rgba(255,204,51,0.3)', glow: 'transparent', label: 'Ready' },
    listening: { dot: '#FFCC33', glow: 'rgba(255,204,51,0.5)', label: 'Listening...' },
    thinking: { dot: '#A855F7', glow: 'rgba(168,85,247,0.5)', label: 'Thinking...' },
    speaking: { dot: '#25D366', glow: 'rgba(37,211,102,0.5)', label: 'Speaking...' },
  }
  const ns = noraColors[noraStatus] || noraColors.idle

  return (
    <>
      <style>{`
        @keyframes nora-header-pulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--nora-glow); }
          50% { box-shadow: 0 0 12px 4px var(--nora-glow); }
        }
        .top-strip-scroll::-webkit-scrollbar { display: none; }
        .top-strip-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg, rgba(8,20,48,0.99) 0%, rgba(10,26,60,0.97) 100%)',
        borderBottom: '2px solid rgba(255,204,51,0.25)',
        fontFamily: 'inherit',
      }}>
        {/* ── ROW 1: Main Header ────────────────────────────────────────── */}
        <div className="top-strip-scroll" style={{
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, height: 56,
          overflowX: 'auto',
        }}>
          {/* Terminal Branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #FFCC33, #F0B400)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 900, color: '#0E3470',
              boxShadow: '0 2px 12px rgba(255,204,51,0.3)',
            }}>RC</div>
            <div>
              <div style={{ color: '#FFCC33', fontSize: 12, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', lineHeight: 1.2 }}>
                TERMINAL
              </div>
              <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: 8, letterSpacing: '0.08em' }}>by RePrime Group</div>
            </div>
          </div>

          <div style={{ width: 1, height: 32, background: 'rgba(255,204,51,0.12)', flexShrink: 0 }} />

          {/* Apex Task */}
          {apexTask ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', minWidth: 120 }}>
              <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontWeight: 800, letterSpacing: '0.1em', flexShrink: 0 }}>LIVE</span>
              <span style={{ fontSize: 12, color: 'rgba(255,204,51,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                {apexTask}
              </span>
            </div>
          ) : <div style={{ flex: 1, minWidth: 40 }} />}

          <div style={{ width: 1, height: 32, background: 'rgba(255,204,51,0.12)', flexShrink: 0 }} />

          {/* Live Counters */}
          <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
            <div title="Unread messages" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 14 }}>💬</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: unreadMsg > 0 ? '#FFCC33' : 'rgba(255,204,51,0.25)' }}>{unreadMsg}</span>
            </div>
            <div title="Meetings today" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 14 }}>📧</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: meetingCount > 0 ? '#FFCC33' : 'rgba(255,204,51,0.25)' }}>{meetingCount}</span>
            </div>
          </div>

          <div style={{ width: 1, height: 32, background: 'rgba(255,204,51,0.12)', flexShrink: 0 }} />

          {/* Nora Status — Bigger & Prominent */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
              padding: '6px 14px', borderRadius: 99,
              background: noraStatus !== 'idle' ? `${ns.dot}15` : 'rgba(255,204,51,0.05)',
              border: `1px solid ${noraStatus !== 'idle' ? `${ns.dot}40` : 'rgba(255,204,51,0.1)'}`,
              '--nora-glow': ns.glow,
              animation: noraStatus !== 'idle' ? 'nora-header-pulse 2s ease-in-out infinite' : 'none',
            } as React.CSSProperties}
          >
            <div style={{
              width: 10, height: 10, borderRadius: '50%', background: ns.dot,
              boxShadow: noraStatus !== 'idle' ? `0 0 8px ${ns.glow}` : 'none',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: noraStatus !== 'idle' ? ns.dot : 'rgba(255,204,51,0.4)' }}>
              Nora: {ns.label}
            </span>
          </div>

          {/* Talk to Nora */}
          <button type="button" onClick={() => {
            if (typeof window !== 'undefined') window.dispatchEvent(new Event('center:focus-nora'))
          }} style={{
            background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
            color: '#fff', border: 'none', borderRadius: 99,
            padding: '8px 16px', fontFamily: 'inherit', fontSize: 11,
            fontWeight: 800, cursor: 'pointer', flexShrink: 0,
            letterSpacing: '0.05em', boxShadow: '0 2px 12px rgba(168,85,247,0.3)',
          }}>
            🎙 Talk to Nora
          </button>

          <div style={{ width: 1, height: 32, background: 'rgba(255,204,51,0.12)', flexShrink: 0 }} />

          {/* Action Pills */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {[
              { label: '🔍', action: () => window.dispatchEvent(new CustomEvent('center:open-search')) },
              { label: '📝', action: () => window.dispatchEvent(new CustomEvent('center:open-email')) },
              { label: 'Briefing', action: openBriefing },
              { label: 'Secretary', action: () => dispatch('secretary') },
            ].map((p, i) => (
              <button key={i} type="button" onClick={p.action} style={{
                background: 'rgba(255,204,51,0.06)', color: '#FFCC33',
                border: '1px solid rgba(255,204,51,0.2)', borderRadius: 99,
                padding: '5px 12px', fontFamily: 'inherit', fontSize: 10,
                fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: 'pointer', flexShrink: 0,
              }}>{p.label}</button>
            ))}
            {coldCount > 0 && (
              <button type="button" onClick={() => dispatch('investor-cadence')} style={{
                background: 'rgba(255,204,51,0.06)', color: '#FFCC33',
                border: '1px solid rgba(255,204,51,0.2)', borderRadius: 99,
                padding: '5px 12px', fontFamily: 'inherit', fontSize: 10,
                fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                Cadence
                <span style={{ background: '#EF4444', color: '#fff', borderRadius: 99, padding: '0 6px', fontSize: 9, fontWeight: 800 }}>{coldCount}</span>
              </button>
            )}
          </div>

          <div style={{ width: 1, height: 32, background: 'rgba(255,204,51,0.12)', flexShrink: 0 }} />

          {/* Language + Settings */}
          <button type="button" onClick={() => setLanguage(language === 'EN' ? 'HE' : 'EN')} style={{
            background: 'rgba(255,204,51,0.08)', color: '#FFCC33',
            border: '1px solid rgba(255,204,51,0.2)', borderRadius: 6,
            padding: '4px 10px', fontFamily: 'inherit', fontSize: 11,
            fontWeight: 700, cursor: 'pointer', flexShrink: 0,
          }}>{language === 'EN' ? 'EN → עב' : 'עב → EN'}</button>

          <button type="button" onClick={() => dispatch('settings')} title="Settings" style={{
            background: 'rgba(255,204,51,0.08)', color: '#FFCC33',
            border: '1px solid rgba(255,204,51,0.2)', borderRadius: 99,
            width: 32, height: 32, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 16, cursor: 'pointer', flexShrink: 0,
          }}>⚙</button>

          <HealthPill />
          <IdentityPickerSlot />

          {apexZoom && (
            <a href={apexZoom} target="_blank" rel="noopener noreferrer" style={{
              background: 'linear-gradient(135deg, #FFCC33, #F0B400)', color: '#0E3470',
              borderRadius: 99, padding: '6px 14px', fontSize: 10,
              fontWeight: 900, textDecoration: 'none', flexShrink: 0,
              letterSpacing: '0.05em', boxShadow: '0 2px 8px rgba(255,204,51,0.3)',
            }}>
              🎥 Join Now
            </a>
          )}
        </div>

        {/* ── ROW 2: Time Strip ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 20, padding: '4px 16px', height: 28,
          background: 'rgba(0,0,0,0.15)',
          borderTop: '1px solid rgba(255,204,51,0.08)',
        }}>
          {/* Miami */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11 }}>🌴</span>
            <span style={{ fontSize: 10, color: 'rgba(255,204,51,0.4)', fontWeight: 600 }}>Miami</span>
            <span style={{ fontSize: 11, color: '#FFCC33', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {tzTime('America/New_York', now)}
            </span>
          </div>

          <div style={{ width: 1, height: 16, background: 'rgba(255,204,51,0.1)' }} />

          {/* Israel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11 }}>🇮🇱</span>
            <span style={{ fontSize: 10, color: 'rgba(255,204,51,0.4)', fontWeight: 600 }}>Israel</span>
            <span style={{ fontSize: 11, color: '#FFCC33', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {tzTime('Asia/Jerusalem', now)}
            </span>
          </div>

          <div style={{ width: 1, height: 16, background: 'rgba(255,204,51,0.1)' }} />

          {/* Local Full Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11 }}>🕐</span>
            <span style={{ fontSize: 10, color: 'rgba(255,204,51,0.4)', fontWeight: 600 }}>Local</span>
            <span style={{ fontSize: 11, color: '#FFCC33', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {tzTime(Intl.DateTimeFormat().resolvedOptions().timeZone, now, 'full')}
            </span>
          </div>

          <div style={{ width: 1, height: 16, background: 'rgba(255,204,51,0.1)' }} />

          {/* Date */}
          <span style={{ fontSize: 10, color: 'rgba(255,204,51,0.5)', fontWeight: 600 }}>
            {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>

          {/* Hebrew Date */}
          {hebrewDate && (
            <>
              <div style={{ width: 1, height: 16, background: 'rgba(255,204,51,0.1)' }} />
              <span style={{ fontSize: 10, color: 'rgba(255,204,51,0.4)', fontWeight: 600 }}>
                📜 {hebrewDate}
              </span>
            </>
          )}
        </div>
      </div>
    </>
  )
}
