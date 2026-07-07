/* eslint-disable */
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
      <h1 className="mb-1 text-text-primary text-2xl font-bold">Stealth Deal Scores</h1>
      <p className="mb-4 text-text-secondary text-xs">
        {total} deals scored · Tier, score & seller signals
      </p>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['All', 'Tier 1', 'Tier 2', 'Tier 3'].map(t => (
          <button key={t} onClick={() => { setTierFilter(t); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg border-none cursor-pointer text-xs font-semibold font-[inherit] ${
              tierFilter === t
                ? 'bg-accent/15 text-text-primary'
                : 'bg-surface/15 text-text-secondary'
            }`}
          >{t}</button>
        ))}
      </div>

      {/* Scores Table */}
      <div className="rounded-xl overflow-hidden border border-border">
        {/* Header */}
        <div
          className="bg-surface-raised text-text-muted text-[0.6rem] font-bold uppercase tracking-wide"
          style={{
            display: 'grid', gridTemplateColumns: '2fr 80px 60px 100px 70px 80px 60px',
            padding: '0.6rem 0.75rem',
          }}
        >
          <div>Deal</div><div>Tier</div><div>Score</div><div>Signals</div><div>Carry</div><div>Last</div><div></div>
        </div>

        {scores.length === 0 && (
          <div className="p-8 text-center text-text-muted text-sm">
            {warning || 'No deal scores found'}
          </div>
        )}

        {scores.map(s => (
          <React.Fragment key={s.id}>
            <div
              className={`items-center cursor-pointer border-b border-border/30 ${
                expanded === s.id ? 'bg-accent/[0.04]' : 'bg-surface'
              }`}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 80px 60px 100px 70px 80px 60px',
                padding: '0.6rem 0.75rem',
              }}
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
            >
              <div>
                <div className="text-text-primary text-sm font-semibold">{s.listing_title}</div>
                {s.signals && (
                  <div className="flex gap-0.5 flex-wrap mt-0.5">
                    {s.signals.slice(0, 4).map(sig => (
                      <span key={sig} style={{
                        padding: '0.05rem 0.25rem', borderRadius: 3, fontSize: '0.5rem',
                        background: `${SIGNAL_COLORS[sig] || '#666'}15`, color: SIGNAL_COLORS[sig] || '#888',
                      }}>{sig}</span>
                    ))}
                    {s.signals.length > 4 && <span className="text-[0.5rem] text-text-muted">+{s.signals.length - 4}</span>}
                  </div>
                )}
              </div>
              <div>
                <span className={`px-1.5 py-0.5 rounded text-[0.6rem] font-bold ${
                  s.tier === 'Tier 1'
                    ? 'bg-status-success/15 text-status-success'
                    : 'bg-status-warning/15 text-status-warning'
                }`}>{s.tier || '—'}</span>
              </div>
              <div className="text-text-primary text-base font-bold">{s.score}</div>
              <div className="text-text-primary text-xs">
                {s.signal_count || 0} <span className="text-text-muted">★</span>{s.star_count || 0}
              </div>
              <div>
                {s.seller_carry ? (
                  <span className="text-text-primary text-[0.7rem]">⚡ Yes</span>
                ) : (
                  <span className="text-text-muted/60 text-[0.7rem]">—</span>
                )}
              </div>
              <div className="text-text-secondary text-[0.7rem]">{daysSince(s.last_signal_at)}</div>
              <div>
                <span className="text-text-muted text-[0.7rem]">{expanded === s.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded Insights */}
            {expanded === s.id && (
              <div className="px-4 py-3 bg-surface/15 border-b border-border">
                {s.insights ? (
                  <p className="text-text-primary text-xs leading-relaxed m-0">{s.insights}</p>
                ) : (
                  <p className="text-text-muted text-xs m-0">No AI insights available</p>
                )}
                <div className="flex gap-1 mt-2">
                  <ActionButton label="Ask AI" variant="primary" size="sm" onClick={() => addToast('AI analysis coming soon', 'info')} />
                  <ActionButton label="View Deal" variant="ghost" size="sm" onClick={() => addToast('Opening deal...', 'info')} />
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <span className="text-text-secondary text-xs">{total} deals</span>
        <div className="flex gap-1">
          <ActionButton label="‹" variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} />
          <span className="text-text-primary text-sm px-2 py-1">{page}/{totalPages}</span>
          <ActionButton label="›" variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
        </div>
      </div>
    </div>
  )
}
