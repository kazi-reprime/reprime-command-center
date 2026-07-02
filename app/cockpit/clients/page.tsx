'use client'

import React, { useState } from 'react'
import { Card, StatusBadge, ActionButton, SearchInput, TabGroup, Modal, FormInput, FormSelect, FormTextarea, DataTable, EmptyState } from '@/components/ui/shared'
import { seedClients, type SeedClient } from '@/lib/data/seed'

export default function ClientsPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [clients, setClients] = useState(seedClients)
  const [selectedClient, setSelectedClient] = useState<SeedClient | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', business: '', email: '', phone: '', source: '', notes: '', status: 'active' })

  const filtered = clients.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.business.toLowerCase().includes(search.toLowerCase())) return false
    if (filter !== 'all' && c.status !== filter) return false
    return true
  })

  const handleCreate = () => {
    if (!form.name) return
    const newClient: SeedClient = {
      id: `c${Date.now()}`, ...form,
      status: form.status as SeedClient['status'],
      revenue: 0, nextFollowUp: null,
      createdAt: new Date().toISOString().split('T')[0],
    }
    setClients(prev => [newClient, ...prev])
    setShowCreate(false)
    setForm({ name: '', business: '', email: '', phone: '', source: '', notes: '', status: 'active' })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Client CRM</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>{clients.length} clients • ${(clients.reduce((s, c) => s + c.revenue, 0) / 1000).toFixed(0)}K total revenue</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ width: 240 }}><SearchInput value={search} onChange={setSearch} placeholder="Search clients..." /></div>
          <ActionButton label="+ Add Client" onClick={() => setShowCreate(true)} variant="primary" size="md" />
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <TabGroup
          tabs={[
            { key: 'all', label: 'All', count: clients.length },
            { key: 'active', label: 'Active', count: clients.filter(c => c.status === 'active').length },
            { key: 'onboarding', label: 'Onboarding', count: clients.filter(c => c.status === 'onboarding').length },
            { key: 'paused', label: 'Paused', count: clients.filter(c => c.status === 'paused').length },
            { key: 'churned', label: 'Churned', count: clients.filter(c => c.status === 'churned').length },
          ]}
          active={filter}
          onChange={setFilter}
        />
      </div>

      <Card noPad>
        <DataTable
          data={filtered}
          columns={[
            { key: 'name', label: 'Client', render: (row) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,204,51,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFCC33', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>
                  {(row.name as string).split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#fff' }}>{row.name as string}</div>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255,204,51,0.4)' }}>{row.business as string}</div>
                </div>
              </div>
            )},
            { key: 'email', label: 'Contact', render: (row) => (
              <div>
                <div style={{ fontSize: '0.75rem' }}>{row.email as string}</div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,204,51,0.4)' }}>{row.phone as string}</div>
              </div>
            )},
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status as string} /> },
            { key: 'revenue', label: 'Revenue', render: (row) => <span style={{ color: '#00A980', fontWeight: 600 }}>${((row.revenue as number) / 1000).toFixed(0)}K</span> },
            { key: 'source', label: 'Source' },
            { key: 'nextFollowUp', label: 'Next Follow-Up', render: (row) => (
              <span style={{ color: row.nextFollowUp ? '#e2e8f0' : 'rgba(255,204,51,0.3)', fontSize: '0.75rem' }}>
                {row.nextFollowUp ? new Date(row.nextFollowUp as string).toLocaleDateString() : '—'}
              </span>
            )},
          ]}
          onRowClick={(row) => setSelectedClient(row as unknown as SeedClient)}
          emptyMessage="No clients found"
        />
      </Card>

      {/* Client Detail Modal */}
      <Modal isOpen={!!selectedClient} onClose={() => setSelectedClient(null)} title={selectedClient?.name || ''} width={640}>
        {selectedClient && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Business</span>
                <div style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{selectedClient.business}</div>
              </div>
              <div>
                <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Status</span>
                <div><StatusBadge status={selectedClient.status} size="md" /></div>
              </div>
              <div>
                <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Email</span>
                <div style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{selectedClient.email}</div>
              </div>
              <div>
                <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Phone</span>
                <div style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{selectedClient.phone}</div>
              </div>
              <div>
                <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Revenue</span>
                <div style={{ color: '#00A980', fontSize: '1.1rem', fontWeight: 700 }}>${selectedClient.revenue.toLocaleString()}</div>
              </div>
              <div>
                <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Source</span>
                <div style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{selectedClient.source}</div>
              </div>
            </div>
            <Card title="Notes">
              <p style={{ color: '#e2e8f0', fontSize: '0.8rem', margin: 0, lineHeight: 1.6 }}>{selectedClient.notes}</p>
            </Card>
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.1)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <span>🧠</span>
                <span style={{ color: '#A855F7', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}>AI Summary</span>
              </div>
              <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.8rem', lineHeight: 1.5 }}>
                {selectedClient.name} from {selectedClient.business} has been a {selectedClient.status} client since {selectedClient.createdAt}. 
                Total revenue: ${selectedClient.revenue.toLocaleString()}. {selectedClient.nextFollowUp ? `Next follow-up scheduled for ${selectedClient.nextFollowUp}.` : 'No follow-up scheduled.'}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Client Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add New Client">
        <FormInput label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required placeholder="Full name" />
        <FormInput label="Business" value={form.business} onChange={v => setForm(f => ({ ...f, business: v }))} placeholder="Company name" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <FormInput label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" placeholder="email@example.com" />
          <FormInput label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+1..." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <FormInput label="Source" value={form.source} onChange={v => setForm(f => ({ ...f, source: v }))} placeholder="Referral, Website..." />
          <FormSelect label="Status" value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={[
            { value: 'active', label: 'Active' }, { value: 'onboarding', label: 'Onboarding' },
            { value: 'paused', label: 'Paused' }, { value: 'churned', label: 'Churned' },
          ]} />
        </div>
        <FormTextarea label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="Notes about this client..." />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <ActionButton label="Cancel" onClick={() => setShowCreate(false)} variant="ghost" size="md" />
          <ActionButton label="Create Client" onClick={handleCreate} variant="primary" size="md" disabled={!form.name} />
        </div>
      </Modal>
    </div>
  )
}
