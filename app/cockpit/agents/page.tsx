'use client'

import React, { useState } from 'react'
import { Card, StatusBadge, ActionButton, SearchInput, TabGroup, Modal, EmptyState } from '@/components/ui/shared'
import { LoadingState } from '@/components/ui/LiveStatus'
import { useCockpitQuery, useCockpitMutation } from '@/hooks/useCockpitData'
import { seedAgents, type SeedAgent } from '@/lib/data/seed'

export default function AgentsPage() {
  const agentsQ = useCockpitQuery<SeedAgent[]>('agents', '/api/cockpit/agents')
  const toggleMutation = useCockpitMutation<{ id: string; action: string }>('/api/cockpit/agents', {
    method: 'PATCH',
    invalidateKeys: ['agents'],
  })

  const agents = agentsQ.data?.data ?? seedAgents
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedAgent, setSelectedAgent] = useState<SeedAgent | null>(null)

  const filtered = agents.filter(a => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filter !== 'all' && a.status !== filter) return false
    return true
  })

  const handleToggle = (id: string, action: 'pause' | 'resume' | 'retry') => {
    toggleMutation.mutate({ id, action })
  }

  if (agentsQ.isLoading) return <LoadingState message="Loading agents..." />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>AI Agent Control Panel</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
            {agents.filter(a => a.status === 'running').length} running • {agents.filter(a => a.status === 'error').length} errors • {agents.length} total
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ width: 240 }}><SearchInput value={search} onChange={setSearch} placeholder="Search agents..." /></div>
        </div>
      </div>

      <TabGroup
        tabs={[
          { key: 'all', label: 'All', count: agents.length },
          { key: 'running', label: 'Running', count: agents.filter(a => a.status === 'running').length },
          { key: 'paused', label: 'Paused', count: agents.filter(a => a.status === 'paused').length },
          { key: 'idle', label: 'Idle', count: agents.filter(a => a.status === 'idle').length },
          { key: 'error', label: 'Errors', count: agents.filter(a => a.status === 'error').length },
        ]}
        active={filter}
        onChange={setFilter}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        {filtered.map(agent => (
          <div
            key={agent.id}
            onClick={() => setSelectedAgent(agent)}
            style={{
              background: 'rgba(14,52,112,0.4)', border: '1px solid rgba(255,204,51,0.08)',
              borderRadius: 12, padding: '1.25rem', cursor: 'pointer',
              transition: 'all 200ms', borderLeftWidth: 3,
              borderLeftColor: agent.status === 'running' ? '#00A980' : agent.status === 'error' ? '#EF4444' : agent.status === 'paused' ? '#F59E0B' : 'rgba(255,204,51,0.08)',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,204,51,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,204,51,0.08)')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🤖</span>
                <div>
                  <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>{agent.name}</div>
                  <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem', marginTop: '0.1rem' }}>{agent.type}</div>
                </div>
              </div>
              <StatusBadge status={agent.status} size="md" />
            </div>

            <p style={{ margin: '0 0 0.75rem', color: 'rgba(255,204,51,0.5)', fontSize: '0.75rem', lineHeight: 1.4 }}>{agent.description}</p>

            {agent.currentTask && (
              <div style={{ padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.15)', borderRadius: 6, marginBottom: '0.75rem' }}>
                <span style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Task</span>
                <div style={{ color: '#e2e8f0', fontSize: '0.75rem', marginTop: '0.15rem' }}>{agent.currentTask}</div>
              </div>
            )}

            {agent.configWarning && (
              <div style={{ padding: '0.4rem 0.6rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 6, marginBottom: '0.75rem' }}>
                <span style={{ color: '#F59E0B', fontSize: '0.7rem' }}>⚠️ {agent.configWarning}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.65rem', color: 'rgba(255,204,51,0.4)' }}>
                <span>✅ {agent.successRate}%</span>
                <span>🔄 {agent.runsToday} today</span>
                {agent.errorCount > 0 && <span style={{ color: '#EF4444' }}>❌ {agent.errorCount}</span>}
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }} onClick={e => e.stopPropagation()}>
                {agent.status === 'running' && <ActionButton label="Pause" onClick={() => handleToggle(agent.id, 'pause')} variant="ghost" />}
                {agent.status === 'paused' && <ActionButton label="Resume" onClick={() => handleToggle(agent.id, 'resume')} variant="default" />}
                {agent.status === 'error' && <ActionButton label="Retry" onClick={() => handleToggle(agent.id, 'retry')} variant="danger" />}
                {agent.status === 'idle' && <ActionButton label="Run" onClick={() => handleToggle(agent.id, 'resume')} variant="primary" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && <EmptyState icon="🤖" title="No agents found" description="Try adjusting your filters." />}

      {/* Agent Detail Modal */}
      <Modal isOpen={!!selectedAgent} onClose={() => setSelectedAgent(null)} title={selectedAgent?.name || ''} width={640}>
        {selectedAgent && (
          <div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <StatusBadge status={selectedAgent.status} size="md" />
              <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.75rem' }}>Type: {selectedAgent.type}</span>
              <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.75rem' }}>Success: {selectedAgent.successRate}%</span>
              <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.75rem' }}>Runs today: {selectedAgent.runsToday}</span>
            </div>
            <p style={{ color: '#e2e8f0', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1rem' }}>{selectedAgent.description}</p>
            {selectedAgent.currentTask && (
              <Card title="Current Task"><p style={{ color: '#e2e8f0', fontSize: '0.8rem', margin: 0 }}>{selectedAgent.currentTask}</p></Card>
            )}
            <div style={{ marginTop: '1rem' }}>
              <Card title="Recent Activity Log">
                <div style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.75rem' }}>
                  <div style={{ padding: '0.4rem 0', borderBottom: '1px solid rgba(255,204,51,0.05)' }}>✅ {selectedAgent.lastRun ? new Date(selectedAgent.lastRun).toLocaleString() : 'Never'} — Last successful run</div>
                  <div style={{ padding: '0.4rem 0', borderBottom: '1px solid rgba(255,204,51,0.05)' }}>🔄 {selectedAgent.runsToday} operations completed today</div>
                  {selectedAgent.errorCount > 0 && <div style={{ padding: '0.4rem 0', color: '#EF4444' }}>❌ {selectedAgent.errorCount} error(s) logged</div>}
                </div>
              </Card>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              {selectedAgent.status === 'running' && <ActionButton label="Pause Agent" onClick={() => { handleToggle(selectedAgent.id, 'pause'); setSelectedAgent(null) }} variant="default" size="md" />}
              {selectedAgent.status === 'paused' && <ActionButton label="Resume Agent" onClick={() => { handleToggle(selectedAgent.id, 'resume'); setSelectedAgent(null) }} variant="primary" size="md" />}
              {selectedAgent.status === 'error' && <ActionButton label="Retry" onClick={() => { handleToggle(selectedAgent.id, 'retry'); setSelectedAgent(null) }} variant="danger" size="md" />}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
