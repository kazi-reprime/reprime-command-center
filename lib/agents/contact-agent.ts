/**
 * Contact Agent — Cross-platform contact resolution
 *
 * Searches across WhatsApp, Gmail contacts, Pipedrive CRM, and Supabase
 * to find and enrich contact information for other agents.
 */

import { type AgentDefinition, type AgentTool, registerAgent } from './types'
import { createServiceClient } from '@/lib/supabase/server'

const findContact: AgentTool = {
  name: 'find_contact',
  description: 'Search for a contact across all sources by name, phone, or email.',
  parameters: {
    query: { type: 'string', description: 'Name, phone number, or email to search for' },
  },
  async execute(params) {
    const query = String(params.query || '').trim()
    if (!query) return JSON.stringify({ error: 'query required' })

    const supabase = createServiceClient()
    const results: Array<Record<string, unknown>> = []

    // Search contacts table
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, phone, email, company, is_investor, is_staff')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(5)

    for (const c of contacts || []) {
      results.push({ source: 'contacts', ...c })
    }

    // Search WhatsApp threads
    const { data: threads } = await supabase
      .from('whatsapp_threads')
      .select('contact_name, phone, panel, is_investor, is_staff, last_message_at')
      .or(`contact_name.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(5)

    for (const t of threads || []) {
      results.push({ source: 'whatsapp', ...t })
    }

    // Search investors
    const { data: investors } = await supabase
      .from('investors')
      .select('id, name, contact_phone, capital_capacity, preferred_deal_type, status')
      .ilike('name', `%${query}%`)
      .limit(3)

    for (const i of investors || []) {
      results.push({ source: 'investors', ...i })
    }

    return JSON.stringify({ count: results.length, contacts: results })
  },
}

const getContactContext: AgentTool = {
  name: 'get_contact_context',
  description: 'Get full context about a contact: deals, investor status, recent interactions, meeting history.',
  parameters: {
    name: { type: 'string', description: 'Contact name' },
    phone: { type: 'string', description: 'Contact phone (optional)' },
  },
  async execute(params) {
    const name = String(params.name || '').trim()
    if (!name) return JSON.stringify({ error: 'name required' })

    const supabase = createServiceClient()
    const context: Record<string, unknown> = { name }

    // Get WhatsApp thread info
    const { data: threads } = await supabase
      .from('whatsapp_threads')
      .select('panel, unread_count, last_message_at, last_message_preview, is_investor, is_priority')
      .ilike('contact_name', `%${name}%`)
      .limit(3)

    if (threads?.length) {
      context.whatsapp = threads
    }

    // Get investor info
    const { data: investor } = await supabase
      .from('investors')
      .select('id, capital_capacity, preferred_deal_type, status, investor_score, last_interaction_at')
      .ilike('name', `%${name}%`)
      .single()

    if (investor) {
      context.investor = investor
    }

    // Get recent email interactions
    const { data: emails } = await supabase
      .from('email_scores')
      .select('from_address, subject, score, scored_at')
      .ilike('from_address', `%${name.split(' ')[0].toLowerCase()}%`)
      .order('scored_at', { ascending: false })
      .limit(3)

    if (emails?.length) {
      context.recentEmails = emails
    }

    // Get deal connections
    const { data: dealContacts } = await supabase
      .from('deal_contacts')
      .select('role, deal_id')
      .ilike('contact_phone', `%${String(params.phone || '')}%`)
      .limit(3)

    if (dealContacts?.length) {
      context.deals = dealContacts
    }

    return JSON.stringify(context)
  },
}

const listTeam: AgentTool = {
  name: 'list_team',
  description: 'List all RePrime team members with their roles, locations, and contact info.',
  parameters: {},
  async execute() {
    const { STAFF_REGISTRY, NORA_IDENTITY } = await import('@/lib/data/staff-registry')
    return JSON.stringify({
      team: STAFF_REGISTRY.map(s => ({
        name: s.name,
        role: s.role,
        title: s.title,
        email: s.email || 'not on file',
        phone: s.phone || 'not on file',
        location: s.location || 'not specified',
        department: s.department,
        isFounder: s.isFounder,
      })),
      nora: NORA_IDENTITY,
    })
  },
}

const searchPipedrive: AgentTool = {
  name: 'search_pipedrive',
  description: 'Search Pipedrive CRM for deals, contacts, or organizations by keyword.',
  parameters: {
    query: { type: 'string', description: 'Search term (name, deal, company)' },
    type: { type: 'string', description: "'deals', 'persons', or 'organizations' (default: all)" },
  },
  async execute(params) {
    const query = String(params.query || '').trim()
    if (!query) return JSON.stringify({ error: 'query required' })

    const apiToken = process.env.PIPEDRIVE_API_TOKEN
    if (!apiToken) return JSON.stringify({ error: 'Pipedrive not configured' })

    const searchType = params.type || ''
    const types = searchType || 'deal,person,organization'
    
    try {
      const res = await fetch(
        `https://api.pipedrive.com/v1/itemSearch?term=${encodeURIComponent(query)}&item_types=${types}&limit=10&api_token=${apiToken}`,
      )
      if (!res.ok) return JSON.stringify({ error: `Pipedrive API error: ${res.status}` })
      const data = await res.json()
      const items = data.data?.items || []
      return JSON.stringify({
        count: items.length,
        results: items.map((item: Record<string, unknown>) => {
          const i = item.item as Record<string, unknown>
          return {
            type: item.result_score ? 'scored' : (item as Record<string, unknown>).type,
            id: i?.id,
            title: i?.title || i?.name,
            status: i?.status,
            value: i?.value,
            organization: (i?.organization as Record<string, unknown>)?.name,
          }
        }),
      })
    } catch (err) {
      return JSON.stringify({ error: (err as Error).message })
    }
  },
}

