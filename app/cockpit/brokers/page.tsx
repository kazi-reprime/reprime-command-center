/* eslint-disable */
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, ActionButton } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useToast } from '@/lib/contexts/ToastContext'

interface Broker {
  id: string; name: string; company?: string; email?: string;
  deal_count?: number; property_count?: number; total_value?: number; active_deals?: number;
}

export default function BrokersPage() {
  const { addToast } = useToast()
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('loading')
  const [warning, setWarning] = useState<string | undefined>()
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const limit = 20

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (search) params.set('search', search)
      const res = await fetch(`/api/cockpit/brokers?${params}`)
      const data = await res.json()
      setBrokers(data.data || [])
      setSource(data.source || 'fallback')
      setWarning(data.warning)
      setTotal(data.total || 0)
    } catch { addToast('Failed to load brokers', 'error') }
    finally { setLoading(false) }
  }, [page, search, addToast])

  useEffect(() => { fetchData() }, [fetchData])

  const totalPages = Math.ceil(total / limit) || 1
  const fmt = (n?: number) => n ? `$${(n / 1e6).toFixed(1)}M` : '—'

  if (loading) return <LoadingState message="Loading brokers..." />

  return (
    <div>
      <DataSourceBanner source={source} warning={warning} />
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="mb-1 text-text-primary text-2xl font-bold">Brokers</h1>
          <p className="m-0 text-text-secondary text-xs">
            {total.toLocaleString()} broker contacts
          </p>
        </div>
        <ActionButton label="+ Add Broker" variant="primary" onClick={() => addToast('Add broker coming soon', 'info')} />
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setPage(1), fetchData())}
          placeholder="Search brokers..."
          className="flex-1 px-3 py-2 bg-surface/20 border border-border-strong rounded-lg text-text-primary text-sm outline-none font-[inherit]"
        />
        <ActionButton label="Search" variant="primary" onClick={() => { setPage(1); fetchData() }} />
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div
          className="bg-surface-raised text-text-muted text-[0.6rem] font-bold uppercase"
          style={{
            display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 80px 80px 90px 70px',
            padding: '0.6rem 0.75rem',
          }}
        >
          <div>Broker</div><div>Brokerage</div><div>Email</div><div>Deals</div><div>Props</div><div>Value</div><div>Active</div>
        </div>

        {brokers.length === 0 && (
          <div className="p-8 text-center text-text-muted text-sm">
            {warning || 'No brokers found'}
          </div>
        )}

        {brokers.map(b => (
          <div key={b.id}
            className="items-center bg-surface border-b border-border/30"
            style={{
              display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 80px 80px 90px 70px',
              padding: '0.55rem 0.75rem',
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md shrink-0 bg-accent/10 flex items-center justify-center text-[0.6rem] font-bold text-accent">
                {b.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span className="text-text-primary text-[0.78rem] font-medium">{b.name}</span>
            </div>
            <div className="text-text-secondary text-[0.72rem]">{b.company || '—'}</div>
            <div className="text-text-muted text-[0.68rem] overflow-hidden text-ellipsis whitespace-nowrap">{b.email || '—'}</div>
            <div className="text-text-primary text-[0.78rem] font-semibold">{b.deal_count ?? 0}</div>
            <div className="text-text-primary text-[0.78rem]">{b.property_count ?? 0}</div>
            <div className="text-accent text-[0.78rem] font-semibold">{fmt(b.total_value)}</div>
            <div className={`text-[0.78rem] font-semibold ${(b.active_deals ?? 0) > 0 ? 'text-status-success' : 'text-text-muted'}`}>
              {b.active_deals ?? 0}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <span className="text-text-secondary text-xs">
          Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
        </span>
        <div className="flex gap-1">
          <ActionButton label="‹" variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} />
          <span className="text-text-primary text-sm px-2 py-1">{page}/{totalPages}</span>
          <ActionButton label="›" variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
        </div>
      </div>
    </div>
  )
}
