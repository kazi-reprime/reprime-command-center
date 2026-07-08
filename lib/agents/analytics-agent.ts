/**
 * Analytics Agent — High-level business intelligence
 * 
 * Provides summaries of pipeline value, communication volume,
 * and investor activity.
 */

import { type AgentDefinition, type AgentTool, registerAgent } from './types'
import { createServiceClient } from '@/lib/supabase/server'

const getPipelineSummary: AgentTool = {
  name: 'get_pipeline_summary',
  description: 'Get high-level statistics about the current deal pipeline.',
  parameters: {},
  async execute() {
    const supabase = createServiceClient()
    
    const { data: deals, error } = await supabase
      .from('deals')
      .select('value, status, stage_name')

    if (error) return JSON.stringify({ error: error.message })

    const summary = {
      total_deals: deals.length,
      open_deals: deals.filter(d => d.status === 'open').length,
      won_deals: deals.filter(d => d.status === 'won').length,
      total_value: deals.filter(d => d.status === 'open').reduce((sum, d) => sum + (Number(d.value) || 0), 0),
      by_stage: {} as Record<string, number>
    }

    deals.forEach(d => {
      if (d.status === 'open' && d.stage_name) {
        summary.by_stage[d.stage_name] = (summary.by_stage[d.stage_name] || 0) + 1
      }
    })

    return JSON.stringify(summary)
  },
}

const getInvestorStats: AgentTool = {
  name: 'get_investor_stats',
  description: 'Get statistics about LP/Investor capital capacity and status.',
  parameters: {},
  async execute() {
    const supabase = createServiceClient()
    
    const { data: investors, error } = await supabase
      .from('investors')
      .select('capital_capacity, status')

    if (error) return JSON.stringify({ error: error.message })

    const summary = {
      total_investors: investors.length,
      active_investors: investors.filter(i => i.status === 'active').length,
      total_capacity: investors.reduce((sum, i) => sum + (Number(i.capital_capacity) || 0), 0),
    }

    return JSON.stringify(summary)
  },
}

const analyticsAgent: AgentDefinition = {
  id: 'analytics',
  name: 'Analytics Agent',
  description: 'Business intelligence and performance tracking',
  systemPrompt: `You are Nora's Business Intelligence specialist. You provide Gideon with high-level performance metrics.

Your tools:
- get_pipeline_summary: Overview of deals, value, and stages
- get_investor_stats: Overview of investor capacity and activity

Rules:
1. Provide summaries in a clear, executive-friendly format.
2. Highlight significant numbers (e.g., "Total pipeline value is $150M").
3. If Gideon asks "how are we doing?", provide a mix of pipeline and investor stats.
4. Always ground your numbers in the real database data.`,
  tools: [getPipelineSummary, getInvestorStats],
  canHandoffTo: ['orchestrator', 'pipeline'],
  maxToolRounds: 2,
}

registerAgent(analyticsAgent)
export { analyticsAgent }
