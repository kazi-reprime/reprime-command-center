/**
 * Portal Data Gateway — queries Portal Supabase tables directly.
 * Used by cockpit API routes to fetch listings, brokers, automations, scores, etc.
 * Falls back gracefully when tables don't exist or DB is unavailable.
 */
import { createServiceClient } from '@/lib/supabase/server'

type PortalResult<T> = {
  data: T
  source: 'portal_db' | 'fallback'
  total?: number
  warning?: string
}

// ─── Listings ───
export interface PortalListing {
  id: string
  title: string
  address: string
  city?: string
  state?: string
  listing_type?: string       // 'For Sale', 'Auction', 'Foreclosure'
  property_type?: string      // 'Retail', 'Office', 'Industrial', etc.
  asking_price?: number
  cap_rate?: number
  noi?: number
  occupancy?: number
  building_sf?: number
  year_built?: number
  vacancy?: number
  listing_agent_name?: string
  listing_agent_company?: string
  listing_agent_email?: string
  image_url?: string
  source_url?: string
  campaign_id?: string
  pipeline_stage?: string
  ai_status?: string
  created_at?: string
  updated_at?: string
}

export async function fetchListings(opts: {
  page?: number; limit?: number; type?: string; state?: string;
  minPrice?: number; maxPrice?: number; minCap?: number; maxCap?: number;
  search?: string; sort?: string;
}): Promise<PortalResult<PortalListing[]>> {
  const { page = 1, limit = 20 } = opts
  try {
    const svc = createServiceClient()
    let q = svc.from('listings').select('*', { count: 'exact' })
    if (opts.type) q = q.eq('listing_type', opts.type)
    if (opts.state) q = q.eq('state', opts.state)
    if (opts.minPrice) q = q.gte('asking_price', opts.minPrice)
    if (opts.maxPrice) q = q.lte('asking_price', opts.maxPrice)
    if (opts.search) q = q.or(`title.ilike.%${opts.search}%,address.ilike.%${opts.search}%`)
    q = q.order('created_at', { ascending: false })
    q = q.range((page - 1) * limit, page * limit - 1)
    const { data, error, count } = await q
    if (error) throw error
    return { data: (data ?? []) as PortalListing[], source: 'portal_db', total: count ?? 0 }
  } catch (e: any) {
    console.error('[portal] listings query failed:', e?.message)
    return { data: [], source: 'fallback', total: 0, warning: `Listings table not available: ${e?.message}` }
  }
}

// ─── Brokers ───
export interface PortalBroker {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  deal_count?: number
  property_count?: number
  total_value?: number
  active_deals?: number
  created_at?: string
}

export async function fetchBrokers(opts: {
  page?: number; limit?: number; search?: string; sort?: string;
}): Promise<PortalResult<PortalBroker[]>> {
  const { page = 1, limit = 20 } = opts
  try {
    const svc = createServiceClient()
    let q = svc.from('brokers').select('*', { count: 'exact' })
    if (opts.search) q = q.or(`name.ilike.%${opts.search}%,company.ilike.%${opts.search}%,email.ilike.%${opts.search}%`)
    q = q.order('name', { ascending: true })
    q = q.range((page - 1) * limit, page * limit - 1)
    const { data, error, count } = await q
    if (error) throw error
    return { data: (data ?? []) as PortalBroker[], source: 'portal_db', total: count ?? 0 }
  } catch (e: any) {
    console.error('[portal] brokers query failed:', e?.message)
    return { data: [], source: 'fallback', total: 0, warning: `Brokers table not available: ${e?.message}` }
  }
}

// ─── Deal Scores ───
export interface PortalDealScore {
  id: string
  listing_id?: string
  listing_title: string
  tier?: string         // 'Tier 1', 'Tier 2', etc.
  score: number
  signal_count?: number
  star_count?: number
  seller_carry?: boolean
  signals?: string[]    // e.g. ['Broker Intel', 'Context', 'Debt']
  last_signal_at?: string
  insights?: string
  campaign_name?: string
  loi_sent?: boolean
  created_at?: string
}

