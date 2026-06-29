/**
 * Bulk upsert of contact rows into Pipedrive Persons.
 *
 * Dedupe order: email first, phone second. If a match is found, PATCH
 * the existing record — only fields the person doesn't already have are
 * added. If no match, POST a new person.
 *
 * Pure logic. The route handler wraps this with auth + SSE streaming.
 */

import {
  PIPEDRIVE_FIELD_KEYS,
  type PipedriveContactValue,
  type PipedrivePerson,
  createPerson,
  findOrCreateOrganization,
  findPersonByEmail,
  findPersonByPhone,
  updatePerson,
} from '@/lib/pipedrive/client'
import { normalizePhone } from '@/lib/timelines/normalize-phone'

export interface BulkRow {
  name?: string | null
  email?: string | null
  phone?: string | null
  org?: string | null
  tag?: string | null
}

export interface BulkProgress {
  processed: number
  total: number
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

export interface RowOutcome {
  status: 'created' | 'updated' | 'skipped'
  person_id?: number
  reason?: string
}

function emailValues(p: PipedrivePerson): string[] {
  const arr = (p.email as PipedriveContactValue[] | null) ?? []
  return arr.map((e) => (e.value || '').trim().toLowerCase()).filter(Boolean)
}

function phoneValues(p: PipedrivePerson): string[] {
  const arr = (p.phone as PipedriveContactValue[] | null) ?? []
  return arr.map((e) => (e.value || '').trim()).filter(Boolean)
}

function appendContactValue(
  existing: PipedriveContactValue[] | null | undefined,
  value: string,
  label: string
): PipedriveContactValue[] {
  const list: PipedriveContactValue[] = (existing ?? []).map((e) => ({ ...e }))
  // Preserve primaries — append new value as non-primary.
  const hasPrimary = list.some((e) => e.primary)
  list.push({ value, primary: !hasPrimary, label })
  return list
}

/**
 * Process one row. Returns the outcome so the caller can aggregate.
 * Throws only on unexpected errors — recognized validation problems
 * return { status: 'skipped', reason }.
 */
export async function upsertOneRow(row: BulkRow): Promise<RowOutcome> {
  const name = (row.name ?? '').trim()
  const emailRaw = (row.email ?? '').trim()
  const email = emailRaw ? emailRaw.toLowerCase() : ''
  const phoneNorm = row.phone ? normalizePhone(row.phone) : null
  const orgName = (row.org ?? '').trim()
  const tag = (row.tag ?? '').trim()

  if (!name && !email && !phoneNorm) {
    return { status: 'skipped', reason: 'no name, email, or phone' }
  }

  // Dedupe: email first, then phone.
  let existing: PipedrivePerson | null = null
  if (email) {
    existing = await findPersonByEmail(email)
  }
  if (!existing && phoneNorm) {
    existing = await findPersonByPhone(phoneNorm)
  }

  // Resolve org once if provided (cached in the client).
  let orgId: number | null = null
  if (orgName) {
    orgId = await findOrCreateOrganization(orgName)
  }

  if (existing) {
    const patch: Record<string, unknown> = {}

    // Name: only set if the existing record has no name (or just a placeholder
    // matching the email).
    if (name) {
      const existingName = (existing.name || '').trim()
      if (!existingName || existingName.toLowerCase() === email) {
        patch.name = name
      }
    }

    // Email: append only if not already present.
    if (email) {
      const have = emailValues(existing)
      if (!have.includes(email)) {
        patch.email = appendContactValue(
          existing.email as PipedriveContactValue[] | null | undefined,
          email,
          'work'
        )
      }
    }

    // Phone: append only if not already present.
    if (phoneNorm) {
      const have = phoneValues(existing).map((p) => normalizePhone(p) || p)
      if (!have.includes(phoneNorm)) {
        patch.phone = appendContactValue(
          existing.phone as PipedriveContactValue[] | null | undefined,
          phoneNorm,
          'mobile'
        )
      }
    }

    // Org: only attach if existing person has no org.
    if (orgId && !existing.org_id) {
      patch.org_id = orgId
    }

    // Tag: only set if the TAG custom field is empty.
    if (tag) {
      const existingTag = (existing as Record<string, unknown>)[PIPEDRIVE_FIELD_KEYS.TAG]
      if (typeof existingTag !== 'string' || !existingTag.trim()) {
        patch[PIPEDRIVE_FIELD_KEYS.TAG] = tag
      }
    }

    if (Object.keys(patch).length === 0) {
      return { status: 'skipped', person_id: existing.id, reason: 'no new fields to add' }
    }

    await updatePerson(existing.id, patch)
    return { status: 'updated', person_id: existing.id }
  }

  // Create new person.
  const body: Record<string, unknown> = {}
  body.name = name || email || phoneNorm
  if (email) body.email = [{ value: email, primary: true, label: 'work' }]
  if (phoneNorm) body.phone = [{ value: phoneNorm, primary: true, label: 'mobile' }]
  if (orgId) body.org_id = orgId
  if (tag) body[PIPEDRIVE_FIELD_KEYS.TAG] = tag

  const created = await createPerson(body)
  return { status: 'created', person_id: created.id }
}

export interface BulkUpsertOptions {
  onProgress?: (progress: BulkProgress) => Promise<void> | void
  /** Emit a progress event every N rows (default 50). Always emits a final event. */
  progressEvery?: number
  /** Optional abort signal; loop checks between rows. */
  signal?: AbortSignal
}

export async function bulkUpsertPersons(
  rows: BulkRow[],
  opts: BulkUpsertOptions = {}
): Promise<BulkProgress> {
  const total = rows.length
  const every = opts.progressEvery ?? 50
  const state: BulkProgress = {
    processed: 0,
    total,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }

  for (let i = 0; i < rows.length; i++) {
    if (opts.signal?.aborted) break
    const row = rows[i]
    try {
      const outcome = await upsertOneRow(row)
      if (outcome.status === 'created') state.created++
      else if (outcome.status === 'updated') state.updated++
      else state.skipped++
    } catch (err) {
      state.errors.push({
        row: i + 1,
        message: err instanceof Error ? err.message : String(err),
      })
      state.skipped++
    }
    state.processed = i + 1

    if (opts.onProgress && (state.processed % every === 0 || state.processed === total)) {
      await opts.onProgress({ ...state, errors: state.errors.slice(-20) })
    }
  }

  return state
}
