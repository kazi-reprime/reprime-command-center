'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { StatCard, Card, StatusBadge } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useCockpitQuery } from '@/hooks/useCockpitData'

interface PortalStats {
  listingsCount: number; brokersCount: number;
  activeCampaigns: number; totalCampaigns: number;
  emailsSent: number; replyRate: number;
  activeAutomations: number; needsAttention: number;
  pipelineDeals: number; pipelineValue: number;
  topScoreCount: number;
}

interface Deal { id: string; name: string; address?: string; purchasePrice?: number; status?: string }
interface Task { id: string; title: string; priority: number; status: string; dueDate?: string; projectTag?: string }

export default function CockpitDashboard() {
  const statsQ = useCockpitQuery<PortalStats>('portal-stats', '/api/cockpit/portal-stats')
  const dealsQ = useCockpitQuery<Deal[]>('deals', '/api/deals')
  const tasksQ = useCockpitQuery<Task[]>('tasks', '/api/cockpit/tasks')

  const stats = statsQ.data?.data
  const deals = Array.isArray(dealsQ.data) ? dealsQ.data : (dealsQ.data?.data ?? [])
  const tasks = tasksQ.data?.data ?? []
  const dataSource = statsQ.data?.source ?? 'unavailable'
  const dataWarning = statsQ.data?.warning

  const fmt = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n}`
  const priorities = tasks.filter((t: Task) => t.status !== 'done').sort((a: Task, b: Task) => a.priority - b.priority).slice(0, 5)
  const recentDeals = deals.slice(0, 5)

  const isLoading = statsQ.isLoading

  return (
    <div>
      <DataSourceBanner source={dataSource} warning={dataWarning} />

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>
          Reprime Group Dashboard
        </h1>
        <p style={{ margin: '0.35rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
          Portfolio overview & acquisition pipeline · {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {isLoading ? <LoadingState message="Loading live dashboard data..." /> : (
        <>
          {/* KPI Grid — all from live Portal stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <StatCard label="Total Campaigns" value={stats?.totalCampaigns ?? 0} icon={<span>📡</span>} />
            <StatCard label="Active Campaigns" value={stats?.activeCampaigns ?? 0} icon={<span>🟢</span>} color="#00A980" />
            <StatCard label="Reply Rate" value={`${stats?.replyRate ?? 0}%`} icon={<span>💬</span>} color="#A855F7" />
            <StatCard label="Emails Sent" value={(stats?.emailsSent ?? 0).toLocaleString()} icon={<span>📧</span>} color="#3B82F6" />
            <StatCard label="Active Automations" value={stats?.activeAutomations ?? 0} icon={<span>⚡</span>} color="#F59E0B" />
            <StatCard label="Needs Attention" value={stats?.needsAttention ?? 0} icon={<span>🔴</span>} color="#EF4444" />
          </div>

          {/* Pipeline Health */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,204,51,0.08) 0%, rgba(14,52,112,0.4) 100%)',
            border: '1px solid rgba(255,204,51,0.12)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#FFCC33', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pipeline Health</div>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                  <div>
                    <div style={{ color: '#e2e8f0', fontSize: '1.5rem', fontWeight: 700 }}>{stats?.pipelineDeals ?? 0}</div>
                    <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>active deals</div>
                  </div>
                  <div>
                    <div style={{ color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>{fmt(stats?.pipelineValue ?? 0)}</div>
                    <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>total value</div>
                  </div>
                  <div>
                    <div style={{ color: '#e2e8f0', fontSize: '1.5rem', fontWeight: 700 }}>{stats?.listingsCount?.toLocaleString() ?? 0}</div>
                    <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>listings</div>
                  </div>
                  <div>
                    <div style={{ color: '#e2e8f0', fontSize: '1.5rem', fontWeight: 700 }}>{stats?.brokersCount?.toLocaleString() ?? 0}</div>
                    <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>brokers</div>
                  </div>
                  <div>
                    <div style={{ color: '#e2e8f0', fontSize: '1.5rem', fontWeight: 700 }}>{stats?.topScoreCount ?? 0}</div>
                    <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>scored deals</div>
                  </div>
                </div>
              </div>
              <Link href="/cockpit/pipeline" style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.7rem', textDecoration: 'none' }}>View Pipeline →</Link>
            </div>
          </div>

          {/* Content Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
            {/* Recent Deals */}
            <Card title="Recent Deals" action={<Link href="/cockpit/pipeline" style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.7rem', textDecoration: 'none' }}>Pipeline →</Link>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {recentDeals.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,204,51,0.3)', fontSize: '0.75rem' }}>
                    No deals in database. Add deals through the Pipeline view.
                  </div>
                ) : recentDeals.map((d: Deal) => (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.5rem 0.6rem', background: 'rgba(0,0,0,0.15)', borderRadius: 8,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 500 }}>{d.name}</div>
                      {d.address && <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: '0.6rem' }}>{d.address}</div>}
                    </div>
                    <span style={{ color: '#FFCC33', fontSize: '0.75rem', fontWeight: 600 }}>
                      {d.purchasePrice ? fmt(d.purchasePrice) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Today's Tasks */}
            <Card title="Tasks" action={<Link href="/cockpit/tasks" style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.7rem', textDecoration: 'none' }}>View all →</Link>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {priorities.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,204,51,0.3)', fontSize: '0.75rem' }}>
                    No open tasks. Tasks populate from the bucket items table.
                  </div>
                ) : priorities.map((task: Task) => (
                  <div key={task.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.5rem 0.6rem', background: 'rgba(0,0,0,0.15)', borderRadius: 8,
                    borderLeft: `3px solid ${task.priority === 1 ? '#EF4444' : task.priority === 2 ? '#F59E0B' : '#3B82F6'}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                      <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: '0.6rem' }}>{task.projectTag} · Due {task.dueDate || 'No date'}</div>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick Links */}
            <Card title="Quick Actions">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {[
                  { href: '/cockpit/properties', icon: '🏢', label: 'Properties', count: stats?.listingsCount },
                  { href: '/cockpit/brokers', icon: '🤝', label: 'Brokers', count: stats?.brokersCount },
                  { href: '/cockpit/scores', icon: '⭐', label: 'Deal Scores', count: stats?.topScoreCount },
                  { href: '/cockpit/campaigns', icon: '📡', label: 'Campaigns', count: stats?.totalCampaigns },
                  { href: '/cockpit/comms', icon: '💬', label: 'Communications' },
                  { href: '/cockpit/loi', icon: '📄', label: 'LOI Creator' },
                ].map(link => (
                  <Link key={link.href} href={link.href} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.6rem', background: 'rgba(0,0,0,0.15)', borderRadius: 8,
                    textDecoration: 'none', color: '#e2e8f0', fontSize: '0.75rem',
                  }}>
                    <span>{link.icon}</span>
                    <span style={{ flex: 1 }}>{link.label}</span>
                    {link.count != null && <span style={{ color: '#FFCC33', fontWeight: 600, fontSize: '0.7rem' }}>{link.count?.toLocaleString()}</span>}
                  </Link>
                ))}
              </div>
            </Card>

            {/* System Status */}
            <Card title="System Status">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(stats?.needsAttention ?? 0) > 0 ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 0.6rem', background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.15)', borderRadius: 6,
                  }}>
                    <span style={{ color: '#EF4444' }}>⚠️</span>
                    <span style={{ color: '#EF4444', fontSize: '0.75rem', fontWeight: 500 }}>
                      {stats?.needsAttention} automation(s) need human attention
                    </span>
                  </div>
                ) : (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(0,169,128,0.6)', fontSize: '0.75rem' }}>
                    ✅ All systems operational
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', fontSize: '0.7rem' }}>
                  <div style={{ padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: 4, color: '#e2e8f0' }}>
                    WhatsApp: <span style={{ color: '#00A980' }}>Connected</span>
                  </div>
                  <div style={{ padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: 4, color: '#e2e8f0' }}>
                    Gmail: <span style={{ color: '#00A980' }}>Connected</span>
                  </div>
                  <div style={{ padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: 4, color: '#e2e8f0' }}>
                    Pipedrive: <span style={{ color: '#00A980' }}>Connected</span>
                  </div>
                  <div style={{ padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: 4, color: '#e2e8f0' }}>
                    Database: <span style={{ color: dataSource === 'database' || dataSource === 'portal_db' ? '#00A980' : '#F59E0B' }}>{dataSource === 'database' || dataSource === 'portal_db' ? 'Live' : 'Check'}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
