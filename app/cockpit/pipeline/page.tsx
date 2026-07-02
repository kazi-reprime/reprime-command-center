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
      <h1 style={{ margin: '0 0 0.25rem', color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Acquisition Pipeline</h1>
      <p style={{ margin: '0 0 1rem', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
        {deals.length} active deals · {fmt(totalValue)}
      </p>

      {/* KPI Strip */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
        {dealsByStage.map(s => (
          <div key={s.key} style={{
            padding: '0.6rem 1rem', background: 'rgba(14,52,112,0.5)',
            border: `1px solid ${s.color}22`, borderRadius: 10, minWidth: 120,
          }}>
            <div style={{ color: s.color, fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{s.label}</div>
            <div style={{ color: '#e2e8f0', fontSize: '1.1rem', fontWeight: 700 }}>{s.deals.length}</div>
            <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>{fmt(s.value)}</div>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, minmax(200px, 1fr))`, gap: '0.75rem', overflowX: 'auto' }}>
        {dealsByStage.map(stage => (
          <div key={stage.key} style={{
            background: 'rgba(14,52,112,0.3)', borderRadius: 10,
            border: `1px solid ${stage.color}15`, minHeight: 300,
          }}>
            <div style={{
              padding: '0.6rem 0.75rem', borderBottom: `2px solid ${stage.color}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ color: stage.color, fontSize: '0.7rem', fontWeight: 700 }}>{stage.label}</span>
              <span style={{
                background: `${stage.color}22`, color: stage.color,
                padding: '0.15rem 0.4rem', borderRadius: 999, fontSize: '0.6rem', fontWeight: 700,
              }}>{stage.deals.length}</span>
            </div>
            <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {stage.deals.length === 0 && (
                <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center', color: 'rgba(255,204,51,0.2)', fontSize: '0.7rem' }}>No deals</div>
              )}
              {stage.deals.map(d => (
                <div key={d.id} style={{
                  padding: '0.6rem', background: 'rgba(0,0,0,0.15)', borderRadius: 8,
                  border: '1px solid rgba(255,204,51,0.04)',
                  cursor: 'pointer',
                }} onClick={() => addToast(`Opening ${d.name}`, 'info')}>
                  <div style={{ color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 600, marginBottom: 2 }}>{d.name}</div>
                  {d.address && <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: '0.6rem', marginBottom: 4 }}>{d.address}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#FFCC33', fontSize: '0.75rem', fontWeight: 600 }}>{fmt(d.purchasePrice || d.value)}</span>
                    {d.assetType && (
                      <span style={{
                        padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.5rem', fontWeight: 600,
                        background: 'rgba(59,130,246,0.15)', color: '#3B82F6',
                      }}>{d.assetType}</span>
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
