'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, ActionButton, StatCard } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useToast } from '@/lib/contexts/ToastContext'

interface Campaign {
  id: string; name: string; status?: string; listing_count?: number;
  sent_count?: number; reply_count?: number; reply_rate?: number; created_at?: string;
}

export default function CampaignsPage() {
  const { addToast } = useToast()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('loading')
  const [warning, setWarning] = useState<string | undefined>()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cockpit/campaigns')
      const data = await res.json()
      setCampaigns(data.data || [])
      setSource(data.source || 'fallback')
      setWarning(data.warning)
    } catch { addToast('Failed to load campaigns', 'error') }
    finally { setLoading(false) }
  }, [addToast])

  useEffect(() => { fetchData() }, [fetchData])

  const totalSent = campaigns.reduce((s, c) => s + (c.sent_count || 0), 0)
  const totalReplied = campaigns.reduce((s, c) => s + (c.reply_count || 0), 0)
  const avgRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0
  const activeCamps = campaigns.filter(c => c.status === 'active' || c.status === 'sending')

  if (loading) return <LoadingState message="Loading campaigns..." />

  return (
    <div>
      <DataSourceBanner source={source} warning={warning} />
      <h1 style={{ margin: '0 0 0.25rem', color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Outreach Campaigns</h1>
      <p style={{ margin: '0 0 1rem', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
        Email outreach management & performance
      </p>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <StatCard label="Total Campaigns" value={campaigns.length} icon={<span>📡</span>} />
        <StatCard label="Active" value={activeCamps.length} icon={<span>🟢</span>} color="#00A980" />
        <StatCard label="Emails Sent" value={totalSent.toLocaleString()} icon={<span>📧</span>} color="#3B82F6" />
        <StatCard label="Reply Rate" value={`${avgRate}%`} icon={<span>💬</span>} color="#A855F7" />
      </div>

      {/* Campaign Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem' }}>
        {campaigns.length === 0 && (
          <Card title="No Campaigns">
            <p style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>{warning || 'No campaigns configured'}</p>
          </Card>
        )}
        {campaigns.map(c => {
          const rate = c.sent_count && c.sent_count > 0 ? Math.round(((c.reply_count || 0) / c.sent_count) * 100) : 0
          return (
            <Card key={c.id} title="">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600 }}>{c.name}</div>
                  <span style={{
                    padding: '0.1rem 0.4rem', borderRadius: 999, fontSize: '0.55rem', fontWeight: 600, marginTop: 4, display: 'inline-block',
                    background: c.status === 'active' || c.status === 'sending' ? 'rgba(0,169,128,0.15)' : c.status === 'completed' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                    color: c.status === 'active' || c.status === 'sending' ? '#00A980' : c.status === 'completed' ? '#3B82F6' : '#F59E0B',
                  }}>{c.status || 'draft'}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#FFCC33', fontSize: '1.2rem', fontWeight: 700 }}>{rate}%</div>
                  <div style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.55rem' }}>reply rate</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {[
                  { label: 'Listings', value: c.listing_count || 0, color: '#e2e8f0' },
                  { label: 'Sent', value: c.sent_count || 0, color: '#3B82F6' },
                  { label: 'Replied', value: c.reply_count || 0, color: '#00A980' },
                ].map(m => (
                  <div key={m.label} style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.1)', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ color: m.color, fontSize: '1rem', fontWeight: 700 }}>{m.value}</div>
                    <div style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.55rem', textTransform: 'uppercase' }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Reply rate bar */}
              <div style={{ height: 6, background: 'rgba(0,0,0,0.2)', borderRadius: 3, overflow: 'hidden', marginBottom: '0.5rem' }}>
                <div style={{ height: '100%', width: `${Math.min(rate, 100)}%`, background: rate > 30 ? '#00A980' : '#F59E0B', borderRadius: 3, transition: 'width 300ms' }} />
              </div>

              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <ActionButton label="View Details" variant="primary" size="sm" onClick={() => addToast(`Opening ${c.name}`, 'info')} />
                <ActionButton
                  label={c.status === 'active' ? 'Pause' : 'Resume'}
                  variant="ghost" size="sm"
                  onClick={() => addToast(`${c.status === 'active' ? 'Pausing' : 'Resuming'} ${c.name}`, 'info')}
                />
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
