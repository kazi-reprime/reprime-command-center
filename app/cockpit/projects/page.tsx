'use client'

import React from 'react'
import { EmptyState } from '@/components/ui/shared'
import { DataSourceBanner } from '@/components/ui/LiveStatus'

export default function ProjectsPage() {
  return (
    <div>
      <DataSourceBanner source="unavailable" warning="Projects now map to the Pipeline view. Use Pipeline for deal tracking." />
      <div className="mb-6">
        <h1 className="m-0 text-text-primary text-2xl font-bold">Projects</h1>
        <p className="mt-1 mb-0 text-text-secondary text-xs">Use the Pipeline view for acquisition deal tracking</p>
      </div>
      <EmptyState icon="📁" title="No separate project data" description="Active deals and properties are tracked in the Pipeline and Properties views." />
    </div>
  )
}
