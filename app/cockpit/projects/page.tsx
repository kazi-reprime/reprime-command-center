'use client'

import React from 'react'
import { EmptyState } from '@/components/ui/shared'
import { DataSourceBanner } from '@/components/ui/LiveStatus'

export default function ProjectsPage() {
  return (
    <div>
      <DataSourceBanner source="unavailable" warning="Projects now map to the Pipeline view. Use Pipeline for deal tracking." />
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Projects</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>Use the Pipeline view for acquisition deal tracking</p>
      </div>
      <EmptyState icon="📁" title="No separate project data" description="Active deals and properties are tracked in the Pipeline and Properties views." />
    </div>
  )
}
