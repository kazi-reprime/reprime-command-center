'use client'

import React, { useState, useMemo } from 'react'
import { Card, StatusBadge, ActionButton, SearchInput, TabGroup, Modal, EmptyState, PriorityBadge } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useCockpitQuery, useCockpitMutation } from '@/hooks/useCockpitData'
// Seed data removed — live data only
import { useToast } from '@/lib/contexts/ToastContext'

const STAGES: { key: SeedLead['stage']; label: string; color: string }[] = [
  { key: 'new', label: 'New', color: '#A855F7' },
  { key: 'contacted', label: 'Contacted', color: '#3B82F6' },
  { key: 'qualified', label: 'Qualified', color: '#06B6D4' },
  { key: 'demo_scheduled', label: 'Demo', color: '#FFCC33' },
  { key: 'proposal_sent', label: 'Proposal', color: '#F59E0B' },
  { key: 'negotiation', label: 'Negotiation', color: '#F0B400' },
  { key: 'won', label: 'Won', color: '#00A980' },
  { key: 'lost', label: 'Lost', color: '#EF4444' },
]

export default function LeadsPage() {
  const { addToast } = useToast()
  const leadsQ = useCockpitQuery<any[]>('leads', '/api/cockpit/leads')
  const createMutation = useCockpitMutation<Partial<SeedLead>>('/api/cockpit/leads', {
    invalidateKeys: ['leads'],
    successMessage: 'Lead created successfully',
  })
  const updateMutation = useCockpitMutation<{ id: string; stage: string }>('/api/cockpit/leads', {
    method: 'PATCH',
    invalidateKeys: ['leads'],
    successMessage: 'Lead stage updated',
  })

  const leads = leadsQ.data?.data ?? []
  const dataSource = leadsQ.data?.source ?? 'unavailable'
  const dataWarning = leadsQ.data?.warning

  const [search, setSearch] = useState('')
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [selectedLead, setSelectedLead] = useState<SeedLead | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBusiness, setNewBusiness] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newSource, setNewSource] = useState('')

  const filtered = useMemo(() => leads.filter(l => {
    if (search && !l.name.toLowerCase().includes(search.toLowerCase()) && !l.business.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [leads, search])

  const stageGroups = useMemo(() => {
    return STAGES.filter(s => !['won', 'lost'].includes(s.key)).map(stage => ({
      ...stage,
      leads: filtered.filter(l => l.stage === stage.key),
    }))
  }, [filtered])

  const handleCreate = () => {
    if (!newName.trim()) { addToast('Name is required', 'error'); return }
    createMutation.mutate({
      name: newName.trim(),
      business: newBusiness.trim(),
      email: newEmail.trim(),
      value: parseInt(newValue) || 0,
      source: newSource.trim(),
      stage: 'new',
      nextAction: 'Initial outreach',
      phone: '',
    })
    setShowCreate(false)
    setNewName(''); setNewBusiness(''); setNewEmail(''); setNewValue(''); setNewSource('')
  }

  const handleStageChange = (leadId: string, newStage: SeedLead['stage']) => {
    updateMutation.mutate({ id: leadId, stage: newStage })
  }

  if (leadsQ.isLoading) return <LoadingState message="Loading leads..." />

  return (
    <div>
      <DataSourceBanner source={dataSource} warning={dataWarning} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Lead Pipeline</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
            {leads.length} leads • ${(leads.reduce((s, l) => s + l.value, 0) / 1000).toFixed(0)}K pipeline
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ width: 240 }}><SearchInput value={search} onChange={setSearch} placeholder="Search leads..." /></div>
          <ActionButton
            label={view === 'kanban' ? '☰ List' : '◻ Board'}
            variant="ghost"
            onClick={() => setView(v => v === 'kanban' ? 'list' : 'kanban')}
          />
          <ActionButton label="+ New Lead" variant="primary" size="md" onClick={() => setShowCreate(true)} />
        </div>
      </div>

      {view === 'kanban' ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${stageGroups.length}, minmax(180px, 1fr))`,
          gap: '0.6rem',
          overflowX: 'auto',
        }}>
          {stageGroups.map(stage => (
            <div key={stage.key}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.6rem',
                marginBottom: '0.5rem', background: `${stage.color}15`, borderRadius: 8,
                borderLeft: `3px solid ${stage.color}`,
              }}>
                <span style={{ color: stage.color, fontSize: '0.75rem', fontWeight: 600 }}>{stage.label}</span>
                <span style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.65rem' }}>({stage.leads.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minHeight: 100 }}>
                {stage.leads.map(lead => (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    style={{
                      background: 'rgba(14,52,112,0.5)', border: '1px solid rgba(255,204,51,0.06)',
                      borderRadius: 8, padding: '0.7rem', cursor: 'pointer', transition: 'border-color 150ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,204,51,0.15)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,204,51,0.06)')}
                  >
                    <div style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>{lead.name}</div>
                    <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.6rem', marginBottom: '0.35rem' }}>{lead.business}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#00A980', fontSize: '0.65rem', fontWeight: 600 }}>${(lead.value / 1000).toFixed(0)}K</span>
                      <span style={{
                        padding: '0.15rem 0.35rem', borderRadius: 999, fontSize: '0.55rem', fontWeight: 700,
                        background: lead.score >= 80 ? 'rgba(255,204,51,0.15)' : 'rgba(59,130,246,0.15)',
                        color: lead.score >= 80 ? '#FFCC33' : '#3B82F6',
                      }}>{lead.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
          {filtered.map(lead => (
            <div
              key={lead.id}
              onClick={() => setSelectedLead(lead)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.85rem 1rem', background: 'rgba(14,52,112,0.4)',
                border: '1px solid rgba(255,204,51,0.06)', borderRadius: 8, cursor: 'pointer',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{lead.name}</div>
                <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>{lead.business} • {lead.source}</div>
              </div>
              <span style={{ color: '#00A980', fontSize: '0.75rem', fontWeight: 600 }}>${(lead.value / 1000).toFixed(0)}K</span>
              <StatusBadge status={lead.stage} size="md" />
              <span style={{
                padding: '0.2rem 0.5rem', borderRadius: 999, fontSize: '0.6rem', fontWeight: 700,
                background: lead.score >= 80 ? 'rgba(255,204,51,0.15)' : 'rgba(59,130,246,0.15)',
                color: lead.score >= 80 ? '#FFCC33' : '#3B82F6',
              }}>{lead.score}</span>
            </div>
          ))}
          {filtered.length === 0 && <EmptyState icon="🎯" title="No leads found" />}
        </div>
      )}

      {/* Lead Detail Modal */}
      <Modal isOpen={!!selectedLead} onClose={() => setSelectedLead(null)} title={selectedLead?.name || ''} width={580}>
        {selectedLead && (
          <div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusBadge status={selectedLead.stage} size="md" />
              <span style={{ color: '#00A980', fontSize: '0.85rem', fontWeight: 600 }}>${(selectedLead.value / 1000).toFixed(0)}K</span>
              <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.75rem' }}>Score: {selectedLead.score}</span>
              <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.75rem' }}>Prob: {selectedLead.probability}%</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
              <Card title="Business"><span style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>{selectedLead.business}</span></Card>
              <Card title="Source"><span style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>{selectedLead.source || 'Unknown'}</span></Card>
            </div>
            {selectedLead.nextAction && (
              <Card title="Next Action"><p style={{ color: '#e2e8f0', fontSize: '0.8rem', margin: 0 }}>{selectedLead.nextAction}</p></Card>
            )}
            <div style={{ marginTop: '1rem' }}>
              <label style={{ color: 'rgba(255,204,51,0.6)', fontSize: '0.7rem', fontWeight: 500, display: 'block', marginBottom: '0.35rem' }}>Move to Stage</label>
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                {STAGES.map(s => (
                  <button
                    key={s.key}
                    onClick={() => { handleStageChange(selectedLead.id, s.key); setSelectedLead(null) }}
                    disabled={s.key === selectedLead.stage}
                    style={{
                      padding: '0.35rem 0.6rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 500,
                      border: `1px solid ${s.color}30`,
                      background: s.key === selectedLead.stage ? `${s.color}25` : 'transparent',
                      color: s.key === selectedLead.stage ? s.color : 'rgba(255,204,51,0.5)',
                      cursor: s.key === selectedLead.stage ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >{s.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Lead Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Lead" width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[
            { label: 'Name *', value: newName, set: setNewName, placeholder: 'Lead name' },
            { label: 'Business', value: newBusiness, set: setNewBusiness, placeholder: 'Company name' },
            { label: 'Email', value: newEmail, set: setNewEmail, placeholder: 'email@example.com' },
            { label: 'Deal Value ($)', value: newValue, set: setNewValue, placeholder: '50000' },
            { label: 'Source', value: newSource, set: setNewSource, placeholder: 'Referral, Website, etc.' },
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
            <ActionButton label={createMutation.isPending ? 'Creating...' : 'Create Lead'} variant="primary" size="md" onClick={handleCreate} />
            <ActionButton label="Cancel" variant="ghost" size="md" onClick={() => setShowCreate(false)} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
