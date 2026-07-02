'use client'

import React from 'react'
import { StatCard, Card, ProgressBar } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useCockpitQuery } from '@/hooks/useCockpitData'
import { computeMetrics, seedRevenueEvents, seedLeads, seedAgents, seedAutomations, seedTasks, seedClients } from '@/lib/data/seed'
import type { SeedLead, SeedAgent, SeedAutomation, SeedTask, SeedClient } from '@/lib/data/seed'

export default function AnalyticsPage() {
  const clientsQ = useCockpitQuery<SeedClient[]>('clients', '/api/cockpit/clients')
  const leadsQ = useCockpitQuery<SeedLead[]>('leads', '/api/cockpit/leads')
  const tasksQ = useCockpitQuery<SeedTask[]>('tasks', '/api/cockpit/tasks')
  const agentsQ = useCockpitQuery<SeedAgent[]>('agents', '/api/cockpit/agents')
  const automationsQ = useCockpitQuery<SeedAutomation[]>('automations', '/api/cockpit/automations')

  const clients = clientsQ.data?.data ?? seedClients
  const leads = leadsQ.data?.data ?? seedLeads
  const tasks = tasksQ.data?.data ?? seedTasks
  const agents = agentsQ.data?.data ?? seedAgents
  const automations = automationsQ.data?.data ?? seedAutomations
  const dataSource = clientsQ.data?.source ?? 'seed'
  const dataWarning = clientsQ.data?.warning

  const m = computeMetrics()

  const completedTasks = tasks.filter(t => t.status === 'done').length
  const pendingTasks = tasks.filter(t => t.status !== 'done').length
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length

  const monthlyRevenue = [
    { month: 'Feb', value: 95000 }, { month: 'Mar', value: 120000 }, { month: 'Apr', value: 175000 },
    { month: 'May', value: 160000 }, { month: 'Jun', value: 310000 }, { month: 'Jul', value: m.pendingRevenue },
  ]
  const maxRev = Math.max(...monthlyRevenue.map(r => r.value))

  const leadByStage = [
    { stage: 'New', count: leads.filter(l => l.stage === 'new').length, color: '#A855F7' },
    { stage: 'Contacted', count: leads.filter(l => l.stage === 'contacted').length, color: '#3B82F6' },
    { stage: 'Qualified', count: leads.filter(l => l.stage === 'qualified').length, color: '#06B6D4' },
    { stage: 'Demo', count: leads.filter(l => l.stage === 'demo_scheduled').length, color: '#FFCC33' },
    { stage: 'Proposal', count: leads.filter(l => l.stage === 'proposal_sent').length, color: '#F59E0B' },
    { stage: 'Negotiation', count: leads.filter(l => l.stage === 'negotiation').length, color: '#00A980' },
    { stage: 'Won', count: leads.filter(l => l.stage === 'won').length, color: '#10B981' },
    { stage: 'Lost', count: leads.filter(l => l.stage === 'lost').length, color: '#EF4444' },
  ]

  const clientRevenue = clients.map(c => ({ name: c.name, revenue: c.revenue })).sort((a, b) => b.revenue - a.revenue)
  const maxClientRev = Math.max(...clientRevenue.map(c => c.revenue), 1)

  const isLoading = clientsQ.isLoading && leadsQ.isLoading

  if (isLoading) return <LoadingState message="Loading analytics..." />

  return (
    <div>
      <DataSourceBanner source={dataSource} warning={dataWarning} />

      <h1 style={{ margin: '0 0 0.25rem', color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Revenue & Analytics Center</h1>
      <p style={{ margin: '0 0 1.5rem', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>Business performance metrics and insights</p>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <StatCard label="Total Revenue" value={`$${(m.totalRevenue / 1000).toFixed(0)}K`} change={12} icon={<span>💰</span>} />
        <StatCard label="Projected" value={`$${(m.projectedRevenue / 1000).toFixed(0)}K`} change={8} icon={<span>📊</span>} color="#3B82F6" />
        <StatCard label="Overdue" value={`$${(m.overdueRevenue / 1000).toFixed(0)}K`} changeLabel="Needs attention" icon={<span>⚠️</span>} color="#EF4444" />
        <StatCard label="Avg Lead Score" value={m.avgLeadScore} change={5} icon={<span>🎯</span>} color="#A855F7" />
        <StatCard label="Conversion" value={`${m.conversionRate}%`} change={3} icon={<span>🔄</span>} />
        <StatCard label="Active Automations" value={automations.filter(a => a.status === 'active').length} changeLabel={`${automations.filter(a => a.status === 'error').length} errors`} icon={<span>⚡</span>} color="#00A980" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1rem' }}>
        {/* Revenue Trend Chart */}
        <Card title="Revenue Trend">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: 180, paddingTop: '1rem' }}>
            {monthlyRevenue.map((r, i) => (
              <div key={r.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.6rem' }}>${(r.value / 1000).toFixed(0)}K</span>
                <div style={{
                  width: '100%', maxWidth: 40,
                  height: `${(r.value / maxRev) * 140}px`,
                  background: i === monthlyRevenue.length - 1
                    ? 'linear-gradient(180deg, rgba(255,204,51,0.4), rgba(255,204,51,0.1))'
                    : 'linear-gradient(180deg, rgba(59,130,246,0.4), rgba(59,130,246,0.1))',
                  borderRadius: '4px 4px 0 0', transition: 'height 300ms ease',
                  border: i === monthlyRevenue.length - 1 ? '1px solid rgba(255,204,51,0.3)' : '1px solid rgba(59,130,246,0.2)',
                }} />
                <span style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>{r.month}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Lead Funnel */}
        <Card title="Lead Pipeline Funnel">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {leadByStage.map(s => (
              <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ color: s.color, fontSize: '0.75rem', width: 80, fontWeight: 500 }}>{s.stage}</span>
                <div style={{ flex: 1 }}><ProgressBar value={s.count} max={Math.max(...leadByStage.map(l => l.count), 1)} color={s.color} height={8} /></div>
                <span style={{ color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 600, width: 20, textAlign: 'right' }}>{s.count}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Client Revenue */}
        <Card title="Revenue by Client">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {clientRevenue.map(c => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ color: '#e2e8f0', fontSize: '0.75rem', width: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <div style={{ flex: 1 }}><ProgressBar value={c.revenue} max={maxClientRev} color="#FFCC33" height={8} /></div>
                <span style={{ color: '#00A980', fontSize: '0.75rem', fontWeight: 600, width: 55, textAlign: 'right' }}>${(c.revenue / 1000).toFixed(0)}K</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Agent Performance */}
        <Card title="Agent Performance">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {agents.slice(0, 6).map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ color: '#e2e8f0', fontSize: '0.75rem', width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                <div style={{ flex: 1 }}><ProgressBar value={a.successRate} color={a.successRate > 90 ? '#00A980' : a.successRate > 70 ? '#FFCC33' : '#EF4444'} /></div>
                <span style={{ color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 600, width: 35, textAlign: 'right' }}>{a.successRate}%</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Task Metrics */}
        <Card title="Task Completion">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', textAlign: 'center' }}>
            {[
              { label: 'Completed', value: completedTasks, color: '#00A980' },
              { label: 'Pending', value: pendingTasks, color: '#F59E0B' },
              { label: 'Overdue', value: overdueTasks, color: '#EF4444' },
            ].map(item => (
              <div key={item.label} style={{ padding: '1rem', background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
                <div style={{ color: item.color, fontSize: '1.5rem', fontWeight: 700 }}>{item.value}</div>
                <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Automation Metrics */}
        <Card title="Automation Health">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', textAlign: 'center' }}>
            {[
              { label: 'Total Runs', value: automations.reduce((s, a) => s + a.successCount + a.failureCount, 0), color: '#3B82F6' },
              { label: 'Success Rate', value: `${Math.round(automations.reduce((s, a) => s + a.successCount, 0) / Math.max(automations.reduce((s, a) => s + a.successCount + a.failureCount, 0), 1) * 100)}%`, color: '#00A980' },
              { label: 'Active', value: automations.filter(a => a.status === 'active').length, color: '#FFCC33' },
              { label: 'Failed', value: automations.filter(a => a.status === 'error').length, color: '#EF4444' },
            ].map(item => (
              <div key={item.label} style={{ padding: '0.85rem', background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
                <div style={{ color: item.color, fontSize: '1.25rem', fontWeight: 700 }}>{item.value}</div>
                <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.6rem', marginTop: '0.2rem', textTransform: 'uppercase' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
