'use client'

import React, { useState } from 'react'
import { Card, StatusBadge, ActionButton, SearchInput, TabGroup, Modal, EmptyState } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useCockpitQuery, useCockpitMutation } from '@/hooks/useCockpitData'

interface CockpitAgent {
  id: string; name: string; type: string; status: 'running' | 'paused' | 'error' | 'idle';
  currentTask: string | null; completedToday: number; errorCount: number;
  lastActive: string; uptime: string;
  description?: string; // Optional field if we add it to DB later
}

export default function AgentsPage() {
  const agentsQ = useCockpitQuery<CockpitAgent[]>('agents', '/api/cockpit/agents')
  const toggleMutation = useCockpitMutation<{ id: string; action: string }>('/api/cockpit/agents', {
    method: 'PATCH',
    invalidateKeys: ['agents'],
  })

  const agents = agentsQ.data?.data ?? []
  const dataSource = agentsQ.data?.source ?? 'unavailable'
  const dataWarning = agentsQ.data?.warning
  
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedAgent, setSelectedAgent] = useState<CockpitAgent | null>(null)

  const filtered = agents.filter(a => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filter !== 'all' && a.status !== filter) return false
    return true
  })

  const handleToggle = (id: string, action: 'pause' | 'resume' | 'retry') => {
    toggleMutation.mutate({ id, action })
  }

  if (agentsQ.isLoading) return <LoadingState message="Loading AI agents..." />

  return (
    <div>
      <DataSourceBanner source={dataSource} warning={dataWarning} />

      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="m-0 text-text-primary text-2xl font-bold">AI Agent Control Panel</h1>
          <p className="mt-1 mb-0 text-text-secondary text-sm">
            {agents.filter(a => a.status === 'running').length} running • {agents.filter(a => a.status === 'error').length} errors • {agents.length} total
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="w-60"><SearchInput value={search} onChange={setSearch} placeholder="Search agents..." /></div>
        </div>
      </div>

      <TabGroup
        tabs={[
          { key: 'all', label: 'All', count: agents.length },
          { key: 'running', label: 'Running', count: agents.filter(a => a.status === 'running').length },
          { key: 'paused', label: 'Paused', count: agents.filter(a => a.status === 'paused').length },
          { key: 'error', label: 'Errors', count: agents.filter(a => a.status === 'error').length },
        ]}
        active={filter}
        onChange={setFilter}
      />

      <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        {filtered.map(agent => (
          <div
            key={agent.id}
            onClick={() => setSelectedAgent(agent)}
            className="bg-surface border border-border rounded-xl p-5 cursor-pointer transition-all duration-200"
            style={{
              borderLeftWidth: 3,
              borderLeftColor: agent.status === 'running' ? '#00A980' : agent.status === 'error' ? '#EF4444' : agent.status === 'paused' ? '#F59E0B' : 'rgba(255,204,51,0.08)',
            }}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🤖</span>
                <div>
                  <div className="text-text-primary text-[0.9rem] font-semibold">{agent.name}</div>
                  <div className="text-text-secondary text-[0.65rem] mt-0.5">{agent.type}</div>
                </div>
              </div>
              <StatusBadge status={agent.status} size="md" />
            </div>

            {agent.currentTask && (
              <div className="p-2.5 bg-surface-hover rounded-md mb-3">
                <span className="text-text-muted text-[0.6rem] uppercase tracking-wide">Current Task</span>
                <div className="text-text-primary text-xs mt-0.5">{agent.currentTask}</div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <div className="flex gap-4 text-[0.65rem] text-text-secondary">
                <span>🔄 {agent.completedToday} today</span>
                {agent.errorCount > 0 && <span className="text-status-error">❌ {agent.errorCount}</span>}
                <span>⚡ {agent.uptime}</span>
              </div>
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                {agent.status === 'running' && <ActionButton label="Pause" onClick={() => handleToggle(agent.id, 'pause')} variant="ghost" />}
                {agent.status === 'paused' && <ActionButton label="Resume" onClick={() => handleToggle(agent.id, 'resume')} variant="default" />}
                {agent.status === 'error' && <ActionButton label="Retry" onClick={() => handleToggle(agent.id, 'retry')} variant="danger" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && <EmptyState icon="🤖" title="No agents found" description="Add AI agents to your workforce in Settings." />}

      {/* Agent Detail Modal */}
      <Modal isOpen={!!selectedAgent} onClose={() => setSelectedAgent(null)} title={selectedAgent?.name || ''} width={640}>
        {selectedAgent && (
          <div>
            <div className="flex gap-4 mb-4 flex-wrap">
              <StatusBadge status={selectedAgent.status} size="md" />
              <span className="text-text-secondary text-xs">Type: {selectedAgent.type}</span>
              <span className="text-text-secondary text-xs">Runs today: {selectedAgent.completedToday}</span>
              <span className="text-text-secondary text-xs">Uptime: {selectedAgent.uptime}</span>
            </div>
            {selectedAgent.currentTask && (
              <Card title="Current Task"><p className="text-text-primary text-sm m-0">{selectedAgent.currentTask}</p></Card>
            )}
            <div className="mt-4">
              <Card title="Diagnostics">
                <div className="text-text-secondary text-xs">
                  <div className="py-1.5 border-b border-border">🕒 Last active: {new Date(selectedAgent.lastActive).toLocaleString()}</div>
                  <div className="py-1.5 border-b border-border">🔄 {selectedAgent.completedToday} operations completed today</div>
                  {selectedAgent.errorCount > 0 && <div className="py-1.5 text-status-error">❌ {selectedAgent.errorCount} error(s) logged in last 24h</div>}
                </div>
              </Card>
            </div>
            <div className="flex gap-2 mt-4">
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
