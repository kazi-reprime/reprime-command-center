'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, ActionButton } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useToast } from '@/lib/contexts/ToastContext'

interface Deal {
  id: string; name: string; address?: string; assetType?: string;
  purchasePrice?: number; status?: string; priority?: number;
  createdAt?: string; stage_change_time?: string; stage?: string;
  pipedrive_url?: string; value?: number;
}

const STAGES = [
  { key: 'outreach', label: 'Outreach Initiated', color: '#3B82F6' },
  { key: 'broker_engagement', label: 'Broker Engagement', color: '#A855F7' },
  { key: 'loi', label: 'LOI & Negotiation', color: '#FFCC33' },
  { key: 'psa_dd', label: 'PSA & DD Materials', color: '#F59E0B' },
  { key: 'due_diligence', label: 'Due Diligence', color: '#00A980' },
]

function mapDealToStage(d: Deal): string {
  const s = (d.status || d.stage || '').toLowerCase()
  if (s.includes('diligence')) return 'due_diligence'
  if (s.includes('psa') || s.includes('dd')) return 'psa_dd'
  if (s.includes('loi') || s.includes('negotiat') || s.includes('contract')) return 'loi'
  if (s.includes('broker') || s.includes('engag')) return 'broker_engagement'
  return 'outreach'
}

export default function PipelinePage() {
  const { addToast } = useToast()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('loading')

  const fetchDeals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/deals')
      const data = await res.json()
      if (Array.isArray(data)) {
        setDeals(data)
        setSource('portal_db')
      } else {
        setDeals(data.data || [])
        setSource(data.source || 'fallback')
      }
    } catch { addToast('Failed to load pipeline', 'error') }
    finally { setLoading(false) }
  }, [addToast])

  useEffect(() => { fetchDeals() }, [fetchDeals])

  const fmt = (n?: number) => n ? `$${(n / 1e6).toFixed(1)}M` : '—'
  const dealsByStage = STAGES.map(s => ({
    ...s,
    deals: deals.filter(d => mapDealToStage(d) === s.key),
    value: deals.filter(d => mapDealToStage(d) === s.key)
      .reduce((sum, d) => sum + (d.purchasePrice || d.value || 0), 0),
  }))
  const totalValue = deals.reduce((s, d) => s + (d.purchasePrice || d.value || 0), 0)

  if (loading) return <LoadingState message="Loading pipeline..." />

  return (
    <div>
      <DataSourceBanner source={source} />
      <h1 className="mt-0 mb-1 text-text-primary text-2xl font-bold">Acquisition Pipeline</h1>
      <p className="mt-0 mb-4 text-text-secondary text-xs">
        {deals.length} active deals · {fmt(totalValue)}
      </p>

      {/* KPI Strip */}
      <div className="flex gap-4 mb-6 overflow-x-auto">
        {dealsByStage.map(s => (
          <div
            key={s.key}
            className="px-4 py-2.5 bg-surface-raised rounded-xl"
            style={{ border: `1px solid ${s.color}22`, minWidth: 120 }}
          >
            <div className="text-[0.6rem] font-semibold uppercase mb-0.5" style={{ color: s.color }}>{s.label}</div>
            <div className="text-text-primary text-lg font-bold">{s.deals.length}</div>
            <div className="text-text-muted text-[0.65rem]">{fmt(s.value)}</div>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="grid gap-3 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(200px, 1fr))` }}>
        {dealsByStage.map(stage => (
          <div
            key={stage.key}
            className="bg-surface-raised rounded-xl"
            style={{ border: `1px solid ${stage.color}15`, minHeight: 300 }}
          >
            <div
              className="px-3 py-2.5 flex justify-between items-center"
              style={{ borderBottom: `2px solid ${stage.color}` }}
            >
              <span className="text-[0.7rem] font-bold" style={{ color: stage.color }}>{stage.label}</span>
              <span
                className="px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold"
                style={{
                  background: `${stage.color}22`,
                  color: stage.color,
                }}
              >{stage.deals.length}</span>
            </div>
            <div className="p-2 flex flex-col gap-1.5">
              {stage.deals.length === 0 && (
                <div className="py-6 px-2 text-center text-text-muted/50 text-[0.7rem]">No deals</div>
              )}
              {stage.deals.map(d => (
                <div
                  key={d.id}
                  className="p-2.5 bg-surface-hover rounded-lg border border-border cursor-pointer"
                  onClick={() => addToast(`Opening ${d.name}`, 'info')}
                >
                  <div className="text-text-primary text-xs font-semibold mb-0.5">{d.name}</div>
                  {d.address && <div className="text-text-muted text-[0.6rem] mb-1">{d.address}</div>}
                  <div className="flex justify-between items-center">
                    <span className="text-accent text-xs font-semibold">{fmt(d.purchasePrice || d.value)}</span>
                    {d.assetType && (
                      <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-semibold bg-status-info/15 text-status-info">{d.assetType}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
