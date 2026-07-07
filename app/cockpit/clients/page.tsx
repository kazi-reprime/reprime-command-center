'use client'

import React, { useState, useMemo } from 'react'
import { Card, StatusBadge, ActionButton, SearchInput, TabGroup, Modal, EmptyState } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useCockpitQuery, useCockpitMutation } from '@/hooks/useCockpitData'
// Seed data removed — live data only
import { useToast } from '@/lib/contexts/ToastContext'

export default function ClientsPage() {
  const { addToast } = useToast()
  const clientsQ = useCockpitQuery<any[]>('clients', '/api/cockpit/clients')
  const createMutation = useCockpitMutation<any>('/api/cockpit/clients', {
    invalidateKeys: ['clients'],
    successMessage: 'Client created successfully',
  })

  const clients = clientsQ.data?.data ?? []
  const dataSource = clientsQ.data?.source ?? 'unavailable'
  const dataWarning = clientsQ.data?.warning

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedClient, setSelectedClient] = useState<any | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Create form state
  const [newName, setNewName] = useState('')
  const [newBusiness, setNewBusiness] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newSource, setNewSource] = useState('')

  const filtered = useMemo(() => clients.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.business.toLowerCase().includes(search.toLowerCase())) return false
    if (filter !== 'all' && c.status !== filter) return false
    return true
  }), [clients, search, filter])

  const statusCounts = useMemo(() => ({
    all: clients.length,
    active: clients.filter(c => c.status === 'active').length,
    onboarding: clients.filter(c => c.status === 'onboarding').length,
    churned: clients.filter(c => c.status === 'churned').length,
  }), [clients])

  const handleCreate = () => {
    if (!newName.trim()) {
      addToast('Name is required', 'error')
      return
    }
    createMutation.mutate({
      name: newName.trim(),
      business: newBusiness.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim(),
      source: newSource.trim(),
      status: 'active' as const,
      notes: '',
      nextFollowUp: null,
    })
    setShowCreate(false)
    setNewName(''); setNewBusiness(''); setNewEmail(''); setNewPhone(''); setNewSource('')
  }

  if (clientsQ.isLoading) return <LoadingState message="Loading clients..." />

  return (
    <div>
      <DataSourceBanner source={dataSource} warning={dataWarning} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Client CRM</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
            {statusCounts.active} active • ${(clients.reduce((s, c) => s + c.revenue, 0) / 1000).toFixed(0)}K total revenue
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ width: 240 }}><SearchInput value={search} onChange={setSearch} placeholder="Search clients..." /></div>
          <ActionButton label="+ New Client" variant="primary" size="md" onClick={() => setShowCreate(true)} />
        </div>
      </div>

      <TabGroup
        tabs={[
          { key: 'all', label: 'All', count: statusCounts.all },
          { key: 'active', label: 'Active', count: statusCounts.active },
          { key: 'onboarding', label: 'Onboarding', count: statusCounts.onboarding },
          { key: 'churned', label: 'Churned', count: statusCounts.churned },
        ]}
        active={filter}
        onChange={setFilter}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        {filtered.map(client => (
          <div
            key={client.id}
            onClick={() => setSelectedClient(client)}
            style={{
              background: 'rgba(14,52,112,0.4)', border: '1px solid rgba(255,204,51,0.08)',
              borderRadius: 12, padding: '1.25rem', cursor: 'pointer',
              transition: 'all 200ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,204,51,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,204,51,0.08)')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(255,204,51,0.15), rgba(14,52,112,0.5))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#FFCC33', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
                }}>
                  {client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>{client.name}</div>
                  <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem', marginTop: '0.1rem' }}>{client.business}</div>
                </div>
              </div>
              <StatusBadge status={client.status} size="md" />
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.7rem', color: 'rgba(255,204,51,0.5)', marginTop: '0.75rem' }}>
              <span>💰 ${(client.revenue / 1000).toFixed(0)}K</span>
              {client.email && <span>📧 {client.email}</span>}
              {client.nextFollowUp && <span>📅 {client.nextFollowUp}</span>}
            </div>

            {client.notes && (
              <p style={{ margin: '0.5rem 0 0', color: 'rgba(255,204,51,0.35)', fontSize: '0.7rem', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {client.notes}
              </p>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && <EmptyState icon="👥" title="No clients found" description="Try adjusting your filters or create a new client." />}

      {/* Client Detail Modal */}
      <Modal isOpen={!!selectedClient} onClose={() => setSelectedClient(null)} title={selectedClient?.name || ''} width={640}>
        {selectedClient && (
          <div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <StatusBadge status={selectedClient.status} size="md" />
              <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.75rem' }}>{selectedClient.business}</span>
              <span style={{ color: '#00A980', fontSize: '0.75rem', fontWeight: 600 }}>${(selectedClient.revenue / 1000).toFixed(0)}K revenue</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
              <Card title="Email"><span style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>{selectedClient.email || 'Not set'}</span></Card>
              <Card title="Phone"><span style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>{selectedClient.phone || 'Not set'}</span></Card>
            </div>
            {selectedClient.notes && (
              <Card title="Notes"><p style={{ color: '#e2e8f0', fontSize: '0.8rem', margin: 0, lineHeight: 1.6 }}>{selectedClient.notes}</p></Card>
            )}
            {selectedClient.nextFollowUp && (
              <div style={{ marginTop: '0.5rem', color: 'rgba(255,204,51,0.5)', fontSize: '0.75rem' }}>
                📅 Next follow-up: {selectedClient.nextFollowUp}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '1rem' }}>
              <ActionButton label="Send Email" variant="primary" size="md" onClick={() => addToast(
                process.env.NEXT_PUBLIC_SENDGRID_CONFIGURED === 'true'
                  ? 'Opening email composer...'
                  : 'Email not configured. Add SENDGRID_API_KEY to enable.',
                process.env.NEXT_PUBLIC_SENDGRID_CONFIGURED === 'true' ? 'info' : 'warning'
              )} />
              <ActionButton label="Schedule Call" variant="default" size="md" onClick={() => addToast('Calendar integration coming soon', 'info')} />
            </div>
          </div>
        )}
      </Modal>

      {/* Create Client Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Client" width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[
            { label: 'Name *', value: newName, set: setNewName, placeholder: 'Client name' },
            { label: 'Business', value: newBusiness, set: setNewBusiness, placeholder: 'Company or business name' },
            { label: 'Email', value: newEmail, set: setNewEmail, placeholder: 'email@example.com' },
            { label: 'Phone', value: newPhone, set: setNewPhone, placeholder: '+1 (555) 123-4567' },
            { label: 'Source', value: newSource, set: setNewSource, placeholder: 'Referral, LinkedIn, etc.' },
          ].map(field => (
            <div key={field.label}>
              <label style={{ display: 'block', color: 'rgba(255,204,51,0.6)', fontSize: '0.7rem', marginBottom: '0.25rem', fontWeight: 500 }}>{field.label}</label>
              <input
                value={field.value}
                onChange={e => field.set(e.target.value)}
                placeholder={field.placeholder}
                style={{
                  width: '100%', padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,204,51,0.1)', borderRadius: 8,
                  color: '#fff', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <ActionButton label={createMutation.isPending ? 'Creating...' : 'Create Client'} variant="primary" size="md" onClick={handleCreate} />
            <ActionButton label="Cancel" variant="ghost" size="md" onClick={() => setShowCreate(false)} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
