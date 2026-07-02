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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem', color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Brokers</h1>
          <p style={{ margin: 0, color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
            {total.toLocaleString()} broker contacts
          </p>
        </div>
        <ActionButton label="+ Add Broker" variant="primary" onClick={() => addToast('Add broker coming soon', 'info')} />
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setPage(1), fetchData())}
          placeholder="Search brokers..."
          style={{
            flex: 1, padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,204,51,0.1)', borderRadius: 8, color: '#fff',
            fontSize: '0.8rem', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <ActionButton label="Search" variant="primary" onClick={() => { setPage(1); fetchData() }} />
      </div>

      {/* Table */}
      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,204,51,0.06)' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 80px 80px 90px 70px',
          padding: '0.6rem 0.75rem', background: 'rgba(14,52,112,0.5)',
          fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,204,51,0.35)', textTransform: 'uppercase',
        }}>
          <div>Broker</div><div>Brokerage</div><div>Email</div><div>Deals</div><div>Props</div><div>Value</div><div>Active</div>
        </div>

        {brokers.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,204,51,0.3)', fontSize: '0.8rem' }}>
            {warning || 'No brokers found'}
          </div>
        )}

        {brokers.map(b => (
          <div key={b.id} style={{
            display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 80px 80px 90px 70px',
            padding: '0.55rem 0.75rem', alignItems: 'center',
            background: 'rgba(14,52,112,0.25)', borderBottom: '1px solid rgba(255,204,51,0.03)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: 'rgba(255,204,51,0.1)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#FFCC33',
              }}>
                {b.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span style={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 500 }}>{b.name}</span>
            </div>
            <div style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.72rem' }}>{b.company || '—'}</div>
            <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.email || '—'}</div>
            <div style={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 600 }}>{b.deal_count ?? 0}</div>
            <div style={{ color: '#e2e8f0', fontSize: '0.78rem' }}>{b.property_count ?? 0}</div>
            <div style={{ color: '#FFCC33', fontSize: '0.78rem', fontWeight: 600 }}>{fmt(b.total_value)}</div>
            <div style={{ color: (b.active_deals ?? 0) > 0 ? '#00A980' : 'rgba(255,204,51,0.3)', fontSize: '0.78rem', fontWeight: 600 }}>
              {b.active_deals ?? 0}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
        <span style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.75rem' }}>
          Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
        </span>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <ActionButton label="‹" variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} />
          <span style={{ color: '#FFCC33', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>{page}/{totalPages}</span>
          <ActionButton label="›" variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
        </div>
      </div>
    </div>
  )
}
