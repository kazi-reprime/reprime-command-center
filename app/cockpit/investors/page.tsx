'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, ActionButton } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useToast } from '@/lib/contexts/ToastContext'

interface Investor {
  id: string; name: string; status?: string; min_price?: number; max_price?: number;
  states?: string[]; property_types?: string[]; listing_types?: string[];
  match_count?: number; color?: string; notes?: string;
}

export default function InvestorsPage() {
  const { addToast } = useToast()
  const [investors, setInvestors] = useState<Investor[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('loading')
  const [warning, setWarning] = useState<string | undefined>()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cockpit/investors')
      const data = await res.json()
      setInvestors(data.data || [])
      setSource(data.source || 'fallback')
      setWarning(data.warning)
    } catch { addToast('Failed to load investors', 'error') }
    finally { setLoading(false) }
  }, [addToast])

  useEffect(() => { fetchData() }, [fetchData])

  const fmt = (n?: number) => n ? `$${(n / 1e6).toFixed(1)}M` : '—'
  const totalMatches = investors.reduce((s, i) => s + (i.match_count || 0), 0)

  if (loading) return <LoadingState message="Loading investors..." />

  return (
    <div>
      <DataSourceBanner source={source} warning={warning} />
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="mt-0 mb-1 text-text-primary text-2xl font-bold">Investor Profiles</h1>
          <p className="m-0 text-text-secondary text-xs">
            {investors.length} total · {investors.filter(i => i.status === 'active').length} active · {totalMatches} total matches
          </p>
        </div>
        <ActionButton label="+ Add Investor" variant="primary" onClick={() => addToast('Add investor form coming soon', 'info')} />
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        {investors.map(inv => (
          <Card key={inv.id} title="">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                  background: inv.color || 'linear-gradient(135deg, #FFCC33, #F0B400)',
                  color: '#0E3470',
                }}
              >
                {inv.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1">
                <div className="text-text-primary text-sm font-semibold">{inv.name}</div>
                <span className={`px-1.5 py-0.5 rounded-full text-[0.55rem] font-semibold ${
                  inv.status === 'active'
                    ? 'bg-status-success/15 text-status-success'
                    : 'bg-status-warning/15 text-status-warning'
                }`}>{inv.status === 'active' ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="text-right">
                <div className="text-accent text-lg font-bold">{inv.match_count || 0}</div>
                <div className="text-text-muted text-[0.55rem]">matches</div>
              </div>
            </div>

            {/* Buy Box Criteria */}
            <div className="grid grid-cols-2 gap-1.5 text-[0.7rem]">
              {(inv.min_price || inv.max_price) && (
                <div className="px-2 py-1.5 bg-surface-hover rounded-lg">
                  <div className="text-text-muted text-[0.55rem] uppercase">Price Range</div>
                  <div className="text-text-primary">
                    {inv.min_price ? fmt(inv.min_price) : '$0'} – {inv.max_price ? fmt(inv.max_price) : '∞'}
                  </div>
                </div>
              )}
              {inv.states && inv.states.length > 0 && (
                <div className="px-2 py-1.5 bg-surface-hover rounded-lg">
                  <div className="text-text-muted text-[0.55rem] uppercase">States</div>
                  <div className="text-text-primary">{inv.states.slice(0, 4).join(', ')}{inv.states.length > 4 ? ` +${inv.states.length - 4}` : ''}</div>
                </div>
              )}
              {inv.property_types && inv.property_types.length > 0 && (
                <div className="col-span-full px-2 py-1.5 bg-surface-hover rounded-lg">
                  <div className="text-text-muted text-[0.55rem] uppercase">Property Types</div>
                  <div className="text-text-primary flex gap-1 flex-wrap mt-0.5">
                    {inv.property_types.map(t => (
                      <span key={t} className="px-1.5 py-0.5 rounded text-[0.55rem] bg-status-info/15 text-status-info">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-1.5 mt-2.5">
              <ActionButton label="View Listings" variant="primary" size="sm" onClick={() => addToast(`Viewing matches for ${inv.name}`, 'info')} />
              <ActionButton label="Edit" variant="ghost" size="sm" onClick={() => addToast('Edit investor coming soon', 'info')} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
