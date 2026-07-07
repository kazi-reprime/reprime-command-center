'use client'

import React from 'react'
import { EmptyState } from '@/components/ui/shared'
import { DataSourceBanner } from '@/components/ui/LiveStatus'

export default function FilesPage() {
  return (
    <div>
      <DataSourceBanner source="unavailable" warning="File storage not configured. Connect cloud storage to manage documents." />
      <div className="mb-6">
        <h1 className="m-0 text-text-primary text-2xl font-bold">Files</h1>
        <p className="mt-1 mb-0 text-text-secondary text-xs">Document management</p>
      </div>
      <EmptyState icon="🗄️" title="No files configured" description="Connect file storage in Settings to manage deal documents, LOIs, and data rooms." />
    </div>
  )
}
