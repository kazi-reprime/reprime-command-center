'use client'

import React, { useState } from 'react'
import { Card, StatusBadge, ActionButton, SearchInput, TabGroup, EmptyState } from '@/components/ui/shared'
import { seedAutomations } from '@/lib/data/seed'

export default function AutomationsPage() {
  const [automations, setAutomations] = useState(seedAutomations)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const toggleAuto = (id: string, action: 'enable' | 'disable' | 'retry') => {
    setAutomations(prev => prev.map(a => {
      if (a.id !== id) return a
      if (action === 'enable') return { ...a, status: 'active' as const }
      if (action === 'disable') return { ...a, status: 'paused' as const }
      if (action === 'retry') return { ...a, status: 'active' as const, failureCount: 0, configWarning: null }
      return a
    }))
  }

  const filtered = automations.filter(a => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filter !== 'all' && a.status !== filter) return false
    return true
  })

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
              {auto.status === 'active' && <ActionButton label="Disable" onClick={() => toggleAuto(auto.id, 'disable')} variant="ghost" />}
              {auto.status === 'paused' && <ActionButton label="Enable" onClick={() => toggleAuto(auto.id, 'enable')} variant="default" />}
              {auto.status === 'error' && <ActionButton label="Retry" onClick={() => toggleAuto(auto.id, 'retry')} variant="danger" />}
              {auto.status === 'not_configured' && <ActionButton label="Configure" onClick={() => {}} variant="default" />}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <EmptyState icon="⚡" title="No automations found" />}
      </div>
    </div>
  )
}