export async function fetchDealScores(opts: {
  page?: number; limit?: number; tier?: string; minScore?: number; maxScore?: number;
}): Promise<PortalResult<PortalDealScore[]>> {
  const { page = 1, limit = 20 } = opts
  try {
    const svc = createServiceClient()
    let q = svc.from('deal_scores').select('*', { count: 'exact' })
    if (opts.tier) q = q.eq('tier', opts.tier)
    if (opts.minScore) q = q.gte('score', opts.minScore)
    if (opts.maxScore) q = q.lte('score', opts.maxScore)
    q = q.order('score', { ascending: false })
    q = q.range((page - 1) * limit, page * limit - 1)
    const { data, error, count } = await q
    if (error) throw error
    return { data: (data ?? []) as PortalDealScore[], source: 'portal_db', total: count ?? 0 }
  } catch (e: any) {
    console.error('[portal] deal_scores query failed:', e?.message)
    return { data: [], source: 'fallback', total: 0, warning: `Deal scores table not available: ${e?.message}` }
  }
}

// ─── Automations (Portal version) ───
export interface PortalAutomation {
  id: string
  listing_id?: string
  listing_title: string
  listing_type?: string
  status: 'active' | 'paused' | 'awaiting_human' | 'completed'
  ai_status?: string        // 'normal', 'red_flags', 'data_room', etc.
  ai_summary?: string
  campaign_name?: string
  data_room_url?: string
  updated_at?: string
  created_at?: string
}

export async function fetchPortalAutomations(opts: {
  page?: number; limit?: number; status?: string;
}): Promise<PortalResult<PortalAutomation[]>> {
  const { page = 1, limit = 20 } = opts
  try {
    const svc = createServiceClient()
    let q = svc.from('automations').select('*', { count: 'exact' })
    if (opts.status) q = q.eq('status', opts.status)
    q = q.order('updated_at', { ascending: false })
    q = q.range((page - 1) * limit, page * limit - 1)
    const { data, error, count } = await q
    if (error) throw error
    return { data: (data ?? []) as PortalAutomation[], source: 'portal_db', total: count ?? 0 }
  } catch (e: any) {
    console.error('[portal] automations query failed:', e?.message)
    return { data: [], source: 'fallback', total: 0, warning: `Automations table not available: ${e?.message}` }
  }
}

// ─── Campaigns ───
export interface PortalCampaign {
  id: string
  name: string
  status?: string          // 'active', 'paused', 'completed'
  listing_count?: number
  sent_count?: number
  reply_count?: number
  reply_rate?: number
  created_at?: string
}

export async function fetchCampaigns(opts: {
  page?: number; limit?: number;
}): Promise<PortalResult<PortalCampaign[]>> {
  const { page = 1, limit = 20 } = opts
  try {
    const svc = createServiceClient()
    const q = svc.from('campaigns').select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)
    const { data, error, count } = await q
    if (error) throw error
    return { data: (data ?? []) as PortalCampaign[], source: 'portal_db', total: count ?? 0 }
  } catch (e: any) {
    console.error('[portal] campaigns query failed:', e?.message)
    return { data: [], source: 'fallback', total: 0, warning: `Campaigns table not available: ${e?.message}` }
  }
}

// ─── Investor Profiles ───
export interface PortalInvestorProfile {
  id: string
  name: string
  status?: string         // 'active', 'inactive'
  min_price?: number
  max_price?: number
  min_cap?: number
  max_cap?: number
  min_occupancy?: number
  max_occupancy?: number
  states?: string[]
  property_types?: string[]
  listing_types?: string[]
  match_count?: number
  color?: string
  notes?: string
  created_at?: string
}

export async function fetchInvestorProfiles(opts: {
  page?: number; limit?: number;
}): Promise<PortalResult<PortalInvestorProfile[]>> {
  const { page = 1, limit = 20 } = opts
  try {
    const svc = createServiceClient()
    // Try investor_profiles first (Portal table), fall back to investors (Command Center table)
    let q = svc.from('investor_profiles').select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)
    const { data, error, count } = await q
    if (error) {
      // Try the existing investors table as fallback
      const { data: inv, error: invErr, count: invCount } = await svc.from('investors')
        .select('*', { count: 'exact' })
        .order('investor_score', { ascending: false })
        .range((page - 1) * limit, page * limit - 1)
      if (invErr) throw invErr
      const mapped: PortalInvestorProfile[] = (inv ?? []).map((i: any) => ({
        id: i.id,
        name: i.name,
        status: i.status === 'inactive' ? 'inactive' : 'active',
        min_price: i.capital_capacity ? 0 : undefined,
        max_price: i.capital_capacity ?? undefined,
        states: i.preferred_location ? [i.preferred_location] : [],
        property_types: i.preferred_deal_type ? [i.preferred_deal_type] : [],
        match_count: 0,
        notes: '',
      }))
      return { data: mapped, source: 'portal_db', total: invCount ?? mapped.length }
    }
    return { data: (data ?? []) as PortalInvestorProfile[], source: 'portal_db', total: count ?? 0 }
  } catch (e: any) {
    console.error('[portal] investor_profiles query failed:', e?.message)
    return { data: [], source: 'fallback', total: 0, warning: `Investor profiles not available: ${e?.message}` }
  }
}

