import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { createServerClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/timelines/normalize-phone'
import { PIPEDRIVE_FIELD_KEYS, updatePerson } from '@/lib/pipedrive/client'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export async function PUT(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  let body: { personId?: number; value?: string; phone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.personId || typeof body.personId !== 'number') {
    return NextResponse.json({ error: 'personId required' }, { status: 400 })
  }
  const value = typeof body.value === 'string' ? body.value : ''

  try {
    await updatePerson(body.personId, {
      [PIPEDRIVE_FIELD_KEYS.NOTES_FROM_DASHBOARD]: value,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'pipedrive_error', message: (err as Error).message },
      { status: 502 }
    )
  }

  if (body.phone) {
    const phone = normalizePhone(body.phone)
    if (phone) {
      const redis = getRedis()
      if (redis) await redis.del(`pipedrive:phone:${phone}`)
    }
  }

  return NextResponse.json({ ok: true })
}
