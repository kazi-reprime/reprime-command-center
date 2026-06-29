import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/timelines/normalize-phone'
import {
  findPersonByEmail,
  findPersonByPhone,
  getPersonActivities,
  PIPEDRIVE_FIELD_KEYS,
  type PipedrivePerson,
  type PipedriveActivity,
} from '@/lib/pipedrive/client'
import type { Panel } from '@/lib/timelines/types'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'
const CACHE_TTL = 3600

type ResolvePayload = {
  person: PipedrivePerson | null
  activities: PipedriveActivity[]
  fieldKeys: { dashboard: string; tag: string }
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const FIELD_KEYS = {
  dashboard: PIPEDRIVE_FIELD_KEYS.NOTES_FROM_DASHBOARD,
  tag: PIPEDRIVE_FIELD_KEYS.TAG,
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
  const rawPhone = searchParams.get('phone')
  const rawEmail = searchParams.get('email')
  const panel = searchParams.get('panel') as Panel | null

  if (!rawPhone && !rawEmail) {
    return NextResponse.json({ error: 'phone or email required' }, { status: 400 })
  }

  let cacheKey: string | null = null
  let phone: string | null = null
  let email: string | null = null

  if (rawPhone) {
    phone = normalizePhone(rawPhone)
    if (!phone) {
      return NextResponse.json(
        { person: null, activities: [], fieldKeys: FIELD_KEYS } satisfies ResolvePayload
      )
    }
    cacheKey = `pipedrive:phone:${phone}`
  } else if (rawEmail) {
    const trimmed = rawEmail.trim().toLowerCase()
    if (!trimmed.includes('@')) {
      return NextResponse.json(
        { person: null, activities: [], fieldKeys: FIELD_KEYS } satisfies ResolvePayload
      )
    }
    email = trimmed
    cacheKey = `pipedrive:email:${email}`
  }

  const redis = getRedis()

  if (redis && cacheKey) {
    const cached = await redis.get<ResolvePayload>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }
  }

  let person: PipedrivePerson | null = null
  let activities: PipedriveActivity[] = []

  try {
    if (phone) {
      person = await findPersonByPhone(phone)
    } else if (email) {
      person = await findPersonByEmail(email)
    }
    if (person) {
      activities = await getPersonActivities(person.id, 3)
    }
  } catch (err) {
    return NextResponse.json(
      { error: 'pipedrive_error', message: (err as Error).message },
      { status: 502 }
    )
  }

  const payload: ResolvePayload = {
    person,
    activities,
    fieldKeys: FIELD_KEYS,
  }

  if (redis && cacheKey) {
    await redis.set(cacheKey, payload, { ex: CACHE_TTL })
  }

  if (person && panel && phone) {
    const service = createServiceClient()
    await service
      .from('whatsapp_threads')
      .update({ pipedrive_contact_id: person.id })
      .eq('panel', panel)
      .eq('phone', phone)
  }

  return NextResponse.json(payload)
}