const resolveRecipient: AgentTool = {
  name: 'resolve_recipient',
  description: 'Fuzzy search for a recipient based on name, deal title, or relationship. Use this when Gideon says "send this to the guy from [Deal]" or "find the contact for [Company]".',
  parameters: {
    query: { type: 'string', description: 'Fuzzy query (e.g., "guy from Soho deal", "investor at Blackstone")' },
  },
  async execute(params) {
    const query = String(params.query || '').trim()
    const supabase = createServiceClient()
    
    // 1. Search deals first if query mentioned a deal
    const { data: deals } = await supabase
      .from('deals')
      .select('id, title')
      .ilike('title', `%${query.replace(/(guy from|deal|about)/gi, '').trim()}%`)
      .limit(3)

    let relatedContacts: any[] = []
    if (deals?.length) {
      const { data: contacts } = await supabase
        .from('deal_contacts')
        .select('contact_name, contact_phone, role')
        .in('deal_id', deals.map(d => d.id))
      relatedContacts = contacts || []
    }

    // 2. Search general contacts
    const { data: general } = await supabase
      .from('contacts')
      .select('name, email, phone, company')
      .or(`name.ilike.%${query}%,company.ilike.%${query}%`)
      .limit(5)

    return JSON.stringify({
      suggested: relatedContacts.length > 0 ? relatedContacts : general,
      context: deals?.length ? `Found relevant deals: ${deals.map(d => d.title).join(', ')}` : 'Searched general contacts'
    })
  },
}

const contactAgent: AgentDefinition = {
  id: 'contact',
  name: 'Contact Agent',
  description: 'Contact resolution and enrichment across all data sources',
  systemPrompt: `You are Nora's Contact specialist. You find and enrich contact information.

Your tools:
- find_contact: Search for contacts by name, phone, or email across all sources
- resolve_recipient: Fuzzy search for people based on deal or context (USE THIS for "the guy from...")
- get_contact_context: Get full context about a contact (deals, investor status, interactions)
- list_team: List all RePrime team members with roles, locations, contacts
- search_pipedrive: Search Pipedrive CRM for deals, persons, organizations

When resolving contacts:
1. Search across ALL sources — WhatsApp, email, CRM, investors, team
2. Cross-reference to build a complete profile
3. Report investor status and deal involvement when found
4. Distinguish staff from external contacts
5. If Gideon is vague ("that guy"), use resolve_recipient to check deal associations.`,
  tools: [findContact, resolveRecipient, getContactContext, listTeam, searchPipedrive],
  canHandoffTo: ['orchestrator', 'communications', 'whatsapp', 'email'],
  maxToolRounds: 3,
}

registerAgent(contactAgent)
export { contactAgent }

