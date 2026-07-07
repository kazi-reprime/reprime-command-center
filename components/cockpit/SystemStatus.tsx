'use client'

import React from 'react'
import { useCockpitQuery } from '@/hooks/useCockpitData'

interface HealthStatus {
  database: 'connected' | 'error' | 'unconfigured'
  whatsapp: 'connected' | 'error' | 'unconfigured'
  gmail: 'connected' | 'error' | 'unconfigured'
  pipedrive: 'connected' | 'error' | 'unconfigured'
  anthropic: 'connected' | 'error' | 'unconfigured'
}

export default function SystemStatus() {
  const { data, isLoading } = useCockpitQuery<HealthStatus>('system-health', '/api/cockpit/health')
  const status = data?.data

  const getStatusColor = (s?: string) => {
    switch (s) {
      case 'connected': return 'var(--status-success)'
      case 'error': return 'var(--status-error)'
      case 'unconfigured': return 'var(--status-warning)'
      default: return 'var(--text-muted)'
    }
  }

  const getStatusLabel = (s?: string) => {
    if (isLoading) return 'Scanning...'
    switch (s) {
      case 'connected': return 'Operational'
      case 'error': return 'Failed'
      case 'unconfigured': return 'Offline'
      default: return 'Searching'
    }
  }

  const services = [
    { id: 'whatsapp', label: 'WhatsApp', status: status?.whatsapp },
    { id: 'gmail', label: 'Gmail', status: status?.gmail },
    { id: 'pipedrive', label: 'Pipedrive', status: status?.pipedrive },
    { id: 'database', label: 'Database', status: status?.database },
    { id: 'anthropic', label: 'Anthropic', status: status?.anthropic },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.65rem', fontFamily: 'inherit' }}>
      {services.map((svc) => (
        <div key={svc.id} style={{ 
          padding: '0.5rem 0.75rem', 
          background: 'var(--surface-soft)', 
          borderRadius: 12, 
          color: 'var(--text-main)', 
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid var(--border-main)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{svc.label}</span>
          <span style={{ 
            color: getStatusColor(svc.status),
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: getStatusColor(svc.status) }} />
            {getStatusLabel(svc.status)}
          </span>
        </div>
      ))}
    </div>
  )
}
