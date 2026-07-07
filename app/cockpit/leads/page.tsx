'use client'

import React, { useState, useMemo } from 'react'
import { Card, StatusBadge, ActionButton, SearchInput, TabGroup, Modal, EmptyState, PriorityBadge } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useCockpitQuery, useCockpitMutation } from '@/hooks/useCockpitData'
// Seed data removed — live data only
import { useToast } from '@/lib/contexts/ToastContext'

interface SeedLead {
  id: string
  name: string
  company: string
  email: string
  phone: string
  source: string
  stage: 'new' | 'contacted' | 'qualified' | 'demo_scheduled' | 'proposal_sent' | 'negotiation' | 'won' | 'lost'
  priority: 'high' | 'medium' | 'low'
  value: number
  notes: string
  created_at: string
  last_contact: string
  score?: number
  probability?: number
  business?: string
  nextAction?: string
}

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

      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="m-0 text-text-primary text-2xl font-bold">Lead Pipeline</h1>
          <p className="mt-1 mb-0 text-text-secondary text-xs">
            {leads.length} leads • ${(leads.reduce((s, l) => s + l.value, 0) / 1000).toFixed(0)}K pipeline
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="w-[240px]"><SearchInput value={search} onChange={setSearch} placeholder="Search leads..." /></div>
          <ActionButton
            label={view === 'kanban' ? '☰ List' : '◻ Board'}
            variant="ghost"
            onClick={() => setView(v => v === 'kanban' ? 'list' : 'kanban')}
          />
          <ActionButton label="+ New Lead" variant="primary" size="md" onClick={() => setShowCreate(true)} />
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="grid gap-2.5 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${stageGroups.length}, minmax(180px, 1fr))` }}>
          {stageGroups.map(stage => (
            <div key={stage.key}>
              <div
                className="flex items-center gap-1.5 px-2.5 py-2 mb-2 rounded-lg"
                style={{
                  background: `${stage.color}15`,
                  borderLeft: `3px solid ${stage.color}`,
                }}
              >
                <span className="text-xs font-semibold" style={{ color: stage.color }}>{stage.label}</span>
                <span className="text-text-muted text-[0.65rem]">({stage.leads.length})</span>
              </div>
              <div className="flex flex-col gap-1.5" style={{ minHeight: 100 }}>
                {stage.leads.map(lead => (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="bg-surface-raised border border-border rounded-lg p-3 cursor-pointer transition-colors hover:border-border-strong"
                  >
                    <div className="text-text-primary text-xs font-semibold mb-1">{lead.name}</div>
                    <div className="text-text-muted text-[0.6rem] mb-1.5">{lead.business}</div>
                    <div className="flex justify-between items-center">
                      <span className="text-status-success text-[0.65rem] font-semibold">${(lead.value / 1000).toFixed(0)}K</span>
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[0.55rem] font-bold"
                        style={{
                          background: lead.score >= 80 ? 'rgba(255,204,51,0.15)' : 'rgba(59,130,246,0.15)',
                          color: lead.score >= 80 ? '#FFCC33' : '#3B82F6',
                        }}
                      >{lead.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1 mt-2">
          {filtered.map(lead => (
            <div
              key={lead.id}
              onClick={() => setSelectedLead(lead)}
              className="flex items-center gap-3 px-4 py-3 bg-surface-raised border border-border rounded-lg cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="text-text-primary text-sm font-semibold">{lead.name}</div>
                <div className="text-text-muted text-[0.65rem]">{lead.business} • {lead.source}</div>
              </div>
              <span className="text-status-success text-xs font-semibold">${(lead.value / 1000).toFixed(0)}K</span>
              <StatusBadge status={lead.stage} size="md" />
              <span
                className="px-2 py-0.5 rounded-full text-[0.6rem] font-bold"
                style={{
                  background: lead.score >= 80 ? 'rgba(255,204,51,0.15)' : 'rgba(59,130,246,0.15)',
                  color: lead.score >= 80 ? '#FFCC33' : '#3B82F6',
                }}
              >{lead.score}</span>
            </div>
          ))}
          {filtered.length === 0 && <EmptyState icon="🎯" title="No leads found" />}
        </div>
      )}

      {/* Lead Detail Modal */}
      <Modal isOpen={!!selectedLead} onClose={() => setSelectedLead(null)} title={selectedLead?.name || ''} width={580}>
        {selectedLead && (
          <div>
            <div className="flex gap-3 mb-4 flex-wrap items-center">
              <StatusBadge status={selectedLead.stage} size="md" />
              <span className="text-status-success text-sm font-semibold">${(selectedLead.value / 1000).toFixed(0)}K</span>
              <span className="text-text-secondary text-xs">Score: {selectedLead.score}</span>
              <span className="text-text-secondary text-xs">Prob: {selectedLead.probability}%</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Card title="Business"><span className="text-text-primary text-xs">{selectedLead.business}</span></Card>
              <Card title="Source"><span className="text-text-primary text-xs">{selectedLead.source || 'Unknown'}</span></Card>
            </div>
            {selectedLead.nextAction && (
              <Card title="Next Action"><p className="text-text-primary text-xs m-0">{selectedLead.nextAction}</p></Card>
            )}
            <div className="mt-4">
              <label className="text-text-secondary text-[0.7rem] font-medium block mb-1.5">Move to Stage</label>
              <div className="flex gap-1 flex-wrap">
                {STAGES.map(s => (
                  <button
                    key={s.key}
                    onClick={() => { handleStageChange(selectedLead.id, s.key); setSelectedLead(null) }}
                    disabled={s.key === selectedLead.stage}
                    className="px-2.5 py-1.5 rounded-lg text-[0.7rem] font-medium font-[inherit]"
                    style={{
                      border: `1px solid ${s.color}30`,
                      background: s.key === selectedLead.stage ? `${s.color}25` : 'transparent',
                      color: s.key === selectedLead.stage ? s.color : 'rgba(255,204,51,0.5)',
                      cursor: s.key === selectedLead.stage ? 'default' : 'pointer',
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
        <div className="flex flex-col gap-3">
          {[
            { label: 'Name *', value: newName, set: setNewName, placeholder: 'Lead name' },
            { label: 'Business', value: newBusiness, set: setNewBusiness, placeholder: 'Company name' },
            { label: 'Email', value: newEmail, set: setNewEmail, placeholder: 'email@example.com' },
            { label: 'Deal Value ($)', value: newValue, set: setNewValue, placeholder: '50000' },
            { label: 'Source', value: newSource, set: setNewSource, placeholder: 'Referral, Website, etc.' },
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
            <ActionButton label={createMutation.isPending ? 'Creating...' : 'Create Lead'} variant="primary" size="md" onClick={handleCreate} />
            <ActionButton label="Cancel" variant="ghost" size="md" onClick={() => setShowCreate(false)} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
