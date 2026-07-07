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
  const [source, setSource] = useState('loading')
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
      if (listingTypeFilter !== 'All') params.set('listing_type', listingTypeFilter)
      const res = await fetch(`/api/cockpit/listings?${params}`)
      const data = await res.json()
      setListings(data.data || [])
      setSource(data.source || 'fallback')
      setWarning(data.warning)
      setTotal(data.total || 0)
    } catch { addToast('Failed to load listings', 'error') }
    finally { setLoading(false) }
  }, [page, search, typeFilter, listingTypeFilter, addToast])

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
      <h1 className="mb-1 text-text-primary text-2xl font-bold">Market Listings</h1>
      <p className="mb-4 text-text-secondary text-xs">
        {total.toLocaleString()} listings across all markets
      </p>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setPage(1), fetchData())}
          placeholder="Search listings…"
          className="flex-1 min-w-[200px] px-3 py-2 bg-black/20 border border-border-strong rounded-lg text-text-primary text-sm outline-none font-[inherit]"
        />
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
          className="py-2 px-2 bg-black/30 border border-border-strong rounded-lg text-accent text-xs cursor-pointer font-[inherit]"
        >
          {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={listingTypeFilter}
          onChange={e => { setListingTypeFilter(e.target.value); setPage(1) }}
          className="py-2 px-2 bg-black/30 border border-border-strong rounded-lg text-accent text-xs cursor-pointer font-[inherit]"
        >
          {LISTING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <ActionButton label="Search" variant="primary" onClick={() => { setPage(1); fetchData() }} />
      </div>

      {loading ? <LoadingState message="Loading listings..." /> : (
        <>
          {/* Listing Grid */}
          <div className="flex flex-col gap-2">
            {listings.length === 0 && (
              <Card title="No Results">
                <p className="text-text-secondary text-sm">
                  {warning || 'No listings match your filters. Try broadening your search.'}
                </p>
              </Card>
            )}
            {listings.map(l => (
              <div key={l.id}
                className="bg-surface-raised border border-border rounded-xl items-center"
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
                  gap: '0.75rem', padding: '0.85rem 1rem',
                }}
              >
                {/* Title & Address */}
                <div>
                  <div className="text-text-primary text-sm font-semibold mb-0.5">{l.title}</div>
                  <div className="text-text-secondary text-[0.65rem]">{l.address}</div>
                  <div className="flex gap-1 mt-1">
                    {l.property_type && (
                      <span className="px-1.5 py-0.5 rounded text-[0.55rem] font-semibold bg-status-info/15 text-status-info">
                        {l.property_type}
                      </span>
                    )}
                    {l.listing_type && (
                      <span className="px-1.5 py-0.5 rounded text-[0.55rem] font-semibold bg-status-success/15 text-status-success">
                        {l.listing_type}
                      </span>
                    )}
                  </div>
                </div>

                {/* Deal Economics */}
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <div className="text-text-muted text-[0.55rem] uppercase">Asking</div>
                    <div className="text-accent text-sm font-semibold">{fmt(l.asking_price)}</div>
                  </div>
                  <div>
                    <div className="text-text-muted text-[0.55rem] uppercase">Cap Rate</div>
                    <div className="text-text-primary text-sm font-semibold">{fmtPct(l.cap_rate)}</div>
                  </div>
                  <div>
                    <div className="text-text-muted text-[0.55rem] uppercase">NOI</div>
                    <div className="text-text-primary text-sm">{l.noi ? `$${(l.noi / 1000).toFixed(0)}K` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-text-muted text-[0.55rem] uppercase">Vacancy</div>
                    <div className={`text-sm ${(l.occupancy ?? 100) < 80 ? 'text-status-error' : 'text-text-primary'}`}>
                      {l.occupancy != null ? `${(100 - l.occupancy).toFixed(0)}%` : '—'}
                    </div>
                  </div>
                </div>

                {/* Broker & Building */}
                <div>
                  <div className="text-text-muted text-[0.55rem] uppercase">Building</div>
                  <div className="text-text-primary text-xs">{fmtSF(l.building_sf)}</div>
                  {l.listing_agent_name && (
                    <div className="mt-1">
                      <div className="text-text-muted text-[0.55rem] uppercase">Broker</div>
                      <div className="text-text-primary text-[0.7rem]">{l.listing_agent_name}</div>
                      {l.listing_agent_company && <div className="text-text-muted text-[0.6rem]">{l.listing_agent_company}</div>}
                    </div>
                  )}
                </div>

                {/* Actions & Date */}
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-text-muted text-[0.6rem]">{daysSince(l.created_at)}</span>
                  <ActionButton label="View" variant="primary" size="sm" onClick={() => addToast(`Viewing ${l.title}`, 'info')} />
                  <ActionButton label="Outreach" variant="ghost" size="sm" onClick={() => addToast(`Starting outreach for ${l.title}`, 'info')} />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 py-3">
            <span className="text-text-secondary text-xs">
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
            </span>
            <div className="flex gap-1">
              <ActionButton label="‹" variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} />
              <span className="text-text-primary text-sm px-2 py-1">{page}</span>
              <ActionButton label="›" variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
