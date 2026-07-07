/**
 * RePrime Staff Registry
 *
 * Central registry of all team members with classification data.
 * Used by Nora, contact search, WhatsApp thread enrichment, and staff panels.
 */

export interface StaffMember {
  name: string
  role: string
  title: string
  email?: string
  phone?: string
  whatsappPanel?: '305' | '718'
  location?: string
  department: 'executive' | 'operations' | 'tech' | 'investor-relations' | 'international'
  isFounder: boolean
  /** Avatar initials for UI */
  initials: string
}

export const STAFF_REGISTRY: StaffMember[] = [
  {
    name: 'Gideon Gratsiani',
    role: 'Co-Founder',
    title: 'Co-Founder & Managing Principal',
    email: 'g@reprime.com',
    phone: '+13057784861',
    whatsappPanel: '305',
    location: 'Miami / New York',
    department: 'executive',
    isFounder: true,
    initials: 'GG',
  },
  {
    name: 'Chaim Abrahams',
    role: 'Co-Founder',
    title: 'Co-Founder & Operational Leadership',
    location: 'New York',
    department: 'executive',
    isFounder: true,
    initials: 'CA',
  },
  {
    name: 'Steve Philipp',
    role: 'AVP, Acquisitions & Technology Strategy',
    title: 'Assistant Vice President, Acquisitions & Technology Strategy',
    location: 'National',
    department: 'operations',
    isFounder: false,
    initials: 'SP',
  },
  {
    name: 'Yaron Sitbon',
    role: 'Israel Operations',
    title: 'Colonel (Res.) — Israel Operations & International Investor Coordination',
    location: 'Israel',
    department: 'international',
    isFounder: false,
    initials: 'YS',
  },
  {
    name: 'Adir Yonasi',
    role: 'VP, Investor Relations',
    title: 'Vice President, Investor Relations',
    department: 'investor-relations',
    isFounder: false,
    initials: 'AY',
  },
  {
    name: 'Kazi Musharraf',
    role: 'AI Engineer',
    title: 'AI Engineer — AI-Powered Solutions',
    department: 'tech',
    isFounder: false,
    initials: 'KM',
  },
]

/** Nora's own identity */
export const NORA_IDENTITY = {
  name: 'Nora',
  role: 'AI Executive Assistant',
  email: 'nora@reprime.com',
  phone: '+19179703154',
  keypadCode: '770770',
  voice: 'ElevenLabs Nora',
  brain: 'Anthropic Claude (primary) | OpenAI GPT-4o (fallback) | Groq (fast)',
}

/** Quick lookup */
export function findStaffByName(query: string): StaffMember | undefined {
  const lower = query.toLowerCase()
  return STAFF_REGISTRY.find(
    s =>
      s.name.toLowerCase().includes(lower) ||
      s.initials.toLowerCase() === lower ||
      s.role.toLowerCase().includes(lower),
  )
}

export function isStaffPhone(phone: string): boolean {
  return STAFF_REGISTRY.some(s => s.phone && phone.includes(s.phone.replace('+', '')))
}

export function isStaffEmail(email: string): boolean {
  return STAFF_REGISTRY.some(s => s.email && s.email.toLowerCase() === email.toLowerCase())
}
