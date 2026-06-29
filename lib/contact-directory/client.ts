/**
 * Caller-ID lookup against the contact_directory Supabase table — the
 * phonebook ingested from NonInvestors_Final.xlsx (~939 rows).
 *
 * Used as a fallback when:
 *   1. A phone number arrives via webhook without a Pipedrive match
 *   2. A thread has phone-only and no contact_name
 *
 * Lookup is best-effort — never block the request on this. If Supabase
 * is slow or returns nothing, the caller stays anonymous.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/timelines/normalize-phone'

export interface CallerIdResult {
  canonical_name: string | null
  company: string | null
  title: string | null
  primary_email: string | null
  source: 'pipedrive' | 'xlsx' | 'manual' | 'unknown'
}

/**
 * Look up a phone number in the contact_directory table. Returns null if
 * the table doesn't exist (migration not yet applied) or no match.
 */
export async function lookupByPhone(phone: string | null | undefined): Promise<CallerIdResult | null> {
  if (!phone) return null
  const normalized = normalizePhone(phone) || phone
  const service = createServiceClient()

  // Try exact match on primary_phone first
  const { data: exact, error: exactErr } = await service
    .from('contact_directory')
    .select('canonical_name, company, title, primary_email, source')
    .eq('primary_phone', normalized)
    .limit(1)
    .maybeSingle()

  if (exactErr) {
    // Migration not yet applied → silently degrade
    if (exactErr.message.includes('does not exist') || exactErr.code === '42P01') return null
    console.warn('[contact-directory] lookup error', exactErr.message)
    return null
  }

  if (exact) {
    return {
      canonical_name: exact.canonical_name,
      company: exact.company,
      title: exact.title,
      primary_email: exact.primary_email,
      source: (exact.source as CallerIdResult['source']) || 'xlsx',
    }
  }

  // Fallback — phone might be in all_phones (pipe-delimited). Best-effort
  // partial match on the digits.
  const digits = normalized.replace(/\D/g, '').slice(-10) // last 10 digits (US)
  if (digits.length < 10) return null
  const { data: partial } = await service
    .from('contact_directory')
    .select('canonical_name, company, title, primary_email, source')
    .ilike('all_phones', `%${digits}%`)
    .limit(1)
    .maybeSingle()

  if (partial) {
    return {
      canonical_name: partial.canonical_name,
      company: partial.company,
      title: partial.title,
      primary_email: partial.primary_email,
      source: (partial.source as CallerIdResult['source']) || 'xlsx',
    }
  }

  return null
}

/**
 * Look up a contact by name. Searches canonical_name first (exact + ILIKE),
 * then all_name_variants. Returns the first match with primary_email if any.
 *
 * Used by /api/invitations mint to auto-populate contact_email when the
 * caller (Captain / Chrome Extension) passes only a name — the master
 * RePrime_Command_Center_Master.xlsx already has emails on 1500+ people,
 * so the recipient shouldn't have to type their own email on the booking
 * page if we have it on file.
 */
export async function lookupByName(name: string | null | undefined): Promise<CallerIdResult | null> {
  if (!name) return null
  const trimmed = name.trim()
  if (trimmed.length < 2) return null
  const service = createServiceClient()

  // 1. Exact canonical_name match (case-sensitive first, then ilike)
  const { data: exact } = await service
    .from('contact_directory')
    .select('canonical_name, company, title, primary_email, source')
    .eq('canonical_name', trimmed)
    .not('primary_email', 'is', null)
    .limit(1)
    .maybeSingle()
  if (exact) {
    return {
      canonical_name: exact.canonical_name,
      company: exact.company,
      title: exact.title,
      primary_email: exact.primary_email,
      source: (exact.source as CallerIdResult['source']) || 'xlsx',
    }
  }

  // 2. ILIKE on canonical_name
  const { data: ilike } = await service
    .from('contact_directory')
    .select('canonical_name, company, title, primary_email, source')
    .ilike('canonical_name', trimmed)
    .not('primary_email', 'is', null)
    .limit(1)
    .maybeSingle()
  if (ilike) {
    return {
      canonical_name: ilike.canonical_name,
      company: ilike.company,
      title: ilike.title,
      primary_email: ilike.primary_email,
      source: (ilike.source as CallerIdResult['source']) || 'xlsx',
    }
  }

  // 3. Partial match on all_name_variants
  const { data: variant } = await service
    .from('contact_directory')
    .select('canonical_name, company, title, primary_email, source')
    .ilike('all_name_variants', `%${trimmed}%`)
    .not('primary_email', 'is', null)
    .limit(1)
    .maybeSingle()
  if (variant) {
    return {
      canonical_name: variant.canonical_name,
      company: variant.company,
      title: variant.title,
      primary_email: variant.primary_email,
      source: (variant.source as CallerIdResult['source']) || 'xlsx',
    }
  }

  return null
}

/**
 * Look up an email address. Falls back to all_emails partial match.
 */
export async function lookupByEmail(email: string | null | undefined): Promise<CallerIdResult | null> {
  if (!email) return null
  const lower = email.trim().toLowerCase()
  const service = createServiceClient()

  const { data, error } = await service
    .from('contact_directory')
    .select('canonical_name, company, title, primary_email, source')
    .or(`primary_email.eq.${lower},all_emails.ilike.%${lower}%`)
    .limit(1)
    .maybeSingle()

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') return null
    return null
  }

  if (!data) return null
  return {
    canonical_name: data.canonical_name,
    company: data.company,
    title: data.title,
    primary_email: data.primary_email,
    source: (data.source as CallerIdResult['source']) || 'xlsx',
  }
}
