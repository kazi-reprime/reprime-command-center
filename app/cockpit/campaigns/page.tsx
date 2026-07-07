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
      <h1 className="mb-1 text-text-primary text-2xl font-bold">Outreach Campaigns</h1>
      <p className="mb-4 text-text-secondary text-xs">
        Email outreach management & performance
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 mb-6">
        <StatCard label="Total Campaigns" value={campaigns.length} icon={<span>📡</span>} />
        <StatCard label="Active" value={activeCamps.length} icon={<span>🟢</span>} color="#00A980" />
        <StatCard label="Emails Sent" value={totalSent.toLocaleString()} icon={<span>📧</span>} color="#3B82F6" />
        <StatCard label="Reply Rate" value={`${avgRate}%`} icon={<span>💬</span>} color="#A855F7" />
      </div>

      {/* Campaign Cards */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3">
        {campaigns.length === 0 && (
          <Card title="No Campaigns">
            <p className="text-text-secondary text-sm">{warning || 'No campaigns configured'}</p>
          </Card>
        )}
        {campaigns.map(c => {
          const rate = c.sent_count && c.sent_count > 0 ? Math.round(((c.reply_count || 0) / c.sent_count) * 100) : 0
          return (
            <Card key={c.id} title="">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-text-primary text-base font-semibold">{c.name}</div>
                  <span className={`px-1.5 py-0.5 rounded-full text-[0.55rem] font-semibold mt-1 inline-block ${
                    c.status === 'active' || c.status === 'sending'
                      ? 'bg-status-success/15 text-status-success'
                      : c.status === 'completed'
                        ? 'bg-status-info/15 text-status-info'
                        : 'bg-status-warning/15 text-status-warning'
                  }`}>{c.status || 'draft'}</span>
                </div>
                <div className="text-right">
                  <div className="text-text-primary text-xl font-bold">{rate}%</div>
                  <div className="text-text-muted text-[0.55rem]">reply rate</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { label: 'Listings', value: c.listing_count || 0, colorClass: 'text-text-primary' },
                  { label: 'Sent', value: c.sent_count || 0, colorClass: 'text-status-info' },
                  { label: 'Replied', value: c.reply_count || 0, colorClass: 'text-status-success' },
                ].map(m => (
                  <div key={m.label} className="p-1.5 bg-surface/10 rounded-md text-center">
                    <div className={`${m.colorClass} text-base font-bold`}>{m.value}</div>
                    <div className="text-text-muted text-[0.55rem] uppercase">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Reply rate bar */}
              <div className="h-1.5 bg-surface/20 rounded-sm overflow-hidden mb-2">
                <div className={`h-full rounded-sm transition-[width] duration-300 ${rate > 30 ? 'bg-status-success' : 'bg-status-warning'}`} style={{ width: `${Math.min(rate, 100)}%` }} />
              </div>

              <div className="flex gap-1">
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
