/**
 * WhatsApp Agent — Dedicated WhatsApp operations for Nora
 *
 * Separate from the general communications agent for focused
 * WhatsApp-specific tools: thread search, message read, media send,
 * contact resolution, cross-channel history.
 */

import { type AgentDefinition, type AgentTool, registerAgent } from './types'
import { createServiceClient } from '@/lib/supabase/server'

const searchThreads: AgentTool = {
  name: 'search_whatsapp_threads',
  description: 'Search WhatsApp threads by contact name. Returns threads with contact info, unread count, and last message.',
  parameters: {
    contact_name: { type: 'string', description: 'Full or partial contact name' },
  },
  async execute(params) {
    const name = String(params.contact_name || '').trim()
    if (!name) return JSON.stringify({ error: 'contact_name required' })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('whatsapp_threads')
      .select('id, contact_name, phone, panel, channel_type, is_investor, is_staff, is_family, unread_count, last_message_at, last_message_preview')
      .ilike('contact_name', `%${name}%`)
      .order('last_message_at', { ascending: false })
      .limit(10)

    if (error) return JSON.stringify({ error: error.message })
    if (!data?.length) return JSON.stringify({ message: `No threads matching "${name}"`, threads: [] })
    return JSON.stringify({ count: data.length, threads: data })
  },
}

const readMessages: AgentTool = {
  name: 'read_whatsapp_messages',
  description: 'Read recent messages from a WhatsApp thread by thread ID.',
  parameters: {
    thread_id: { type: 'string', description: 'Thread UUID' },
    limit: { type: 'number', description: 'Max messages (default 20)' },
  },
  async execute(params) {
    const threadId = String(params.thread_id || '')
    if (!threadId) return JSON.stringify({ error: 'thread_id required' })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('id, direction, body, media_type, media_url, from_name, sent_at, status')
      .eq('thread_id', threadId)
      .order('sent_at', { ascending: false })
      .limit(Math.min(Number(params.limit) || 20, 50))

    if (error) return JSON.stringify({ error: error.message })
    return JSON.stringify({ count: data?.length || 0, messages: (data || []).reverse() })
  },
}

const checkUnread: AgentTool = {
  name: 'check_whatsapp_unread',
  description: 'Check unread WhatsApp message counts across all panels.',
  parameters: {},
  async execute() {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('whatsapp_threads')
      .select('panel, unread_count, is_investor')

    if (error) return JSON.stringify({ error: error.message })

    const counts = { '305': 0, '718': 0, investors: 0, total: 0 }
    for (const t of data ?? []) {
      const row = t as { panel: string; unread_count: number; is_investor: boolean }
      if (row.is_investor && row.unread_count > 0) {
        counts.investors += row.unread_count
      } else if (row.panel === '305') {
        counts['305'] += row.unread_count || 0
      } else if (row.panel === '718') {
        counts['718'] += row.unread_count || 0
      }
    }
    counts.total = counts['305'] + counts['718'] + counts.investors
    return JSON.stringify(counts)
  },
}

const sendMessage: AgentTool = {
  name: 'send_whatsapp_message',
  description: 'Send a WhatsApp message via the gateway. ALWAYS present the draft for approval first.',
  parameters: {
    to: { type: 'string', description: 'Phone number with country code (e.g., +1...)' },
    body: { type: 'string', description: 'Message text' },
    lane: { type: 'string', description: "'305' or '718' (defaults to 305)" },
  },
  async execute(params) {
    const { gateway } = await import('@/lib/gateway')
    const result = await gateway.sendWhatsApp({
      to: String(params.to),
      body: String(params.body),
      lane: (params.lane as '305' | '718') || '305',
    })

    if (result.success) {
      return JSON.stringify({
        success: true,
        provider: result.providerId,
        providerChain: result.providerChain,
      })
    }
    return JSON.stringify({ error: result.error, providers_tried: result.providerChain })
  },
}

const resolveContact: AgentTool = {
  name: 'resolve_contact',
  description: 'Find a contact by name or phone number across all sources (WhatsApp, Contacts, Pipedrive).',
  parameters: {
    query: { type: 'string', description: 'Contact name or phone number' },
  },
  async execute(params) {
    const query = String(params.query || '').trim()
    if (!query) return JSON.stringify({ error: 'query required' })

    const { resolveContactByName, resolveContactByPhone } = await import(
      '@/lib/whatsapp/contact-resolver'
    )

    // Try as phone first if it looks like a number
    if (/^\+?\d[\d\s()-]{6,}$/.test(query)) {
      const contact = await resolveContactByPhone(query)
      if (contact) return JSON.stringify({ found: true, contact })
    }

    // Search by name
    const contacts = await resolveContactByName(query)
    if (contacts.length === 0) return JSON.stringify({ found: false, message: `No contact found for "${query}"` })
    return JSON.stringify({ found: true, count: contacts.length, contacts })
  },
}

const getCrossChannelHistory: AgentTool = {
  name: 'get_cross_channel_history',
  description: 'Get communication history for a contact across WhatsApp and Email.',
  parameters: {
    phone: { type: 'string', description: 'Contact phone number' },
  },
  async execute(params) {
    const phone = String(params.phone || '').trim()
    if (!phone) return JSON.stringify({ error: 'phone required' })

    const { getCrossChannelHistory: getHistory } = await import(
      '@/lib/whatsapp/contact-resolver'
    )
    const history = await getHistory(phone)
    return JSON.stringify(history)
  },
}

const whatsappAgent: AgentDefinition = {
  id: 'whatsapp',
  name: 'WhatsApp Agent',
  description: 'WhatsApp messaging — threads, messages, send, contacts, cross-channel history',
  systemPrompt: `You are Nora's WhatsApp specialist. You manage Gideon's executive communications.
  
Gideon depends on you to handle his messages with zero friction.

Your tools:
- search_whatsapp_threads: Find threads by contact name
- read_whatsapp_messages: Read messages from a thread
- check_whatsapp_unread: Get unread counts across panels
- send_whatsapp_message: Send a message (GET APPROVAL FIRST)
- resolve_contact: Find contact info by name or phone (USE THIS FIRST for new recipients)
- get_cross_channel_history: See all communication with a contact

CRITICAL RULES:
1. NEVER send a message without presenting the draft to Gideon first.
2. If Gideon says "Send this to [Name]", first use resolve_contact or hand off to [HANDOFF:contact] to get the correct number.
3. You are an all-seeing assistant. If you find multiple numbers, ask Gideon which one to use.
4. Be proactive. If there are many unread messages from investors, suggest a summary or a batch reply.
5. Code-switch Hebrew naturally if the contact is Israeli.`,
  tools: [searchThreads, readMessages, checkUnread, sendMessage, resolveContact, getCrossChannelHistory],
  canHandoffTo: ['orchestrator', 'email', 'contact'],
  requiresApproval: true,
  maxToolRounds: 3,
}

registerAgent(whatsappAgent)
export { whatsappAgent }
