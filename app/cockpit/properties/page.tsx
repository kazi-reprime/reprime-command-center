'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, ActionButton, StatCard } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useToast } from '@/lib/contexts/ToastContext'

interface Listing {
  id: string; title: string; address: string; city?: string; state?: string;
  listing_type?: string; property_type?: string; asking_price?: number; cap_rate?: number;
  noi?: number; occupancy?: number; building_sf?: number; year_built?: number;
  listing_agent_name?: string; listing_agent_company?: string; image_url?: string;
  created_at?: string; updated_at?: string;
}

const PROPERTY_TYPES = ['All', 'Retail', 'Office', 'Industrial', 'Multifamily', 'Mixed Use', 'Medical', 'Self Storage', 'Hospitality', 'Land']
const LISTING_TYPES = ['All', 'For Sale', 'Auction', 'Distressed', 'Foreclosure']

export default function PropertiesPage() {
  const { addToast } = useToast()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('seed')
  const [warning, setWarning] = useState<string | undefined>()
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [listingTypeFilter, setListingTypeFilter] = useState('All')
  const limit = 20

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (search) params.set('search', search)
      if (typeFilter !== 'All') params.set('type', typeFilter)
      const res = await fetch(`/api/cockpit/listings?${params}`)
      const data = await res.json()
      setListings(data.data || [])
      setSource(data.source || 'fallback')
      setWarning(data.warning)
      setTotal(data.total || 0)
    } catch { addToast('Failed to load listings', 'error') }
    finally { setLoading(false) }
  }, [page, search, typeFilter, addToast])

  useEffect(() => { fetchData() }, [fetchData])

  const totalPages = Math.ceil(total / limit) || 1
  const fmt = (n?: number) => n ? `$${(n / 1e6).toFixed(1)}M` : '—'
  const fmtPct = (n?: number) => n ? `${n.toFixed(1)}%` : '—'
  const fmtSF = (n?: number) => n ? `${n.toLocaleString()} SF` : '—'

  const daysSince = (d?: string) => {
    if (!d) return '—'
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return '1d ago'
    return `${diff}d ago`
  }

  return (
    <div>
      <DataSourceBanner source={source} warning={warning} />
      <h1 style={{ margin: '0 0 0.25rem', color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Market Listings</h1>
      <p style={{ margin: '0 0 1rem', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
        {total.toLocaleString()} listings across all markets
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setPage(1), fetchData())}
          placeholder="Search listings…"
          style={{
            flex: 1, minWidth: 200, padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,204,51,0.1)', borderRadius: 8, color: '#fff',
            fontSize: '0.8rem', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
          style={{
            padding: '0.5rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,204,51,0.1)',
            borderRadius: 8, color: '#FFCC33', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={listingTypeFilter}
          onChange={e => { setListingTypeFilter(e.target.value); setPage(1) }}
          style={{
            padding: '0.5rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,204,51,0.1)',
            borderRadius: 8, color: '#FFCC33', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {LISTING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <ActionButton label="Search" variant="primary" onClick={() => { setPage(1); fetchData() }} />
      </div>

      {loading ? <LoadingState message="Loading listings..." /> : (
        <>
          {/* Listing Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {listings.length === 0 && (
              <Card title="No Results">
                <p style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
                  {warning || 'No listings match your filters. Try broadening your search.'}
                </p>
              </Card>
            )}
            {listings.map(l => (
              <div key={l.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
                gap: '0.75rem', padding: '0.85rem 1rem',
                background: 'rgba(14,52,112,0.4)', border: '1px solid rgba(255,204,51,0.06)',
                borderRadius: 10, alignItems: 'center',
              }}>
                {/* Title & Address */}
                <div>
                  <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600, marginBottom: 2 }}>{l.title}</div>
                  <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>{l.address}</div>
                  <div style={{ display: 'flex', gap: '0.3rem', marginTop: 4 }}>
                    {l.property_type && (
                      <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.55rem', fontWeight: 600, background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                        {l.property_type}
                      </span>
                    )}
                    {l.listing_type && (
                      <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.55rem', fontWeight: 600, background: 'rgba(0,169,128,0.15)', color: '#00A980' }}>
                        {l.listing_type}
                      </span>
                    )}
                  </div>
                </div>

                {/* Deal Economics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                  <div>
                    <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: '0.55rem', textTransform: 'uppercase' }}>Asking</div>
                    <div style={{ color: '#FFCC33', fontSize: '0.85rem', fontWeight: 600 }}>{fmt(l.asking_price)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: '0.55rem', textTransform: 'uppercase' }}>Cap Rate</div>
                    <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>{fmtPct(l.cap_rate)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: '0.55rem', textTransform: 'uppercase' }}>NOI</div>
                    <div style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>{l.noi ? `$${(l.noi / 1000).toFixed(0)}K` : '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: '0.55rem', textTransform: 'uppercase' }}>Vacancy</div>
                    <div style={{ color: (l.occupancy ?? 100) < 80 ? '#EF4444' : '#e2e8f0', fontSize: '0.8rem' }}>
                      {l.occupancy != null ? `${(100 - l.occupancy).toFixed(0)}%` : '—'}
                    </div>
                  </div>
                </div>

                {/* Broker & Building */}
                <div>
                  <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: '0.55rem', textTransform: 'uppercase' }}>Building</div>
                  <div style={{ color: '#e2e8f0', fontSize: '0.75rem' }}>{fmtSF(l.building_sf)}</div>
                  {l.listing_agent_name && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: '0.55rem', textTransform: 'uppercase' }}>Broker</div>
                      <div style={{ color: '#e2e8f0', fontSize: '0.7rem' }}>{l.listing_agent_name}</div>
                      {l.listing_agent_company && <div style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.6rem' }}>{l.listing_agent_company}</div>}
                    </div>
                  )}
                </div>

                {/* Actions & Date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-end' }}>
                  <span style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.6rem' }}>{daysSince(l.created_at)}</span>
                  <ActionButton label="View" variant="primary" size="sm" onClick={() => addToast(`Viewing ${l.title}`, 'info')} />
                  <ActionButton label="Outreach" variant="ghost" size="sm" onClick={() => addToast(`Starting outreach for ${l.title}`, 'info')} />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: '1rem', padding: '0.75rem 0',
          }}>
            <span style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.75rem' }}>
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
            </span>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <ActionButton label="‹" variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} />
              <span style={{ color: '#FFCC33', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>{page}</span>
              <ActionButton label="›" variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
