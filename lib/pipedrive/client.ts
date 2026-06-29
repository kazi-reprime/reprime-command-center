const BASE_URL = 'https://api.pipedrive.com/v1'

export const PIPEDRIVE_FIELD_KEYS = {
  TAG: 'd57ae324f61ddb2b922fb2e212f0723baba92448',
  NOTES_FROM_DASHBOARD: '67745cf460dd9f8423a11da2b2fc3323130fef2c',
  PREFERRED_CONTACT_METHOD: 'b1844d06b9efa0f554dc1e5fb4aeee55c7beca7d',
} as const

export const PREFERRED_CONTACT_OPTIONS = {
  WHATSAPP: 27,
  EMAIL: 28,
  PHONE: 29,
  ZOOM: 30,
} as const

function token(): string {
  const t = process.env.PIPEDRIVE_API_TOKEN
  if (!t) throw new Error('PIPEDRIVE_API_TOKEN is not set')
  return t
}

export async function pipedriveRequest<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = new URL(BASE_URL + path)
  url.searchParams.set('api_token', token())

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Pipedrive ${init.method ?? 'GET'} ${path} failed: ${res.status} ${body}`)
  }

  return res.json() as Promise<T>
}

export interface PipedriveDeal {
  id: number
  title: string
  value: number
  currency: string
  status: 'open' | 'won' | 'lost' | 'deleted'
  stage_id: number
  person_id?: number | { value: number; name: string } | null
  org_id?: number | { value: number; name: string } | null
  add_time?: string
  update_time?: string
  stage_change_time?: string | null
}

export async function listDeals(
  params: { status?: string; limit?: number; start?: number; sort?: string } = {}
): Promise<PipedriveDeal[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  if (params.start !== undefined) qs.set('start', String(params.start))
  if (params.sort) qs.set('sort', params.sort)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const data = await pipedriveRequest<{ data: PipedriveDeal[] | null }>(`/deals${suffix}`)
  return data.data ?? []
}

// ── Pipedrive stages ─────────────────────────────────────────────────────────

export interface PipedriveStage {
  id: number
  name: string
  pipeline_id: number
  order_nr?: number
  active_flag?: boolean
}

let stagesCache: { ts: number; data: PipedriveStage[] } | null = null
const STAGES_TTL_MS = 5 * 60_000

export async function listStages(): Promise<PipedriveStage[]> {
  const now = Date.now()
  if (stagesCache && now - stagesCache.ts < STAGES_TTL_MS) {
    return stagesCache.data
  }
  const res = await pipedriveRequest<{ data: PipedriveStage[] | null }>(`/stages`)
  const data = res.data ?? []
  stagesCache = { ts: now, data }
  return data
}

export async function getStageNameMap(): Promise<Map<number, string>> {
  const stages = await listStages()
  const m = new Map<number, string>()
  for (const s of stages) m.set(s.id, s.name)
  return m
}

/** Build the user-facing Pipedrive deal URL for a given deal id. */
export function pipedriveDealUrl(id: number): string {
  return `https://reprimegroup.pipedrive.com/deal/${id}`
}

export async function getDeal(id: number): Promise<PipedriveDeal | null> {
  const data = await pipedriveRequest<{ data: PipedriveDeal | null }>(`/deals/${id}`)
  return data.data
}

export async function createDeal(deal: {
  title: string
  value?: number
  currency?: string
  stage_id?: number
  person_id?: number
  org_id?: number
}): Promise<PipedriveDeal> {
  const data = await pipedriveRequest<{ data: PipedriveDeal }>(`/deals`, {
    method: 'POST',
    body: JSON.stringify(deal),
  })
  return data.data
}

export interface PipedriveContactValue {
  value: string
  primary: boolean
  label: string
}

export interface PipedriveOrgRef {
  value: number
  name: string
}

export interface PipedrivePerson {
  id: number
  name: string
  first_name?: string | null
  last_name?: string | null
  org_id?: PipedriveOrgRef | number | null
  org_name?: string | null
  primary_email?: string | null
  email?: PipedriveContactValue[] | null
  phone?: PipedriveContactValue[] | null
  add_time?: string
  update_time?: string
  [customFieldKey: string]: unknown
}

export interface PipedriveActivity {
  id: number
  type: string
  subject: string
  done: boolean
  due_date?: string | null
  due_time?: string | null
  add_time?: string | null
  update_time?: string | null
  marked_as_done_time?: string | null
  note?: string | null
}

