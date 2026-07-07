'use client'

import React from 'react'
import { EmptyState } from '@/components/ui/shared'
import { DataSourceBanner } from '@/components/ui/LiveStatus'

export default function FilesPage() {
  return (
    <div>
      <DataSourceBanner source="unavailable" warning="File storage not configured. Connect cloud storage to manage documents." />
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Files</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>Document management</p>
      </div>
      <EmptyState icon="🗄️" title="No files configured" description="Connect file storage in Settings to manage deal documents, LOIs, and data rooms." />
    </div>
  )
}
