'use client'

import React, { useState } from 'react'
import { Card, StatusBadge, ActionButton, ProgressBar, SearchInput, EmptyState } from '@/components/ui/shared'
import { seedProjects } from '@/lib/data/seed'

export default function ProjectsPage() {
  const [search, setSearch] = useState('')
  const projects = seedProjects.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Project / Delivery Tracker</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>{seedProjects.length} projects • {seedProjects.filter(p => p.status === 'in_progress').length} in progress</p>
        </div>
        <div style={{ width: 240 }}><SearchInput value={search} onChange={setSearch} placeholder="Search projects..." /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1rem' }}>
        {projects.map(project => (
          <div key={project.id} style={{
            background: 'rgba(14,52,112,0.4)', border: '1px solid rgba(255,204,51,0.08)',
            borderRadius: 12, padding: '1.25rem', transition: 'border-color 200ms',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ color: '#fff', fontSize: '1rem', fontWeight: 600 }}>{project.name}</div>
                <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.7rem', marginTop: '0.15rem' }}>{project.client} • Owner: {project.owner}</div>
              </div>
              <StatusBadge status={project.status} size="md" />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.7rem' }}>Progress</span>
                <span style={{ color: '#FFCC33', fontSize: '0.7rem', fontWeight: 600 }}>{project.progress}%</span>
              </div>
              <ProgressBar value={project.progress} color={project.progress >= 80 ? '#00A980' : project.progress >= 40 ? '#FFCC33' : '#3B82F6'} />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Milestones</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.35rem' }}>
                {project.milestones.map((ms, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ color: ms.done ? '#00A980' : 'rgba(255,204,51,0.3)', fontSize: '0.7rem' }}>{ms.done ? '✅' : '○'}</span>
                    <span style={{ color: ms.done ? 'rgba(255,204,51,0.4)' : '#e2e8f0', fontSize: '0.75rem', textDecoration: ms.done ? 'line-through' : 'none' }}>{ms.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {project.blockers.length > 0 && (
              <div style={{ padding: '0.5rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 6 }}>
                <span style={{ color: '#EF4444', fontSize: '0.65rem', fontWeight: 600 }}>🚧 Blockers</span>
                {project.blockers.map((b, i) => (
                  <div key={i} style={{ color: '#e2e8f0', fontSize: '0.7rem', marginTop: '0.2rem' }}>• {b}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
              <span style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>Deadline: {new Date(project.deadline).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        {projects.length === 0 && <EmptyState icon="📁" title="No projects found" />}
      </div>
    </div>
  )
}
