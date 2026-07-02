'use client'

import React, { useState, useEffect } from 'react'
import { StatCard, Card } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useCockpitQuery } from '@/hooks/useCockpitData'

interface PortalStats {
  listingsCount: number; brokersCount: number; activeCampaigns: number; totalCampaigns: number;
  emailsSent: number; replyRate: number; activeAutomations: number; needsAttention: number;
  pipelineDeals: number; pipelineValue: number; topScoreCount: number;
}

export default function AnalyticsPage() {
  const statsQ = useCockpitQuery<PortalStats>('portal-stats', '/api/cockpit/portal-stats')
  const stats = statsQ.data?.data
  const dataSource = statsQ.data?.source ?? 'unavailable'
  const dataWarning = statsQ.data?.warning

  const fmt = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n}`

  if (statsQ.isLoading) return <LoadingState message="Loading analytics..." />

  return (
    <div>
      <DataSourceBanner source={dataSource} warning={dataWarning} />
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Analytics</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
          Live metrics from Portal database
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <StatCard label="Listings" value={(stats?.listingsCount ?? 0).toLocaleString()} icon={<span>🏢</span>} />
        <StatCard label="Brokers" value={(stats?.brokersCount ?? 0).toLocaleString()} icon={<span>🤝</span>} color="#3B82F6" />
        <StatCard label="Pipeline Deals" value={stats?.pipelineDeals ?? 0} icon={<span>🎯</span>} color="#A855F7" />
        <StatCard label="Pipeline Value" value={fmt(stats?.pipelineValue ?? 0)} icon={<span>💰</span>} color="#FFCC33" />
        <StatCard label="Campaigns" value={stats?.totalCampaigns ?? 0} icon={<span>📡</span>} color="#00A980" />
        <StatCard label="Active Campaigns" value={stats?.activeCampaigns ?? 0} icon={<span>🟢</span>} color="#00A980" />
        <StatCard label="Emails Sent" value={(stats?.emailsSent ?? 0).toLocaleString()} icon={<span>📧</span>} color="#3B82F6" />
        <StatCard label="Reply Rate" value={`${stats?.replyRate ?? 0}%`} icon={<span>💬</span>} color="#A855F7" />
        <StatCard label="Active Automations" value={stats?.activeAutomations ?? 0} icon={<span>⚡</span>} color="#F59E0B" />
        <StatCard label="Needs Attention" value={stats?.needsAttention ?? 0} icon={<span>🔴</span>} color="#EF4444" />
        <StatCard label="Deal Scores" value={stats?.topScoreCount ?? 0} icon={<span>⭐</span>} color="#FFCC33" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
        <Card title="Outreach Performance">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.75rem' }}>Emails Sent</span>
              <span style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>{(stats?.emailsSent ?? 0).toLocaleString()}</span>
            </div>
            <div style={{ height: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min((stats?.replyRate ?? 0), 100)}%`, background: (stats?.replyRate ?? 0) > 30 ? '#00A980' : '#F59E0B', borderRadius: 4 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,204,51,0.35)', fontSize: '0.65rem' }}>Reply rate</span>
              <span style={{ color: '#FFCC33', fontSize: '0.75rem', fontWeight: 600 }}>{stats?.replyRate ?? 0}%</span>
            </div>
          </div>
        </Card>

        <Card title="Automation Health">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.75rem' }}>Active</span>
              <span style={{ color: '#00A980', fontSize: '0.85rem', fontWeight: 600 }}>{stats?.activeAutomations ?? 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.75rem' }}>Needs Attention</span>
              <span style={{ color: (stats?.needsAttention ?? 0) > 0 ? '#EF4444' : '#00A980', fontSize: '0.85rem', fontWeight: 600 }}>{stats?.needsAttention ?? 0}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
