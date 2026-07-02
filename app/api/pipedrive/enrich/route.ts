import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  getPerson,
  updatePerson,
  findOrCreateOrganization,
  getPersonFieldKeyByName,
  type PipedriveContactValue,
  type PipedriveOrgRef,
} from '@/lib/pipedrive/client'
import { getProvider, type EnrichInput, type EnrichResult } from '@/lib/enrich/provider'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'

interface AddedFields {
  email?: string
  company?: string
  role?: string
  linkedin?: string
}

function existingPrimaryEmail(emails: PipedriveContactValue[] | null | undefined): string | null {
  if (!emails || !emails.length) return null
  const primary = emails.find((e) => e.primary && e.value)
  if (primary) return primary.value
  return emails.find((e) => e.value)?.value ?? null
}

function existingOrgId(
  orgRef: PipedriveOrgRef | number | null | undefined
): number | null {
  if (typeof orgRef === 'number') return orgRef
  if (orgRef && typeof orgRef === 'object' && typeof orgRef.value === 'number') {
    return orgRef.value
  }
  return null
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  let body: { pipedrive_id?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const id = body.pipedrive_id
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'pipedrive_id required' }, { status: 400 })
  }

  let person
  try {
    person = await getPerson(id)
  } catch (err) {
    return NextResponse.json(
      { error: 'pipedrive_error', message: (err as Error).message },
      { status: 502 }
    )
  }
  if (!person) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const provider = getProvider()
  if (provider.name === 'stub') {
    return NextResponse.json({ added: {}, reason: 'no_provider' })
  }

  const existingEmail = existingPrimaryEmail(person.email)
  const existingOrg = existingOrgId(person.org_id)
  const existingRole =
    typeof (person as Record<string, unknown>).job_title === 'string'
      ? ((person as Record<string, unknown>).job_title as string)
      : null

  const linkedinFieldKey = await getPersonFieldKeyByName('LinkedIn').catch(() => null)
  const existingLinkedin = linkedinFieldKey
    ? ((person as Record<string, unknown>)[linkedinFieldKey] as string | null | undefined) ?? null
    : null

  const input: EnrichInput = {
    name: person.name,
    firstName: person.first_name ?? null,
    lastName: person.last_name ?? null,
    email: existingEmail,
    phone: person.phone?.[0]?.value ?? null,
    organizationName: person.org_name ?? null,
  }

  let result: EnrichResult | null
  try {
    result = await provider.enrich(input)
  } catch (err) {
    return NextResponse.json(
      { error: 'provider_error', message: (err as Error).message, provider: provider.name },
      { status: 502 }
    )
  }

  if (!result) {
    return NextResponse.json({ added: {}, reason: 'no_match', provider: provider.name })
  }

  const patch: Record<string, unknown> = {}
  const added: AddedFields = {}

  if (result.email && !existingEmail) {
    patch.email = [{ value: result.email, primary: true, label: 'work' }]
    added.email = result.email
  }

  if (result.role && !existingRole) {
    patch.job_title = result.role
    added.role = result.role
  }

  if (result.linkedin && linkedinFieldKey && !existingLinkedin) {
    patch[linkedinFieldKey] = result.linkedin
    added.linkedin = result.linkedin
  }

  if (result.company && !existingOrg) {
    try {
      const orgId = await findOrCreateOrganization(result.company)
      if (orgId) {
        patch.org_id = orgId
        added.company = result.company
      }
    } catch (err) {
      return NextResponse.json(
        { error: 'pipedrive_error', message: (err as Error).message },
        { status: 502 }
      )
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ added: {}, reason: 'nothing_new', provider: provider.name })
  }

  try {
    await updatePerson(id, patch)
  } catch (err) {
    return NextResponse.json(
      { error: 'pipedrive_error', message: (err as Error).message },
      { status: 502 }
    )
  }

  return NextResponse.json({ added, provider: provider.name })
}
