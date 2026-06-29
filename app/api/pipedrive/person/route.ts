import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  getPerson,
  PIPEDRIVE_FIELD_KEYS,
  PREFERRED_CONTACT_OPTIONS,
} from '@/lib/pipedrive/client'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'

type DefaultChannel = 'whatsapp_305' | 'whatsapp_718' | 'email' | 'all'

function defaultChannelFor(preferredId: number | null): DefaultChannel {
  switch (preferredId) {
    case PREFERRED_CONTACT_OPTIONS.WHATSAPP:
      return 'whatsapp_305'
    case PREFERRED_CONTACT_OPTIONS.EMAIL:
      return 'email'
    case PREFERRED_CONTACT_OPTIONS.PHONE:
      return 'whatsapp_305'
    case PREFERRED_CONTACT_OPTIONS.ZOOM:
      return 'all'
    default:
      return 'all'
  }
}

function coercePreferredId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw)
  return null
}

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const idRaw = searchParams.get('id')
  const id = idRaw ? Number.parseInt(idRaw, 10) : NaN
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 })
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

  const preferredId = coercePreferredId(person[PIPEDRIVE_FIELD_KEYS.PREFERRED_CONTACT_METHOD])
  const defaultChannel = defaultChannelFor(preferredId)

  return NextResponse.json({
    id: person.id,
    name: person.name,
    first_name: person.first_name ?? null,
    primary_email: person.primary_email ?? null,
    phone: person.phone ?? null,
    preferred_method: preferredId,
    default_channel: defaultChannel,
  })
}
