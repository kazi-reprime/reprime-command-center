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
  const [source, setSource] = useState('seed')
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem', color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Investor Profiles</h1>
          <p style={{ margin: 0, color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
            {investors.length} total · {investors.filter(i => i.status === 'active').length} active · {totalMatches} total matches
          </p>
        </div>
        <ActionButton label="+ Add Investor" variant="primary" onClick={() => addToast('Add investor form coming soon', 'info')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem' }}>
        {investors.map(inv => (
          <Card key={inv.id} title="">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: inv.color || 'linear-gradient(135deg, #FFCC33, #F0B400)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', fontWeight: 700, color: '#0E3470', flexShrink: 0,
              }}>
                {inv.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600 }}>{inv.name}</div>
                <span style={{
                  padding: '0.1rem 0.4rem', borderRadius: 999, fontSize: '0.55rem', fontWeight: 600,
                  background: inv.status === 'active' ? 'rgba(0,169,128,0.15)' : 'rgba(245,158,11,0.15)',
                  color: inv.status === 'active' ? '#00A980' : '#F59E0B',
                }}>{inv.status === 'active' ? 'Active' : 'Inactive'}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#FFCC33', fontSize: '1.1rem', fontWeight: 700 }}>{inv.match_count || 0}</div>
                <div style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.55rem' }}>matches</div>
              </div>
            </div>

            {/* Buy Box Criteria */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.7rem' }}>
              {(inv.min_price || inv.max_price) && (
                <div style={{ padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: 6 }}>
                  <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: '0.55rem', textTransform: 'uppercase' }}>Price Range</div>
                  <div style={{ color: '#e2e8f0' }}>
                    {inv.min_price ? fmt(inv.min_price) : '$0'} – {inv.max_price ? fmt(inv.max_price) : '∞'}
                  </div>
                </div>
              )}
              {inv.states && inv.states.length > 0 && (
                <div style={{ padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: 6 }}>
                  <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: '0.55rem', textTransform: 'uppercase' }}>States</div>
                  <div style={{ color: '#e2e8f0' }}>{inv.states.slice(0, 4).join(', ')}{inv.states.length > 4 ? ` +${inv.states.length - 4}` : ''}</div>
                </div>
              )}
              {inv.property_types && inv.property_types.length > 0 && (
                <div style={{ padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: 6, gridColumn: '1 / -1' }}>
                  <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: '0.55rem', textTransform: 'uppercase' }}>Property Types</div>
                  <div style={{ color: '#e2e8f0', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: 2 }}>
                    {inv.property_types.map(t => (
                      <span key={t} style={{ padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.55rem', background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.6rem' }}>
              <ActionButton label="View Listings" variant="primary" size="sm" onClick={() => addToast(`Viewing matches for ${inv.name}`, 'info')} />
              <ActionButton label="Edit" variant="ghost" size="sm" onClick={() => addToast('Edit investor coming soon', 'info')} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
