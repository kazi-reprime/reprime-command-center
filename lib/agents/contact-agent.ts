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

const contactAgent: AgentDefinition = {
  id: 'contact',
  name: 'Contact Agent',
  description: 'Contact resolution and enrichment across all data sources',
  systemPrompt: `You are Nora's Contact specialist. You find and enrich contact information.

Your tools:
- find_contact: Search for contacts by name, phone, or email
- get_contact_context: Get full context about a contact (deals, investor status, interactions)

When resolving contacts:
1. Search across all sources — don't stop at the first match
2. Cross-reference WhatsApp, email, CRM, and investor data
3. Report investor status and deal involvement when found
4. Include last interaction timestamps`,
  tools: [findContact, getContactContext],
  canHandoffTo: ['orchestrator', 'communications', 'whatsapp', 'email'],
  maxToolRounds: 2,
}

registerAgent(contactAgent)
export { contactAgent }
