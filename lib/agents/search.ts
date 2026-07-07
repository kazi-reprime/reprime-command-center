/**
 * Search Agent — Semantic and text search across all data
 * 
 * Searches WhatsApp threads, notes, contacts, deals, email scores.
 */

import { type AgentDefinition, type AgentTool, registerAgent } from './types'
import { createServiceClient } from '@/lib/supabase/server'

const globalSearch: AgentTool = {
  name: 'global_search',
  description: 'Search across all Command Center data — messages, contacts, notes, deals.',
  parameters: {
    query: { type: 'string', description: 'Search query' },
    scope: { type: 'string', description: "'all', 'messages', 'contacts', 'notes', 'deals' (default: 'all')" },
  },
  async execute(params) {
    const q = String(params.query || '').trim()
    if (!q) return JSON.stringify({ error: 'query required' })

    const scope = String(params.scope || 'all')
    const supabase = createServiceClient()
    const results: Record<string, unknown[]> = {}

    // Search WhatsApp threads
    if (scope === 'all' || scope === 'messages') {
      const { data } = await supabase
        .from('whatsapp_threads')
        .select('id, contact_name, phone, panel, last_message_preview')
        .or(`contact_name.ilike.%${q}%,last_message_preview.ilike.%${q}%`)
        .limit(5)
      results.threads = data ?? []
    }

    // Search notes
    if (scope === 'all' || scope === 'notes') {
      const { data } = await supabase
        .from('notes')
        .select('id, title, body, created_at')
        .or(`title.ilike.%${q}%,body.ilike.%${q}%`)
        .limit(5)
      results.notes = data ?? []
    }

    // Search email scores
    if (scope === 'all' || scope === 'contacts') {
      const { data } = await supabase
        .from('email_scores')
        .select('from_address, subject, score')
        .or(`from_address.ilike.%${q}%,subject.ilike.%${q}%`)
        .limit(5)
      results.emails = data ?? []
    }

    const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0)
    return JSON.stringify({ query: q, totalResults, results })
  },
}

const searchAgent: AgentDefinition = {
  id: 'search',
  name: 'Search Agent',
  description: 'Cross-data search across messages, contacts, notes, deals',
  systemPrompt: `You are Nora's Search specialist. You find information across all of Gideon's data.

Your tools:
- global_search: Search across all data types

When searching:
1. Use the most specific scope when possible
2. Present results clearly with source type
3. If results are empty, suggest alternate search terms
4. Highlight the most relevant matches`,
  tools: [globalSearch],
  canHandoffTo: ['orchestrator'],
  maxToolRounds: 2,
}

registerAgent(searchAgent)

export { searchAgent }
