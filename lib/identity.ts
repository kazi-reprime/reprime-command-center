'use client'

import { useEffect, useState } from 'react'

/**
 * Identity registry — Wave 1 / Track F
 *
 * Roster lock 2026-05-05: Gideon + 6 team members (Shirel, Steve, Adir, Yaron,
 * Chaim, Kazi). Amelia and Dovber are OFF the roster — see `_ops-context/team-roster.md`.
 *
 * v1 send-as policy: ONLY Gideon (`g@reprime.com`) may act as a send-as
 * identity. The other five appear in the picker as "view-as" rows with a
 * lock badge. Outbound endpoints (e.g. `/api/email/send`) hard-reject any
 * `X-Active-Identity` other than Gideon with HTTP 403.
 *
 * Adir Yonasi (VP Investor Relations) is investor-side only — never appears
 * on broker-facing materials. He still appears here as a view-as identity so
 * Gideon can see Adir's queue, but he cannot act as send-as.
 */

export interface Identity {
  email: string
  displayName: string
  role: string
  /** Only `true` for Gideon in v1. Other identities are view-only. */
  sendAsAllowed: boolean
}

export const IDENTITIES: readonly Identity[] = [
  {
    email: 'g@reprime.com',
    displayName: 'Gideon Gratsiani',
    role: 'Principal',
    sendAsAllowed: true,
  },
  {
    email: 'shirel@reprime.com',
    displayName: 'Shirel Ben-Haroush',
    role: 'SVP / Partner',
    sendAsAllowed: false,
  },
  {
    email: 'steve@reprime.com',
    displayName: 'Steve Philipp',
    role: 'AI / Email Automation',
    sendAsAllowed: false,
  },
  {
    email: 'adir@reprime.com',
    displayName: 'Adir Yonasi',
    role: 'VP Investor Relations',
    sendAsAllowed: false,
  },
  {
    email: 'yaron@reprime.com',
    displayName: 'Yaron Sitbon',
    role: 'Israel Division',
    sendAsAllowed: false,
  },
  {
    email: 'chaim@reprime.com',
    displayName: 'Chaim Abrahams',
    role: 'Co-Founder',
    sendAsAllowed: false,
  },
  {
    email: 'kazi@reprime.com',
    displayName: 'Kazi Musharraf',
    role: 'AI Engineer',
    sendAsAllowed: false,
  },
] as const

export const DEFAULT_IDENTITY_EMAIL = 'g@reprime.com'
const STORAGE_KEY = 'active-identity'
const EVENT_NAME = 'identity-changed'

export interface IdentityChangedDetail {
  identity: string
}

/**
 * Look up an Identity by email. Returns the Gideon record as a safe fallback
 * if the email is unknown or storage is corrupted.
 */
export function getIdentityByEmail(email: string | null | undefined): Identity {
  if (!email) {
    return IDENTITIES[0]
  }
  const found = IDENTITIES.find((i) => i.email === email)
  return found ?? IDENTITIES[0]
}

/**
 * Read the active identity email from localStorage. Falls back to Gideon
 * if storage is empty, unavailable (SSR), or contains an unknown email.
 */
export function getActiveIdentity(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_IDENTITY_EMAIL
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_IDENTITY_EMAIL
    // Validate against known roster — never return a stale/unknown email.
    const known = IDENTITIES.find((i) => i.email === raw)
    return known ? known.email : DEFAULT_IDENTITY_EMAIL
  } catch {
    return DEFAULT_IDENTITY_EMAIL
  }
}

/**
 * Persist the active identity and broadcast an `identity-changed` window
 * event. Silently no-ops if the email is not in the roster.
 */
export function setActiveIdentity(email: string): void {
  if (typeof window === 'undefined') return
  const known = IDENTITIES.find((i) => i.email === email)
  if (!known) return
  try {
    window.localStorage.setItem(STORAGE_KEY, known.email)
  } catch {
    // localStorage may be unavailable (private mode, quota). Still dispatch
    // the event so in-memory listeners stay consistent for the session.
  }
  const event = new CustomEvent<IdentityChangedDetail>(EVENT_NAME, {
    detail: { identity: known.email },
  })
  window.dispatchEvent(event)
}

/**
 * React hook subscribing to the `identity-changed` window event. Returns the
 * currently active identity email and stays in sync across components.
 */
export function useActiveIdentity(): string {
  const [identity, setIdentity] = useState<string>(DEFAULT_IDENTITY_EMAIL)

  useEffect(() => {
    setIdentity(getActiveIdentity())

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<IdentityChangedDetail>).detail
      if (detail?.identity) {
        setIdentity(detail.identity)
      }
    }

    // Cross-tab sync: if another tab writes the storage key, follow it.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setIdentity(getActiveIdentity())
      }
    }

    window.addEventListener(EVENT_NAME, onChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(EVENT_NAME, onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return identity
}

export const IDENTITY_HEADER = 'X-Active-Identity'
export const IDENTITY_STORAGE_KEY = STORAGE_KEY
export const IDENTITY_EVENT = EVENT_NAME
