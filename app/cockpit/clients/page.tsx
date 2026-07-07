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

      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="m-0 text-text-primary text-2xl font-bold">Client CRM</h1>
          <p className="mt-1 mb-0 text-text-secondary text-xs">
            {statusCounts.active} active • ${(clients.reduce((s, c) => s + c.revenue, 0) / 1000).toFixed(0)}K total revenue
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="w-60"><SearchInput value={search} onChange={setSearch} placeholder="Search clients..." /></div>
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

      <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4 mt-4">
        {filtered.map(client => (
          <div
            key={client.id}
            onClick={() => setSelectedClient(client)}
            className="bg-surface-raised border border-border rounded-xl p-5 cursor-pointer transition-all duration-200 hover:border-border-strong"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent/15 to-surface-raised flex items-center justify-center text-accent text-[0.7rem] font-bold flex-shrink-0">
                  {client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div className="text-text-primary text-sm font-semibold">{client.name}</div>
                  <div className="text-text-muted text-[0.65rem] mt-0.5">{client.business}</div>
                </div>
              </div>
              <StatusBadge status={client.status} size="md" />
            </div>

            <div className="flex gap-5 text-[0.7rem] text-text-secondary mt-3">
              <span>💰 ${(client.revenue / 1000).toFixed(0)}K</span>
              {client.email && <span>📧 {client.email}</span>}
              {client.nextFollowUp && <span>📅 {client.nextFollowUp}</span>}
            </div>

            {client.notes && (
              <p className="mt-2 mb-0 text-text-muted text-[0.7rem] leading-relaxed overflow-hidden text-ellipsis whitespace-nowrap">
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
            <div className="flex gap-4 mb-4 flex-wrap">
              <StatusBadge status={selectedClient.status} size="md" />
              <span className="text-text-secondary text-xs">{selectedClient.business}</span>
              <span className="text-status-success text-xs font-semibold">${(selectedClient.revenue / 1000).toFixed(0)}K revenue</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Card title="Email"><span className="text-text-primary text-xs">{selectedClient.email || 'Not set'}</span></Card>
              <Card title="Phone"><span className="text-text-primary text-xs">{selectedClient.phone || 'Not set'}</span></Card>
            </div>
            {selectedClient.notes && (
              <Card title="Notes"><p className="text-text-primary text-xs m-0 leading-relaxed">{selectedClient.notes}</p></Card>
            )}
            {selectedClient.nextFollowUp && (
              <div className="mt-2 text-text-secondary text-xs">
                📅 Next follow-up: {selectedClient.nextFollowUp}
              </div>
            )}
            <div className="flex gap-1.5 mt-4">
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
        <div className="flex flex-col gap-3">
          {[
            { label: 'Name *', value: newName, set: setNewName, placeholder: 'Client name' },
            { label: 'Business', value: newBusiness, set: setNewBusiness, placeholder: 'Company or business name' },
            { label: 'Email', value: newEmail, set: setNewEmail, placeholder: 'email@example.com' },
            { label: 'Phone', value: newPhone, set: setNewPhone, placeholder: '+1 (555) 123-4567' },
            { label: 'Source', value: newSource, set: setNewSource, placeholder: 'Referral, LinkedIn, etc.' },
          ].map(field => (
            <div key={field.label}>
              <label className="block text-text-secondary text-[0.7rem] mb-1 font-medium">{field.label}</label>
              <input
                value={field.value}
                onChange={e => field.set(e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3 py-2.5 bg-black/20 border border-border rounded-lg text-text-primary text-sm outline-none font-[inherit] box-border"
              />
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <ActionButton label={createMutation.isPending ? 'Creating...' : 'Create Client'} variant="primary" size="md" onClick={handleCreate} />
            <ActionButton label="Cancel" variant="ghost" size="md" onClick={() => setShowCreate(false)} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