// ─── Portal Stats (Aggregated) ───
export interface PortalStats {
  listingsCount: number
  brokersCount: number
  activeCampaigns: number
  totalCampaigns: number
  emailsSent: number
  replyRate: number
  activeAutomations: number
  needsAttention: number
  pipelineDeals: number
  pipelineValue: number
  topScoreCount: number
}

export async function fetchPortalStats(): Promise<PortalResult<PortalStats>> {
  const defaults: PortalStats = {
    listingsCount: 0, brokersCount: 0, activeCampaigns: 0, totalCampaigns: 0,
    emailsSent: 0, replyRate: 0, activeAutomations: 0, needsAttention: 0,
    pipelineDeals: 0, pipelineValue: 0, topScoreCount: 0,
  }
  try {
    const svc = createServiceClient()
    // Run all counts in parallel
    const [listings, brokers, campaigns, automations, deals, scores] = await Promise.allSettled([
      svc.from('listings').select('id', { count: 'exact', head: true }),
      svc.from('brokers').select('id', { count: 'exact', head: true }),
      svc.from('campaigns').select('*'),
      svc.from('automations').select('id, status', { count: 'exact' }),
      svc.from('deals').select('id, purchase_price, status'),
      svc.from('deal_scores').select('id', { count: 'exact', head: true }),
    ])

    const lCount = listings.status === 'fulfilled' ? (listings.value.count ?? 0) : 0
    const bCount = brokers.status === 'fulfilled' ? (brokers.value.count ?? 0) : 0

    let totalCamps = 0, activeCamps = 0, totalSent = 0, totalReplied = 0
    if (campaigns.status === 'fulfilled' && campaigns.value.data) {
      const cData = campaigns.value.data as any[]
      totalCamps = cData.length
      activeCamps = cData.filter((c: any) => c.status === 'active' || c.status === 'sending').length
      totalSent = cData.reduce((s: number, c: any) => s + (c.sent_count || 0), 0)
      totalReplied = cData.reduce((s: number, c: any) => s + (c.reply_count || 0), 0)
    }

    let activeAutos = 0, needsAttn = 0
    if (automations.status === 'fulfilled' && automations.value.data) {
      const aData = automations.value.data as any[]
      activeAutos = aData.filter((a: any) => a.status === 'active').length
      needsAttn = aData.filter((a: any) => a.status === 'awaiting_human').length
    }

    let pDeals = 0, pValue = 0
    if (deals.status === 'fulfilled' && deals.value.data) {
      const dData = deals.value.data as any[]
      const active = dData.filter((d: any) => d.status !== 'lost' && d.status !== 'closed')
      pDeals = active.length
      pValue = active.reduce((s: number, d: any) => s + (d.purchase_price || 0), 0)
    }

    const sCount = scores.status === 'fulfilled' ? (scores.value.count ?? 0) : 0

    return {
      data: {
        listingsCount: lCount, brokersCount: bCount,
        activeCampaigns: activeCamps, totalCampaigns: totalCamps,
        emailsSent: totalSent,
        replyRate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
        activeAutomations: activeAutos, needsAttention: needsAttn,
        pipelineDeals: pDeals, pipelineValue: pValue, topScoreCount: sCount,
      },
      source: 'portal_db',
    }
  } catch (e: any) {
    console.error('[portal] stats aggregation failed:', e?.message)
    return { data: defaults, source: 'fallback', warning: `Portal stats not available: ${e?.message}` }
  }
}
