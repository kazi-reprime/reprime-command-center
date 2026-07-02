'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, ActionButton } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useToast } from '@/lib/contexts/ToastContext'

interface DealScore {
  id: string; listing_title: string; tier?: string; score: number;
  signal_count?: number; star_count?: number; seller_carry?: boolean;
  signals?: string[]; last_signal_at?: string; insights?: string;
  campaign_name?: string; loi_sent?: boolean;
}

const SIGNAL_COLORS: Record<string, string> = {
  'Broker Intel': '#3B82F6', 'Context': '#A855F7', 'Debt': '#F59E0B', 'Motivation': '#00A980',
  'Pricing': '#FFCC33', 'Diligence': '#06B6D4', 'Competition': '#EF4444', 'Operations': '#EC4899',
  'Timeline': '#8B5CF6', 'Deal History': '#F97316', 'Structure': '#14B8A6', 'Alternatives': '#6366F1',
  'Deal-Breakers': '#DC2626', 'Market Intel': '#059669', 'Commitment': '#7C3AED',
}

export default function ScoresPage() {
  const { addToast } = useToast()
  const [scores, setScores] = useState<DealScore[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('loading')
  const [warning, setWarning] = useState<string | undefined>()
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [tierFilter, setTierFilter] = useState('All')
  const [expanded, setExpanded] = useState<string | null>(null)
  const limit = 20

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (tierFilter !== 'All') params.set('tier', tierFilter)
      const res = await fetch(`/api/cockpit/scores?${params}`)
      const data = await res.json()
      setScores(data.data || [])
      setSource(data.source || 'fallback')
      setWarning(data.warning)
      setTotal(data.total || 0)
    } catch { addToast('Failed to load scores', 'error') }
    finally { setLoading(false) }
  }, [page, tierFilter, addToast])

  useEffect(() => { fetchData() }, [fetchData])

  const totalPages = Math.ceil(total / limit) || 1

  const daysSince = (d?: string) => {
    if (!d) return '—'
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
    if (diff === 0) return 'Today'
    if (diff < 7) return `${diff}d ago`
    return `${Math.floor(diff / 7)}w ago`
  }

  if (loading) return <LoadingState message="Loading deal scores..." />

  return (
    <div>
      <DataSourceBanner source={source} warning={warning} />
      <h1 style={{ margin: '0 0 0.25rem', color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Stealth Deal Scores</h1>
      <p style={{ margin: '0 0 1rem', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
        {total} deals scored · Tier, score & seller signals
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {['All', 'Tier 1', 'Tier 2', 'Tier 3'].map(t => (
          <button key={t} onClick={() => { setTierFilter(t); setPage(1) }}
            style={{
              padding: '0.4rem 0.8rem', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tierFilter === t ? 'rgba(255,204,51,0.15)' : 'rgba(0,0,0,0.15)',
              color: tierFilter === t ? '#FFCC33' : 'rgba(255,204,51,0.5)',
              fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit',
            }}
          >{t}</button>
        ))}
      </div>

      {/* Scores Table */}
      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,204,51,0.06)' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 80px 60px 100px 70px 80px 60px',
          padding: '0.6rem 0.75rem', background: 'rgba(14,52,112,0.5)',
          fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,204,51,0.35)', textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          <div>Deal</div><div>Tier</div><div>Score</div><div>Signals</div><div>Carry</div><div>Last</div><div></div>
        </div>

        {scores.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,204,51,0.3)', fontSize: '0.8rem' }}>
            {warning || 'No deal scores found'}
          </div>
        )}

        {scores.map(s => (
          <React.Fragment key={s.id}>
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 80px 60px 100px 70px 80px 60px',
              padding: '0.6rem 0.75rem', alignItems: 'center',
              background: expanded === s.id ? 'rgba(255,204,51,0.04)' : 'rgba(14,52,112,0.25)',
              borderBottom: '1px solid rgba(255,204,51,0.03)', cursor: 'pointer',
            }} onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
              <div>
                <div style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 600 }}>{s.listing_title}</div>
                {s.signals && (
                  <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap', marginTop: 2 }}>
                    {s.signals.slice(0, 4).map(sig => (
                      <span key={sig} style={{
                        padding: '0.05rem 0.25rem', borderRadius: 3, fontSize: '0.5rem',
                        background: `${SIGNAL_COLORS[sig] || '#666'}15`, color: SIGNAL_COLORS[sig] || '#888',
                      }}>{sig}</span>
                    ))}
                    {s.signals.length > 4 && <span style={{ fontSize: '0.5rem', color: 'rgba(255,204,51,0.3)' }}>+{s.signals.length - 4}</span>}
                  </div>
                )}
              </div>
              <div>
                <span style={{
                  padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.6rem', fontWeight: 700,
                  background: s.tier === 'Tier 1' ? 'rgba(0,169,128,0.15)' : 'rgba(245,158,11,0.15)',
                  color: s.tier === 'Tier 1' ? '#00A980' : '#F59E0B',
                }}>{s.tier || '—'}</span>
              </div>
              <div style={{ color: '#FFCC33', fontSize: '0.9rem', fontWeight: 700 }}>{s.score}</div>
              <div style={{ color: '#e2e8f0', fontSize: '0.75rem' }}>
                {s.signal_count || 0} <span style={{ color: 'rgba(255,204,51,0.3)' }}>★</span>{s.star_count || 0}
              </div>
              <div>
                {s.seller_carry ? (
                  <span style={{ color: '#FFCC33', fontSize: '0.7rem' }}>⚡ Yes</span>
                ) : (
                  <span style={{ color: 'rgba(255,204,51,0.2)', fontSize: '0.7rem' }}>—</span>
                )}
              </div>
              <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.7rem' }}>{daysSince(s.last_signal_at)}</div>
              <div>
                <span style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.7rem' }}>{expanded === s.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded Insights */}
            {expanded === s.id && (
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,204,51,0.06)' }}>
                {s.insights ? (
                  <p style={{ color: '#e2e8f0', fontSize: '0.75rem', lineHeight: 1.5, margin: 0 }}>{s.insights}</p>
                ) : (
                  <p style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.75rem', margin: 0 }}>No AI insights available</p>
                )}
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.5rem' }}>
                  <ActionButton label="Ask AI" variant="primary" size="sm" onClick={() => addToast('AI analysis coming soon', 'info')} />
                  <ActionButton label="View Deal" variant="ghost" size="sm" onClick={() => addToast('Opening deal...', 'info')} />
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
        <span style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.75rem' }}>{total} deals</span>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <ActionButton label="‹" variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} />
          <span style={{ color: '#FFCC33', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>{page}/{totalPages}</span>
          <ActionButton label="›" variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
        </div>
      </div>
    </div>
  )
}
