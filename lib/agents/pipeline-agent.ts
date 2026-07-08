/**
 * Pipeline Agent — Deal and Pipedrive operations
 * 
 * Manages Gideon's deal pipeline, searches deals, updates status,
 * and provides deal-level analytics.
 */

import { type AgentDefinition, type AgentTool, registerAgent } from './types'
import { createServiceClient } from '@/lib/supabase/server'

const listDeals: AgentTool = {
  name: 'list_deals',
  description: 'List current real estate deals in the pipeline.',
  parameters: {
    status: { type: 'string', description: "'open', 'won', 'lost' (default: 'open')" },
    limit: { type: 'number', description: 'Max deals (default 10)' },
  },
  async execute(params) {
    const status = String(params.status || 'open')
    const limit = Math.min(Number(params.limit) || 10, 30)

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('deals')
      .select('id, title, value, currency, status, stage_name, contact_name, organization_name, last_interaction_at')
      .eq('status', status)
      .order('last_interaction_at', { ascending: false })
      .limit(limit)

    if (error) return JSON.stringify({ error: error.message })
    return JSON.stringify({ count: data?.length ?? 0, deals: data ?? [] })
  },
}

const getDealDetails: AgentTool = {
  name: 'get_deal_details',
  description: 'Get full details about a specific deal by its ID or title.',
  parameters: {
    deal_id: { type: 'string', description: 'Deal UUID or Pipedrive ID' },
    title: { type: 'string', description: 'Fuzzy deal title search' },
  },
  async execute(params) {
    const supabase = createServiceClient()
    
    let query = supabase.from('deals').select('*')
    
    if (params.deal_id) {
      query = query.eq('id', params.deal_id)
    } else if (params.title) {
      query = query.ilike('title', `%${params.title}%`)
    } else {
      return JSON.stringify({ error: 'deal_id or title required' })
    }

    const { data: deal, error } = await query.maybeSingle()
    if (error) return JSON.stringify({ error: error.message })
    if (!deal) return JSON.stringify({ error: 'Deal not found' })

    // Also fetch related contacts
    const { data: contacts } = await supabase
      .from('deal_contacts')
      .select('contact_name, contact_phone, role')
      .eq('deal_id', deal.id)

    return JSON.stringify({ ...deal, related_contacts: contacts || [] })
  },
}

const updateDealStatus: AgentTool = {
  name: 'update_deal_status',
  description: 'Update the status of a deal. ALWAYS get approval first.',
  parameters: {
    deal_id: { type: 'string', description: 'Deal ID' },
    status: { type: 'string', description: "'open', 'won', 'lost', 'deleted'" },
  },
  async execute(params) {
    const id = String(params.deal_id)
    const status = String(params.status)
    if (!id || !status) return JSON.stringify({ error: 'deal_id and status required' })

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('deals')
      .update({ status })
      .eq('id', id)

    if (error) return JSON.stringify({ error: error.message })
    return JSON.stringify({ success: true, message: `Deal status updated to ${status}` })
  },
}

const pipelineAgent: AgentDefinition = {
  id: 'pipeline',
  name: 'Pipeline Agent',
  description: 'Manages real estate deals and Pipedrive pipeline operations',
  systemPrompt: `You are Nora's Pipeline specialist. You manage Gideon's real estate deals.

Your tools:
- list_deals: See current pipeline deals
- get_deal_details: Deep dive into a specific deal and its contacts
- update_deal_status: Change deal status (MUST GET APPROVAL)

Rules:
1. Always be precise about deal values and stages.
2. If Gideon asks "what's the status of the Soho deal?", find the deal first.
3. Report related contacts for deals so Gideon knows who to reach out to.
4. When listing deals, highlight those with high value or recent activity.`,
  tools: [listDeals, getDealDetails, updateDealStatus],
  canHandoffTo: ['orchestrator', 'contact', 'whatsapp', 'email'],
  requiresApproval: true,
  maxToolRounds: 3,
}

registerAgent(pipelineAgent)
export { pipelineAgent }
