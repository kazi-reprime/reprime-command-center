'use client'

import React, { useState } from 'react'
import { StatusBadge, ActionButton, SearchInput, Modal, FormInput, FormSelect, Card } from '@/components/ui/shared'
import { seedLeads, type SeedLead } from '@/lib/data/seed'

const STAGES = [
  { key: 'new', label: 'New Lead', color: '#A855F7' },
  { key: 'contacted', label: 'Contacted', color: '#3B82F6' },
  { key: 'qualified', label: 'Qualified', color: '#06B6D4' },
  { key: 'demo_scheduled', label: 'Demo Scheduled', color: '#FFCC33' },
  { key: 'proposal_sent', label: 'Proposal Sent', color: '#F59E0B' },
  { key: 'negotiation', label: 'Negotiation', color: '#00A980' },
  { key: 'won', label: 'Won', color: '#10B981' },
  { key: 'lost', label: 'Lost', color: '#EF4444' },
] as const

export default function LeadsPage() {
  const [leads, setLeads] = useState(seedLeads)
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<SeedLead | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', business: '', email: '', phone: '', source: '', value: '', stage: 'new' })
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const moveLead = (id: string, newStage: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: newStage as SeedLead['stage'] } : l))
  }

  const handleCreate = () => {
    if (!form.name) return
    const newLead: SeedLead = {
      id: `l${Date.now()}`, name: form.name, business: form.business, email: form.email, phone: form.phone,
      stage: form.stage as SeedLead['stage'], score: Math.floor(Math.random() * 40) + 50, source: form.source,
      value: parseInt(form.value) || 0, probability: 20, nextAction: 'Schedule intro call', createdAt: new Date().toISOString().split('T')[0],
    }
    setLeads(prev => [newLead, ...prev])
    setShowCreate(false)
    setForm({ name: '', business: '', email: '', phone: '', source: '', value: '', stage: 'new' })
  }

  const filteredLeads = search
    ? leads.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.business.toLowerCase().includes(search.toLowerCase()))
    : leads

  const activeStages = STAGES.filter(s => s.key !== 'won' && s.key !== 'lost')
  const closedStages = STAGES.filter(s => s.key === 'won' || s.key === 'lost')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Lead Pipeline</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
            {leads.length} leads • ${(leads.filter(l => !['won', 'lost'].includes(l.stage)).reduce((s, l) => s + l.value, 0) / 1000).toFixed(0)}K pipeline value
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ width: 240 }}><SearchInput value={search} onChange={setSearch} placeholder="Search leads..." /></div>
          <ActionButton label="+ Add Lead" onClick={() => setShowCreate(true)} variant="primary" size="md" />
        </div>
      </div>

      {/* Pipeline Board */}
      <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', minWidth: activeStages.length * 250 }}>
          {activeStages.map(stage => {
            const stageLeads = filteredLeads.filter(l => l.stage === stage.key)
            return (
              <div
                key={stage.key}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (draggedId) { moveLead(draggedId, stage.key); setDraggedId(null) } }}
                style={{
                  flex: 1, minWidth: 230, background: 'rgba(14,52,112,0.3)',
                  border: '1px solid rgba(255,204,51,0.06)', borderRadius: 10,
                  display: 'flex', flexDirection: 'column',
                }}
              >
                <div style={{
                  padding: '0.75rem', borderBottom: `2px solid ${stage.color}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ color: stage.color, fontSize: '0.75rem', fontWeight: 600 }}>{stage.label}</span>
                  <span style={{
                    padding: '0.1rem 0.45rem', borderRadius: 999,
                    background: `${stage.color}20`, color: stage.color, fontSize: '0.65rem', fontWeight: 700,
                  }}>{stageLeads.length}</span>
                </div>
                <div style={{ padding: '0.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem', minHeight: 100 }}>
                  {stageLeads.map(lead => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDraggedId(lead.id)}
                      onClick={() => setSelectedLead(lead)}
                      style={{
                        padding: '0.65rem', background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,204,51,0.06)', borderRadius: 8,
                        cursor: 'grab', transition: 'all 150ms',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,204,51,0.15)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,204,51,0.06)')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>{lead.name}</div>
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%',
                          background: `linear-gradient(135deg, ${stage.color}40, ${stage.color}10)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: stage.color, fontSize: '0.6rem', fontWeight: 700,
                        }}>{lead.score}</div>
                      </div>
                      <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem', marginTop: '0.2rem' }}>{lead.business}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                        <span style={{ color: '#00A980', fontSize: '0.7rem', fontWeight: 600 }}>${(lead.value / 1000).toFixed(0)}K</span>
                        <span style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.6rem' }}>{lead.probability}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Won/Lost Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
        {closedStages.map(stage => {
          const stageLeads = filteredLeads.filter(l => l.stage === stage.key)
          return (
            <Card key={stage.key} title={`${stage.label} (${stageLeads.length})`}>
              {stageLeads.length > 0 ? stageLeads.map(lead => (
                <div key={lead.id} onClick={() => setSelectedLead(lead)} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.4rem 0', borderBottom: '1px solid rgba(255,204,51,0.04)', cursor: 'pointer',
                }}>
                  <div>
                    <span style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>{lead.name}</span>
                    <span style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.65rem', marginLeft: '0.5rem' }}>{lead.business}</span>
                  </div>
                  <span style={{ color: stage.color, fontSize: '0.75rem', fontWeight: 600 }}>${(lead.value / 1000).toFixed(0)}K</span>
                </div>
              )) : <span style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.75rem' }}>No leads</span>}
            </Card>
          )
        })}
      </div>

      {/* Lead Detail Modal */}
      <Modal isOpen={!!selectedLead} onClose={() => setSelectedLead(null)} title={selectedLead?.name || ''} width={580}>
        {selectedLead && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div><span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Business</span><div style={{ color: '#e2e8f0' }}>{selectedLead.business}</div></div>
              <div><span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Stage</span><div><StatusBadge status={selectedLead.stage} size="md" /></div></div>
              <div><span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Email</span><div style={{ color: '#e2e8f0' }}>{selectedLead.email}</div></div>
              <div><span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Phone</span><div style={{ color: '#e2e8f0' }}>{selectedLead.phone}</div></div>
              <div><span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Deal Value</span><div style={{ color: '#00A980', fontSize: '1.1rem', fontWeight: 700 }}>${selectedLead.value.toLocaleString()}</div></div>
              <div><span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Score / Probability</span><div style={{ color: '#FFCC33', fontSize: '1.1rem', fontWeight: 700 }}>{selectedLead.score} / {selectedLead.probability}%</div></div>
            </div>
            <div style={{ padding: '0.75rem', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.1)', borderRadius: 8, marginBottom: '0.75rem' }}>
              <div style={{ color: '#A855F7', fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.25rem' }}>🧠 AI Next Best Action</div>
              <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.8rem' }}>{selectedLead.nextAction}</p>
            </div>
            {selectedLead.lostReason && (
              <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 8, marginBottom: '0.75rem' }}>
                <div style={{ color: '#EF4444', fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.25rem' }}>Lost Reason</div>
                <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.8rem' }}>{selectedLead.lostReason}</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {selectedLead.stage !== 'won' && selectedLead.stage !== 'lost' && (
                <>
                  <ActionButton label="Move Forward" onClick={() => {
                    const idx = STAGES.findIndex(s => s.key === selectedLead.stage)
                    if (idx < STAGES.length - 2) { moveLead(selectedLead.id, STAGES[idx + 1].key); setSelectedLead(null) }
                  }} variant="primary" size="md" />
                  <ActionButton label="Mark Won" onClick={() => { moveLead(selectedLead.id, 'won'); setSelectedLead(null) }} variant="default" size="md" />
                  <ActionButton label="Mark Lost" onClick={() => { moveLead(selectedLead.id, 'lost'); setSelectedLead(null) }} variant="danger" size="md" />
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create Lead Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add New Lead">
        <FormInput label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required placeholder="Full name" />
        <FormInput label="Business" value={form.business} onChange={v => setForm(f => ({ ...f, business: v }))} placeholder="Company" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <FormInput label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
          <FormInput label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <FormInput label="Source" value={form.source} onChange={v => setForm(f => ({ ...f, source: v }))} placeholder="Referral, Website..." />
          <FormInput label="Deal Value ($)" value={form.value} onChange={v => setForm(f => ({ ...f, value: v }))} type="number" />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <ActionButton label="Cancel" onClick={() => setShowCreate(false)} variant="ghost" size="md" />
          <ActionButton label="Create Lead" onClick={handleCreate} variant="primary" size="md" disabled={!form.name} />
        </div>
      </Modal>
    </div>
  )
}
