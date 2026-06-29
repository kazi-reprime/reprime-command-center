'use client'

import {
  DEFAULT_IDENTITY_EMAIL,
  IDENTITY_HEADER,
  getActiveIdentity,
} from '@/lib/identity'

/**
 * Thin `fetch` wrapper that injects the `X-Active-Identity` header on every
 * request. Server routes (e.g. `/api/email/send`) read the header to enforce
 * the roster-lock send-as policy (v1: Gideon-only).
 *
 * Use exactly like `fetch`:
 *
 *   const res = await apiFetch('/api/email/send', {
 *     method: 'POST',
 *     headers: { 'content-type': 'application/json' },
 *     body: JSON.stringify({ to, subject, body }),
 *   })
 *
 * Existing call sites that use the global `fetch` continue to work unchanged.
 * Migrate them to `apiFetch` opportunistically.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const identity =
    typeof window === 'undefined' ? DEFAULT_IDENTITY_EMAIL : getActiveIdentity()

  // Merge headers without clobbering an explicit override from the caller.
  const headers = new Headers(init.headers ?? {})
  if (!headers.has(IDENTITY_HEADER)) {
    headers.set(IDENTITY_HEADER, identity)
  }

  return fetch(input, { ...init, headers })
}

/**
 * Convenience JSON wrapper. Throws on non-2xx with the response text in the
 * error message. Returns parsed JSON of the response body on success.
 */
export async function apiJson<T = unknown>(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers ?? {})
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json')
  }
  const res = await apiFetch(input, { ...init, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`apiFetch ${res.status}: ${text || res.statusText}`)
  }
  return (await res.json()) as T
}
