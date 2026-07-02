'use client'

import React, { useState } from 'react'
import { Card, StatusBadge, ActionButton, SearchInput, TabGroup, EmptyState } from '@/components/ui/shared'
import { LoadingState } from '@/components/ui/LiveStatus'
import { useCockpitQuery, useCockpitMutation } from '@/hooks/useCockpitData'
// Seed data removed — live data only
import { useToast } from '@/lib/contexts/ToastContext'
import { useRouter } from 'next/navigation'

export default function AutomationsPage() {
  const { addToast } = useToast()
  const router = useRouter()
  const automationsQ = useCockpitQuery<any[]>('automations', '/api/cockpit/automations')
  const toggleMutation = useCockpitMutation<{ id: string; action: string }>('/api/cockpit/automations', {
    method: 'PATCH',
    invalidateKeys: ['automations'],
  })

  const automations = automationsQ.data?.data ?? []
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const handleToggle = (id: string, action: 'enable' | 'disable' | 'retry') => {
    toggleMutation.mutate({ id, action })
    addToast(`Automation ${action === 'enable' ? 'enabled' : action === 'disable' ? 'disabled' : 'retried'} successfully`, 'success')
  }

  const filtered = automations.filter(a => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filter !== 'all' && a.status !== filter) return false
    return true
  })

  if (automationsQ.isLoading) return <LoadingState message="Loading automations..." />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Automation Hub</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
            {automations.filter(a => a.status === 'active').length} active • {automations.filter(a => a.status === 'error').length} errors
          </p>
        </div>
        <div style={{ width: 240 }}><SearchInput value={search} onChange={setSearch} placeholder="Search automations..." /></div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <TabGroup
          tabs={[
            { key: 'all', label: 'All', count: automations.length },
            { key: 'active', label: 'Active', count: automations.filter(a => a.status === 'active').length },
            { key: 'paused', label: 'Paused', count: automations.filter(a => a.status === 'paused').length },
            { key: 'error', label: 'Errors', count: automations.filter(a => a.status === 'error').length },
            { key: 'not_configured', label: 'Not Configured', count: automations.filter(a => a.status === 'not_configured').length },
          ]}
          active={filter}
          onChange={setFilter}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filtered.map(auto => (
          <div key={auto.id} style={{
            background: 'rgba(14,52,112,0.4)', border: '1px solid rgba(255,204,51,0.06)',
            borderRadius: 10, padding: '1rem 1.25rem',
            borderLeftWidth: 3,
            borderLeftColor: auto.status === 'active' ? '#00A980' : auto.status === 'error' ? '#EF4444' : auto.status === 'paused' ? '#F59E0B' : '#6B7280',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div>
                <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>{auto.name}</div>
                <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.7rem', marginTop: '0.15rem' }}>{auto.description}</div>
              </div>
              <StatusBadge status={auto.status} size="md" />
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', fontSize: '0.7rem', color: 'rgba(255,204,51,0.5)', flexWrap: 'wrap' }}>
              <span>⚡ Trigger: {auto.trigger}</span>
              <span>✅ Success: {auto.successCount}</span>
              <span style={{ color: auto.failureCount > 0 ? '#EF4444' : 'inherit' }}>❌ Failures: {auto.failureCount}</span>
              {auto.lastRun && <span>🕐 Last: {new Date(auto.lastRun).toLocaleString()}</span>}
              {auto.nextRun && <span>⏭️ Next: {new Date(auto.nextRun).toLocaleString()}</span>}
            </div>

            {auto.configWarning && (
              <div style={{ padding: '0.4rem 0.6rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 6, marginBottom: '0.5rem' }}>
                <span style={{ color: '#F59E0B', fontSize: '0.7rem' }}>⚠️ {auto.configWarning}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {auto.status === 'active' && <ActionButton label="Disable" onClick={() => handleToggle(auto.id, 'disable')} variant="ghost" />}
              {auto.status === 'paused' && <ActionButton label="Enable" onClick={() => handleToggle(auto.id, 'enable')} variant="default" />}
              {auto.status === 'error' && <ActionButton label="Retry" onClick={() => handleToggle(auto.id, 'retry')} variant="danger" />}
              {auto.status === 'not_configured' && <ActionButton label="Configure" onClick={() => router.push('/cockpit/settings')} variant="default" />}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <EmptyState icon="⚡" title="No automations found" />}
      </div>
    </div>
  )
}
