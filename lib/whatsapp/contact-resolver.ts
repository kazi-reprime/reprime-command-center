/**
 * WhatsApp Contact Resolver
 *
 * Unified contact resolution across:
 * - Supabase contacts table
 * - WhatsApp threads (contact_name)
 * - Pipedrive CRM
 *
 * Normalizes phone numbers and resolves names bidirectionally.
 */

import { createServiceClient } from '@/lib/supabase/server'

export interface ResolvedContact {
  phone: string
  name: string
  email?: string
  company?: string
  isInvestor: boolean
  isStaff: boolean
  isFamily: boolean
  source: 'contacts' | 'whatsapp' | 'pipedrive' | 'unknown'
  pipedriveId?: number
}

/**
 * Normalize a phone number to E.164-ish format.
 * Handles common patterns: (305) 778-4861, +1-305-778-4861, 3057784861
 */
export function normalizePhoneNumber(phone: string): string {
  // Strip everything except digits and leading +
  let digits = phone.replace(/[^\d+]/g, '')

  // Remove leading + for processing
  const hasPlus = digits.startsWith('+')
  if (hasPlus) digits = digits.slice(1)

  // If 10 digits (US without country code), prepend 1
  if (digits.length === 10) digits = '1' + digits

  // If starts with 972 and is Israeli number
  if (digits.startsWith('972')) return '+' + digits

  // Default: add + prefix
  return '+' + digits
}

/**
 * Resolve a contact by phone number.
 * Searches across all data sources and returns the best match.
 */
export async function resolveContactByPhone(phone: string): Promise<ResolvedContact | null> {
  const normalized = normalizePhoneNumber(phone)
  const last9 = normalized.replace(/\D/g, '').slice(-9)
  if (!last9) return null

  const supabase = createServiceClient()

  // 1. Check contacts table
  const { data: contacts } = await supabase
    .from('contacts')
    .select('name, phone, email, company, is_investor, is_staff')
    .or(`phone.like.%${last9}`)
    .limit(1)

  if (contacts?.length) {
    const c = contacts[0] as {
      name: string
      phone: string
      email: string | null
      company: string | null
      is_investor: boolean
      is_staff: boolean
    }
    return {
      phone: normalized,
      name: c.name,
      email: c.email || undefined,
      company: c.company || undefined,
      isInvestor: c.is_investor,
      isStaff: c.is_staff,
      isFamily: false,
      source: 'contacts',
    }
  }

  // 2. Check WhatsApp threads
  const { data: threads } = await supabase
    .from('whatsapp_threads')
    .select('contact_name, phone, is_investor, is_staff, is_family')
    .or(`phone.like.%${last9}`)
    .limit(1)

  if (threads?.length) {
    const t = threads[0] as {
      contact_name: string | null
      phone: string
      is_investor: boolean
      is_staff: boolean
      is_family: boolean
    }
    return {
      phone: normalized,
      name: t.contact_name || normalized,
      isInvestor: t.is_investor,
      isStaff: t.is_staff,
      isFamily: t.is_family,
      source: 'whatsapp',
    }
  }

  // 3. Try Pipedrive
  try {
    const { findPersonByPhone } = await import('@/lib/pipedrive/client')
    const person = await findPersonByPhone(normalized)
    if (person) {
      return {
        phone: normalized,
        name: (person as { name?: string }).name || normalized,
        email: ((person as { email?: Array<{ value: string }> }).email?.[0]?.value) || undefined,
        company: ((person as { org_name?: string }).org_name) || undefined,
        isInvestor: false,
        isStaff: false,
        isFamily: false,
        source: 'pipedrive',
        pipedriveId: (person as { id?: number }).id,
      }
    }
  } catch {
    // Pipedrive not configured or failed — not fatal
  }

  return null
}

/**
 * Resolve a contact by name (fuzzy search).
 * Returns best matches across all sources.
 */
export async function resolveContactByName(name: string): Promise<ResolvedContact[]> {
  if (!name.trim()) return []

  const supabase = createServiceClient()
  const results: ResolvedContact[] = []

  // Search contacts table
  const { data: contacts } = await supabase
    .from('contacts')
    .select('name, phone, email, company, is_investor, is_staff')
    .ilike('name', `%${name}%`)
    .limit(5)

  for (const c of contacts || []) {
    const row = c as {
      name: string
      phone: string | null
      email: string | null
      company: string | null
      is_investor: boolean
      is_staff: boolean
    }
    if (row.phone) {
      results.push({
        phone: row.phone,
        name: row.name,
        email: row.email || undefined,
        company: row.company || undefined,
        isInvestor: row.is_investor,
        isStaff: row.is_staff,
        isFamily: false,
        source: 'contacts',
      })
    }
  }

  // Search WhatsApp threads
  const { data: threads } = await supabase
    .from('whatsapp_threads')
    .select('contact_name, phone, is_investor, is_staff, is_family')
    .ilike('contact_name', `%${name}%`)
    .limit(5)

  for (const t of threads || []) {
    const row = t as {
      contact_name: string | null
      phone: string
      is_investor: boolean
      is_staff: boolean
      is_family: boolean
    }
    // Avoid duplicates
    if (!results.find(r => r.phone.endsWith(row.phone.replace(/\D/g, '').slice(-9)))) {
      results.push({
        phone: row.phone,
        name: row.contact_name || row.phone,
        isInvestor: row.is_investor,
        isStaff: row.is_staff,
        isFamily: row.is_family,
        source: 'whatsapp',
      })
    }
  }

  return results
}

/**
 * Get cross-channel history for a contact.
 * Returns WhatsApp + Email activity for the same person.
 */
export async function getCrossChannelHistory(phone: string): Promise<{
  whatsapp: { threadId: string; lastMessage: string; lastAt: string }[]
  email: { from: string; subject: string; receivedAt: string }[]
}> {
  const last9 = phone.replace(/\D/g, '').slice(-9)
  const supabase = createServiceClient()

  // WhatsApp threads
  const { data: waThreads } = await supabase
    .from('whatsapp_threads')
    .select('id, last_message_preview, last_message_at')
    .or(`phone.like.%${last9}`)
    .order('last_message_at', { ascending: false })
    .limit(5)

  // Resolve contact email for email search
  const contact = await resolveContactByPhone(phone)
  let emailResults: Array<{ from: string; subject: string; receivedAt: string }> = []

  if (contact?.email) {
    const { data: emails } = await supabase
      .from('email_scores')
      .select('from_address, subject, reasons')
      .eq('from_address', contact.email)
      .order('scored_at', { ascending: false })
      .limit(5)

    emailResults = (emails || []).map((e: Record<string, unknown>) => ({
      from: String(e.from_address || ''),
      subject: String(e.subject || ''),
      receivedAt: String((e.reasons as Record<string, unknown>)?.received_at || ''),
    }))
  }

  return {
    whatsapp: (waThreads || []).map((t: Record<string, unknown>) => ({
      threadId: String(t.id),
      lastMessage: String(t.last_message_preview || ''),
      lastAt: String(t.last_message_at || ''),
    })),
    email: emailResults,
  }
}
