'use client'

import React, { useState } from 'react'
import { Card, StatusBadge, ActionButton, SearchInput, TabGroup, EmptyState } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useCockpitQuery, useCockpitMutation } from '@/hooks/useCockpitData'
import { useToast } from '@/lib/contexts/ToastContext'


interface CockpitAutomation {
  id: string; name: string; trigger: string; action: string;
  status: 'active' | 'paused' | 'error';
  executionCount: number; failureCount: number;
  lastRun: string | null; configWarning: string | null;
}

export default function AutomationsPage() {
  const { addToast } = useToast()
  const automationsQ = useCockpitQuery<CockpitAutomation[]>('automations', '/api/cockpit/automations')
  const toggleMutation = useCockpitMutation<{ id: string; action: string }>('/api/cockpit/automations', {
    method: 'PATCH',
    invalidateKeys: ['automations'],
  })

  const automations = automationsQ.data?.data ?? []
  const dataSource = automationsQ.data?.source ?? 'unavailable'
  const dataWarning = automationsQ.data?.warning
  
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const handleToggle = (id: string, action: 'enable' | 'disable' | 'retry') => {
    toggleMutation.mutate({ id, action }, {
      onSuccess: () => {
        addToast(`Automation ${action === 'enable' ? 'enabled' : action === 'disable' ? 'disabled' : 'retried'} successfully`, 'success')
      },
      onError: () => {
        addToast(`Failed to ${action} automation`, 'error')
      },
    })
  }

  const filtered = automations.filter(a => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filter !== 'all' && a.status !== filter) return false
    return true
  })

  if (automationsQ.isLoading) return <LoadingState message="Loading automations..." />

  return (
    <div>
      <DataSourceBanner source={dataSource} warning={dataWarning} />

      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="m-0 text-text-primary text-2xl font-bold">Automation Hub</h1>
          <p className="mt-1 mb-0 text-text-secondary text-xs">
            {automations.filter(a => a.status === 'active').length} active • {automations.filter(a => a.status === 'error').length} errors
          </p>
        </div>
        <div className="w-60"><SearchInput value={search} onChange={setSearch} placeholder="Search automations..." /></div>
      </div>

      <div className="mb-4">
        <TabGroup
          tabs={[
            { key: 'all', label: 'All', count: automations.length },
            { key: 'active', label: 'Active', count: automations.filter(a => a.status === 'active').length },
            { key: 'paused', label: 'Paused', count: automations.filter(a => a.status === 'paused').length },
            { key: 'error', label: 'Errors', count: automations.filter(a => a.status === 'error').length },
          ]}
          active={filter}
          onChange={setFilter}
        />
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map(auto => (
          <div key={auto.id} className="bg-surface-raised border border-border rounded-[10px] p-4 px-5" style={{
            borderLeftWidth: 3,
            borderLeftColor: auto.status === 'active' ? '#00A980' : auto.status === 'error' ? '#EF4444' : auto.status === 'paused' ? '#F59E0B' : '#6B7280',
          }}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-text-primary text-sm font-semibold">{auto.name}</div>
                <div className="text-text-muted text-[0.7rem] mt-0.5">Trigger: {auto.trigger}</div>
              </div>
              <StatusBadge status={auto.status} size="md" />
            </div>

            <div className="flex gap-6 mb-3 text-[0.7rem] text-text-secondary flex-wrap">
              <span>🔄 Executed: {auto.executionCount}</span>
              <span className={auto.failureCount > 0 ? 'text-status-error' : ''}>❌ Failures: {auto.failureCount}</span>
              {auto.lastRun && <span>🕐 Last run: {new Date(auto.lastRun).toLocaleString()}</span>}
            </div>

            {auto.configWarning && (
              <div className="px-2.5 py-1.5 bg-status-warning/10 border border-status-warning/15 rounded-md mb-2">
                <span className="text-status-warning text-[0.7rem]">⚠️ {auto.configWarning}</span>
              </div>
            )}

            <div className="flex gap-1.5">
              {auto.status === 'active' && <ActionButton label="Disable" onClick={() => handleToggle(auto.id, 'disable')} variant="ghost" />}
              {auto.status === 'paused' && <ActionButton label="Enable" onClick={() => handleToggle(auto.id, 'enable')} variant="default" />}
              {auto.status === 'error' && <ActionButton label="Retry" onClick={() => handleToggle(auto.id, 'retry')} variant="danger" />}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <EmptyState icon="⚡" title="No automations found" description="Create system triggers to automate your workflow." />}
      </div>
    </div>
  )
}
