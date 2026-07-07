/**
 * Communications Agent — WhatsApp, SMS, Email message handling
 * 
 * Tools: search threads, read messages, draft replies, send messages.
 * All sends go through the Integration Gateway for failover.
 */

import { type AgentDefinition, type AgentTool, registerAgent } from './types'
import { createServiceClient } from '@/lib/supabase/server'

// ── Tools ──────────────────────────────────────────────────────────────────────

const searchWhatsApp: AgentTool = {
  name: 'search_whatsapp',
  description: 'Search WhatsApp threads by contact name. Returns threads with contact, phone, panel, unread count, and last message.',
  parameters: {
    contact_name: { type: 'string', description: 'Full or partial contact name to search for' },
  },
  async execute(params) {
    const name = String(params.contact_name || '').trim()
    if (!name) return JSON.stringify({ error: 'contact_name required' })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('whatsapp_threads')
      .select('id, contact_name, phone, panel, channel_type, is_investor, unread_count, last_message_at, last_message_preview')
      .ilike('contact_name', `%${name}%`)
      .order('last_message_at', { ascending: false })
      .limit(10)

    if (error) return JSON.stringify({ error: error.message })
    if (!data?.length) return JSON.stringify({ message: `No threads matching "${name}"`, threads: [] })
    return JSON.stringify({ count: data.length, threads: data })
  },
}

const checkUnread: AgentTool = {
  name: 'check_unread',
  description: 'Check unread WhatsApp message counts across all panels (305, 718, investors).',
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

const sendWhatsApp: AgentTool = {
  name: 'send_whatsapp',
  description: 'Send a WhatsApp message via the gateway. Requires Gideon\'s approval — draft the message and present it for review.',
  parameters: {
    to: { type: 'string', description: 'Phone number with country code' },
    body: { type: 'string', description: 'Message text' },
    lane: { type: 'string', description: '305 or 718 (defaults to 305)' },
  },
  async execute(params) {
    const { gateway } = await import('@/lib/gateway')
    const result = await gateway.sendWhatsApp({
      to: String(params.to),
      body: String(params.body),
      lane: (params.lane as '305' | '718') || '305',
    })

    if (result.success) {
      return JSON.stringify({ success: true, provider: result.providerId, message: 'Message sent' })
    }
    return JSON.stringify({ error: result.error, providers_tried: result.providerChain })
  },
}

const readEmails: AgentTool = {
  name: 'read_emails',
  description: 'Fetch highest-priority triaged emails from the database.',
  parameters: {
    limit: { type: 'number', description: 'Max emails (default 10, max 30)' },
    min_score: { type: 'number', description: 'Minimum triage score (default 5)' },
  },
  async execute(params) {
    const limit = Math.min(Number(params.limit) || 10, 30)
    const minScore = Number(params.min_score) || 5
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('email_scores')
      .select('message_id, thread_id, from_address, subject, score, reasons, scored_at')
      .gte('score', minScore)
      .order('score', { ascending: false })
      .order('scored_at', { ascending: false })
      .limit(limit)

    if (error) return JSON.stringify({ error: error.message })

    const emails = (data ?? []).map((r: Record<string, unknown>) => {
      const reasons = (r.reasons || {}) as Record<string, unknown>
      return {
        from: r.from_address,
        from_name: reasons.from_name || '',
        subject: r.subject || '',
        snippet: reasons.snippet || '',
        score: r.score,
        unread: !!reasons.unread,
      }
    })
    return JSON.stringify({ count: emails.length, emails })
  },
}

const sendEmail: AgentTool = {
  name: 'send_email',
  description: 'Send an email via the gateway (Gmail primary, SendGrid fallback).',
  parameters: {
    to: { type: 'string', description: 'Recipient email' },
    subject: { type: 'string', description: 'Email subject' },
    body: { type: 'string', description: 'Email body text' },
  },
  async execute(params) {
    const { gateway } = await import('@/lib/gateway')
    const result = await gateway.sendEmail({
      to: String(params.to),
      subject: String(params.subject),
      body: String(params.body),
    })

    if (result.success) {
      return JSON.stringify({ success: true, provider: result.providerId })
    }
    return JSON.stringify({ error: result.error, providers_tried: result.providerChain })
  },
}

// ── Agent Definition ───────────────────────────────────────────────────────────

const communicationsAgent: AgentDefinition = {
  id: 'communications',
  name: 'Communications Agent',
  description: 'Handles WhatsApp, SMS, email messages — search, read, draft, send',
  systemPrompt: `You are Nora's Communications specialist. You handle all messaging tasks for Gideon.

Your tools:
- search_whatsapp: Find WhatsApp threads by name
- check_unread: Get unread counts across panels  
- send_whatsapp: Send a WhatsApp message (get approval first!)
- read_emails: Get priority emails
- send_email: Send an email

CRITICAL RULES:
1. NEVER send a message without presenting the draft to Gideon first
2. Always use tools to fetch real data — never invent message content
3. For "send to X", first search for X to get their phone number
4. Format phone numbers with country code
5. Be concise in your responses`,
  tools: [searchWhatsApp, checkUnread, sendWhatsApp, readEmails, sendEmail],
  canHandoffTo: ['orchestrator'],
  requiresApproval: true,
  maxToolRounds: 3,
}

registerAgent(communicationsAgent)

export { communicationsAgent }
