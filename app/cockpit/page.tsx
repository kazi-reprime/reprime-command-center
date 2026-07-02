'use client'

import React from 'react'
import Link from 'next/link'
import { StatCard, Card, StatusBadge, ProgressBar } from '@/components/ui/shared'
import { computeMetrics, seedTasks, seedLeads, seedMessages, seedAgents, seedAutomations, seedClients } from '@/lib/data/seed'

export default function CockpitDashboard() {
  const m = computeMetrics()

  const priorities = seedTasks
    .filter(t => t.status !== 'done')
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4)

  const recentMessages = seedMessages.filter(msg => !msg.isRead).slice(0, 3)
  const hotLeads = seedLeads.filter(l => l.score >= 80 && !['won', 'lost'].includes(l.stage)).slice(0, 3)
  const errorAgents = seedAgents.filter(a => a.status === 'error' || a.errorCount > 0)
  const failedAutos = seedAutomations.filter(a => a.status === 'error')

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
          Executive Overview
        </h1>
        <p style={{ margin: '0.35rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Business Health Score */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,204,51,0.12) 0%, rgba(14,52,112,0.4) 100%)',
        border: '1px solid rgba(255,204,51,0.15)',
        borderRadius: 14, padding: '1.5rem', marginBottom: '1.5rem',
        display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: `conic-gradient(#FFCC33 ${m.businessHealthScore * 3.6}deg, rgba(255,204,51,0.1) 0deg)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: '#0A1F44',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#FFCC33', fontSize: '1.1rem', fontWeight: 700,
            }}>
              {m.businessHealthScore}
            </div>
          </div>
          <div>
            <div style={{ color: '#FFCC33', fontSize: '0.85rem', fontWeight: 600 }}>Business Health Score</div>
            <div style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.7rem', marginTop: '0.15rem' }}>Based on revenue, pipeline, tasks & agent performance</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {m.failedAutomations > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#EF4444', fontSize: '0.75rem', fontWeight: 600 }}>
              <span>⚠️</span> {m.failedAutomations} failed automation{m.failedAutomations > 1 ? 's' : ''}
            </div>
          )}
          {m.overdueTasks > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#F59E0B', fontSize: '0.75rem', fontWeight: 600 }}>
              <span>⏰</span> {m.overdueTasks} overdue task{m.overdueTasks > 1 ? 's' : ''}
            </div>
          )}
          {m.unreadMessages > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#3B82F6', fontSize: '0.75rem', fontWeight: 600 }}>
              <span>💬</span> {m.unreadMessages} unread message{m.unreadMessages > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.75rem', marginBottom: '1.5rem',
      }}>
        <StatCard label="Monthly Revenue" value={`$${(m.totalRevenue / 1000).toFixed(0)}K`} change={12} icon={<span>💰</span>} />
        <StatCard label="Pipeline Value" value={`$${(m.pipelineValue / 1000).toFixed(0)}K`} change={8} icon={<span>📈</span>} color="#3B82F6" />
        <StatCard label="Active Clients" value={m.activeClients} change={2} changeLabel="+2 this month" icon={<span>👥</span>} color="#00A980" />
        <StatCard label="New Leads" value={m.newLeads} change={-5} icon={<span>🎯</span>} color="#A855F7" />
        <StatCard label="Conversion Rate" value={`${m.conversionRate}%`} change={3} icon={<span>🔄</span>} />
        <StatCard label="AI Agents Active" value={`${m.runningAgents}/${m.totalAgents}`} changeLabel="4 running" icon={<span>🤖</span>} color="#3B82F6" />
      </div>

      {/* Content Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '1rem',
      }}>
        {/* Today's Priorities */}
        <Card title="Today's Priorities" action={<Link href="/cockpit/tasks" style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.7rem', textDecoration: 'none' }}>View all →</Link>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {priorities.map(task => (
              <div key={task.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.15)',
                borderRadius: 8, borderLeft: `3px solid ${task.priority === 1 ? '#EF4444' : task.priority === 2 ? '#F59E0B' : '#3B82F6'}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                  <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem', marginTop: '0.15rem' }}>{task.projectTag} • Due {task.dueDate || 'No date'}</div>
                </div>
                <StatusBadge status={task.status} />
              </div>
            ))}
          </div>
        </Card>

        {/* Hot Leads */}
        <Card title="Hot Leads" action={<Link href="/cockpit/leads" style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.7rem', textDecoration: 'none' }}>Pipeline →</Link>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {hotLeads.map(lead => (
              <div key={lead.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: 8,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(255,204,51,0.2), rgba(168,85,247,0.2))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#FFCC33', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                }}>
                  {lead.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 500 }}>{lead.name}</div>
                  <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>{lead.business} • ${(lead.value / 1000).toFixed(0)}K</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#FFCC33', fontSize: '0.75rem', fontWeight: 700 }}>{lead.score}</div>
                  <div style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.55rem' }}>score</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Unread Messages */}
        <Card title="Unread Messages" action={<Link href="/cockpit/inbox" style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.7rem', textDecoration: 'none' }}>Inbox →</Link>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {recentMessages.map(msg => (
              <div key={msg.id} style={{
                padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 600 }}>{msg.sender}</span>
                  <span style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.6rem' }}>{msg.channel}</span>
                </div>
                {msg.subject && <div style={{ color: 'rgba(255,204,51,0.6)', fontSize: '0.7rem', marginBottom: '0.15rem' }}>{msg.subject}</div>}
                <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.preview}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* AI Agent Status */}
        <Card title="AI Agents" action={<Link href="/cockpit/agents" style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.7rem', textDecoration: 'none' }}>Control Panel →</Link>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {seedAgents.slice(0, 5).map(agent => (
              <div key={agent.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.5rem 0.6rem', background: 'rgba(0,0,0,0.1)', borderRadius: 6,
              }}>
                <span style={{ fontSize: '0.9rem' }}>🤖</span>
                <span style={{ flex: 1, color: '#e2e8f0', fontSize: '0.75rem' }}>{agent.name}</span>
                <StatusBadge status={agent.status} />
              </div>
            ))}
          </div>
        </Card>

        {/* Active Clients */}
        <Card title="Active Clients" action={<Link href="/cockpit/clients" style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.7rem', textDecoration: 'none' }}>CRM →</Link>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {seedClients.filter(c => c.status === 'active').map(client => (
              <div key={client.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.5rem 0.6rem', background: 'rgba(0,0,0,0.1)', borderRadius: 6,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'rgba(255,204,51,0.1)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#FFCC33', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                }}>
                  {client.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 500 }}>{client.name}</div>
                  <div style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.6rem' }}>{client.business}</div>
                </div>
                <span style={{ color: '#00A980', fontSize: '0.7rem', fontWeight: 600 }}>${(client.revenue / 1000).toFixed(0)}K</span>
              </div>
            ))}
          </div>
        </Card>

        {/* System Alerts */}
        <Card title="System Alerts">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {failedAutos.length > 0 ? failedAutos.map(a => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.6rem', background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.15)', borderRadius: 6,
              }}>
                <span style={{ color: '#EF4444' }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#EF4444', fontSize: '0.75rem', fontWeight: 500 }}>{a.name}</div>
                  <div style={{ color: 'rgba(239,68,68,0.6)', fontSize: '0.6rem' }}>{a.configWarning || 'Automation failed'}</div>
                </div>
              </div>
            )) : (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(0,169,128,0.6)', fontSize: '0.75rem' }}>
                ✅ All systems operational
              </div>
            )}
            {errorAgents.length > 0 && errorAgents.map(a => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.6rem', background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.15)', borderRadius: 6,
              }}>
                <span>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#F59E0B', fontSize: '0.75rem', fontWeight: 500 }}>{a.name}: {a.errorCount} error{a.errorCount > 1 ? 's' : ''}</div>
                  {a.configWarning && <div style={{ color: 'rgba(245,158,11,0.6)', fontSize: '0.6rem' }}>{a.configWarning}</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* AI Recommendation */}
      <div style={{
        marginTop: '1.5rem', padding: '1.25rem',
        background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(14,52,112,0.3))',
        border: '1px solid rgba(168,85,247,0.15)', borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span>🧠</span>
          <span style={{ color: '#A855F7', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>AI Recommendation</span>
        </div>
        <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.85rem', lineHeight: 1.6 }}>
          <strong style={{ color: '#FFCC33' }}>Priority:</strong> Carlos Mendez (Mendez Capital) is in the Negotiation stage with a $1.2M deal value and 85% probability. 
          Consider finalizing terms this week. Also, Fatima Al-Rahman has a high lead score (88) — send the custom proposal today to maintain momentum.
        </p>
      </div>
    </div>
  )
}
