'use client'

import React from 'react'
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
      <div className="mb-6">
        <h1 className="m-0 text-text-primary text-2xl font-bold">Analytics</h1>
        <p className="mt-1 mb-0 text-text-secondary text-xs">
          Live metrics from Portal database
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 mb-6">
        <StatCard label="Listings" value={(stats?.listingsCount ?? 0).toLocaleString()} icon={<span>🏢</span>} />
        <StatCard label="Brokers" value={(stats?.brokersCount ?? 0).toLocaleString()} icon={<span>🤝</span>} color="var(--chart-1)" />
        <StatCard label="Pipeline Deals" value={stats?.pipelineDeals ?? 0} icon={<span>🎯</span>} color="var(--chart-2)" />
        <StatCard label="Pipeline Value" value={fmt(stats?.pipelineValue ?? 0)} icon={<span>💰</span>} color="var(--chart-4)" />
        <StatCard label="Campaigns" value={stats?.totalCampaigns ?? 0} icon={<span>📡</span>} color="var(--success)" />
        <StatCard label="Active Campaigns" value={stats?.activeCampaigns ?? 0} icon={<span>🟢</span>} color="var(--success)" />
        <StatCard label="Emails Sent" value={(stats?.emailsSent ?? 0).toLocaleString()} icon={<span>📧</span>} color="var(--chart-1)" />
        <StatCard label="Reply Rate" value={`${stats?.replyRate ?? 0}%`} icon={<span>💬</span>} color="var(--chart-2)" />
        <StatCard label="Active Automations" value={stats?.activeAutomations ?? 0} icon={<span>⚡</span>} color="var(--warning)" />
        <StatCard label="Needs Attention" value={stats?.needsAttention ?? 0} icon={<span>🔴</span>} color="var(--error)" />
        <StatCard label="Deal Scores" value={stats?.topScoreCount ?? 0} icon={<span>⭐</span>} color="var(--chart-4)" />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-4">
        <Card title="Outreach Performance">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary text-xs">Emails Sent</span>
              <span className="text-text-primary text-sm font-semibold">{(stats?.emailsSent ?? 0).toLocaleString()}</span>
            </div>
            <div className="h-2 bg-surface/20 rounded overflow-hidden">
              <div
                className={`h-full rounded ${(stats?.replyRate ?? 0) > 30 ? 'bg-status-success' : 'bg-status-warning'}`}
                style={{ width: `${Math.min((stats?.replyRate ?? 0), 100)}%` }}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted text-[0.65rem]">Reply rate</span>
              <span className="text-text-primary text-xs font-semibold">{stats?.replyRate ?? 0}%</span>
            </div>
          </div>
        </Card>

        <Card title="Automation Health">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="text-text-secondary text-xs">Active</span>
              <span className="text-status-success text-sm font-semibold">{stats?.activeAutomations ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary text-xs">Needs Attention</span>
              <span className={`text-sm font-semibold ${(stats?.needsAttention ?? 0) > 0 ? 'text-status-error' : 'text-status-success'}`}>{stats?.needsAttention ?? 0}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