export interface PipedrivePersonField {
  id: number
  key: string
  name: string
  field_type: string
  options?: Array<{ id: number; label: string }>
}

interface PipedriveSearchItem {
  result_score: number
  item: { id: number; type: string; name: string; phones?: string[]; emails?: string[] }
}

let personFieldsCache: PipedrivePersonField[] | null = null

export async function getPersonFields(): Promise<PipedrivePersonField[]> {
  if (personFieldsCache) return personFieldsCache
  const res = await pipedriveRequest<{ data: PipedrivePersonField[] | null }>(
    `/personFields`
  )
  personFieldsCache = res.data ?? []
  return personFieldsCache
}

export async function getPersonFieldKeyByName(name: string): Promise<string | null> {
  const fields = await getPersonFields()
  const target = name.trim().toLowerCase()
  const f = fields.find((x) => x.name.trim().toLowerCase() === target)
  return f?.key ?? null
}

export async function findPersonByPhone(phone: string): Promise<PipedrivePerson | null> {
  const term = encodeURIComponent(phone)
  const search = await pipedriveRequest<{
    data: { items?: PipedriveSearchItem[] } | null
  }>(`/persons/search?term=${term}&fields=phone&exact_match=true&limit=1`)
  const hit = search.data?.items?.[0]?.item
  if (!hit) return null
  const full = await pipedriveRequest<{ data: PipedrivePerson | null }>(
    `/persons/${hit.id}`
  )
  return full.data ?? null
}

export async function findPersonByEmail(email: string): Promise<PipedrivePerson | null> {
  const term = encodeURIComponent(email.trim().toLowerCase())
  const search = await pipedriveRequest<{
    data: { items?: PipedriveSearchItem[] } | null
  }>(`/persons/search?term=${term}&fields=email&exact_match=true&limit=1`)
  const hit = search.data?.items?.[0]?.item
  if (!hit) return null
  const full = await pipedriveRequest<{ data: PipedrivePerson | null }>(
    `/persons/${hit.id}`
  )
  return full.data ?? null
}

export async function getPerson(id: number): Promise<PipedrivePerson | null> {
  const res = await pipedriveRequest<{ data: PipedrivePerson | null }>(`/persons/${id}`)
  return res.data ?? null
}

export async function searchPersons(
  term: string,
  limit = 10
): Promise<Array<{ id: number; name: string; emails: string[]; phones: string[] }>> {
  const q = encodeURIComponent(term)
  const res = await pipedriveRequest<{
    data: { items?: PipedriveSearchItem[] } | null
  }>(`/persons/search?term=${q}&limit=${limit}`)
  return (res.data?.items ?? []).map((it) => ({
    id: it.item.id,
    name: it.item.name,
    emails: it.item.emails ?? [],
    phones: it.item.phones ?? [],
  }))
}

export async function createActivity(input: {
  type: string
  subject: string
  person_id?: number
  deal_id?: number
  due_date?: string
  due_time?: string
  duration?: string
  note?: string
  done?: boolean
}): Promise<PipedriveActivity> {
  const res = await pipedriveRequest<{ data: PipedriveActivity }>(`/activities`, {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      done: input.done ? 1 : 0,
    }),
  })
  return res.data
}

export async function getPersonActivities(
  personId: number,
  limit = 3
): Promise<PipedriveActivity[]> {
  const res = await pipedriveRequest<{ data: PipedriveActivity[] | null }>(
    `/persons/${personId}/activities?limit=${limit * 4}&start=0`
  )
  const all = res.data ?? []
  return all
    .slice()
    .sort((a, b) => {
      const at = a.update_time || a.add_time || ''
      const bt = b.update_time || b.add_time || ''
      return bt.localeCompare(at)
    })
    .slice(0, limit)
}

