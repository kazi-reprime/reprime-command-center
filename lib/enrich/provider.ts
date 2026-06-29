/**
 * Contact enrichment provider abstraction.
 *
 * Wave 8: many Pipedrive contacts arrive with only a name + phone. A
 * provider takes whatever sparse data we have and returns missing
 * fields (email, company, role, linkedin). Caller is responsible for
 * deciding which fields are actually missing on the Pipedrive Person
 * and patching only those — providers never overwrite existing data.
 *
 * Implementations:
 *   - ApolloProvider: hits api.apollo.io /v1/people/match when
 *     APOLLO_API_KEY is set (free tier: 50 lookups/mo).
 *   - StubProvider: always returns null. Used when no provider key is
 *     configured so the endpoint stays callable in dev/CI.
 *
 * Design notes:
 *   - No I/O on import; getProvider() reads env at call time.
 *   - Errors bubble up; caller decides whether to surface or swallow.
 *   - Result fields are all optional. A provider may return any subset.
 */

export interface EnrichInput {
  name: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  organizationName?: string | null
}

export interface EnrichResult {
  email?: string
  company?: string
  role?: string
  linkedin?: string
}

export interface EnrichProvider {
  readonly name: string
  enrich(input: EnrichInput): Promise<EnrichResult | null>
}

class StubProvider implements EnrichProvider {
  readonly name = 'stub'
  async enrich(): Promise<EnrichResult | null> {
    return null
  }
}

interface ApolloPerson {
  email?: string | null
  title?: string | null
  linkedin_url?: string | null
  organization?: { name?: string | null } | null
}

class ApolloProvider implements EnrichProvider {
  readonly name = 'apollo'
  constructor(private readonly apiKey: string) {}

  async enrich(input: EnrichInput): Promise<EnrichResult | null> {
    const body: Record<string, unknown> = { api_key: this.apiKey }
    if (input.firstName) body.first_name = input.firstName
    if (input.lastName) body.last_name = input.lastName
    if (input.name && !input.firstName && !input.lastName) body.name = input.name
    if (input.email) body.email = input.email
    if (input.organizationName) body.organization_name = input.organizationName

    const res = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(body),
    })

    if (res.status === 404) return null
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Apollo /v1/people/match failed: ${res.status} ${txt}`)
    }

    const data = (await res.json()) as { person?: ApolloPerson | null }
    const p = data.person
    if (!p) return null

    const out: EnrichResult = {}
    if (p.email && p.email.trim()) out.email = p.email.trim()
    if (p.title && p.title.trim()) out.role = p.title.trim()
    if (p.linkedin_url && p.linkedin_url.trim()) out.linkedin = p.linkedin_url.trim()
    if (p.organization?.name && p.organization.name.trim()) {
      out.company = p.organization.name.trim()
    }
    return Object.keys(out).length ? out : null
  }
}

export function getProvider(): EnrichProvider {
  const key = process.env.APOLLO_API_KEY
  if (key && key.trim()) return new ApolloProvider(key.trim())
  return new StubProvider()
}