export async function updatePerson(
  id: number,
  body: Record<string, unknown>
): Promise<PipedrivePerson> {
  const res = await pipedriveRequest<{ data: PipedrivePerson }>(`/persons/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return res.data
}

export async function createPerson(
  body: Record<string, unknown>
): Promise<PipedrivePerson> {
  const res = await pipedriveRequest<{ data: PipedrivePerson }>(`/persons`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return res.data
}

export interface PipedriveOrganization {
  id: number
  name: string
}

interface PipedriveOrgSearchItem {
  result_score: number
  item: { id: number; name: string }
}

/**
 * Search-or-create an organization by name. Pipedrive has no native
 * upsert; this does an exact-match search and falls back to POST.
 * Caches by lowercased name within the process to avoid re-querying
 * during a bulk import.
 */
const orgCache = new Map<string, number>()

export async function findOrCreateOrganization(name: string): Promise<number | null> {
  const trimmed = name.trim()
  if (!trimmed) return null
  const key = trimmed.toLowerCase()
  const cached = orgCache.get(key)
  if (cached) return cached

  const term = encodeURIComponent(trimmed)
  const search = await pipedriveRequest<{
    data: { items?: PipedriveOrgSearchItem[] } | null
  }>(`/organizations/search?term=${term}&exact_match=true&limit=1`)
  const hit = search.data?.items?.[0]?.item
  if (hit) {
    orgCache.set(key, hit.id)
    return hit.id
  }

  const created = await pipedriveRequest<{ data: PipedriveOrganization }>(`/organizations`, {
    method: 'POST',
    body: JSON.stringify({ name: trimmed }),
  })
  orgCache.set(key, created.data.id)
  return created.data.id
}

// ── Investor TAG parsing ────────────────────────────────────────────────────
// Pipedrive TAG values for investors follow the convention:
//   investor-{A|B|C|D}-{principal|connector}
// Bare `investor` (no tier/role) is also accepted for backward compat.

export type InvestorTagTier = 'A' | 'B' | 'C' | 'D'
export type InvestorTagRole = 'principal' | 'connector'

export interface InvestorTagParsed {
  isInvestor: boolean
  tier: InvestorTagTier | null
  role: InvestorTagRole | null
}

export function parseInvestorTag(value: unknown): InvestorTagParsed {
  if (typeof value !== 'string') return { isInvestor: false, tier: null, role: null }
  const trimmed = value.trim().toLowerCase()
  if (!trimmed.startsWith('investor')) return { isInvestor: false, tier: null, role: null }
  if (trimmed === 'investor') return { isInvestor: true, tier: null, role: null }
  // investor-A-principal etc.
  const m = trimmed.match(/^investor-([abcd])-(principal|connector)$/)
  if (!m) return { isInvestor: true, tier: null, role: null } // anything starting with `investor` counts; just couldn't parse
  return {
    isInvestor: true,
    tier: m[1].toUpperCase() as InvestorTagTier,
    role: m[2] as InvestorTagRole,
  }
}

export interface InvestorTaggedPerson {
  id: number
  name: string
  emails: string[]
  phones: string[]
  tier: InvestorTagTier | null
  role: InvestorTagRole | null
  rawTag: string
}

/**
 * Returns every Pipedrive Person whose TAG custom field starts with `investor`.
 * Paginates the full Persons list (Pipedrive doesn't support filtering on
 * custom-field values via the search endpoint without a saved Filter).
 *
 * Caller should cache the result in Upstash for ~1h — this is several
 * sequential API calls.
 */
export async function listInvestorTaggedPersons(): Promise<InvestorTaggedPerson[]> {
  const out: InvestorTaggedPerson[] = []
  let start = 0
  const limit = 500
  // Pipedrive returns up to 500 per page; loop while more remains.
  for (let safety = 0; safety < 20; safety++) {
    const res = await pipedriveRequest<{
      data: PipedrivePerson[] | null
      additional_data?: { pagination?: { more_items_in_collection: boolean; next_start?: number } }
    }>(`/persons?start=${start}&limit=${limit}`)
    const persons = res.data ?? []
    for (const p of persons) {
      const tagValue = (p as Record<string, unknown>)[PIPEDRIVE_FIELD_KEYS.TAG]
      const parsed = parseInvestorTag(tagValue)
      if (!parsed.isInvestor) continue
      out.push({
        id: p.id,
        name: p.name,
        emails: ((p.email as PipedriveContactValue[] | null) ?? []).map((e) => e.value).filter(Boolean),
        phones: ((p.phone as PipedriveContactValue[] | null) ?? []).map((e) => e.value).filter(Boolean),
        tier: parsed.tier,
        role: parsed.role,
        rawTag: typeof tagValue === 'string' ? tagValue : '',
      })
    }
    const more = res.additional_data?.pagination?.more_items_in_collection
    const nextStart = res.additional_data?.pagination?.next_start
    if (!more || typeof nextStart !== 'number') break
    start = nextStart
  }
  return out
}
