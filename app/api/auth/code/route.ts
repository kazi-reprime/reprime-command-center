import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_EMAIL = 'g@reprime.com'
const DEFAULT_CODE = 'REPRIME'

/**
 * Constant-time string comparison to avoid leaking the access code via timing.
 * Falls back gracefully when lengths differ (still compares to avoid early-out).
 */
function codeMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    // Compare against itself so we still spend ~constant time, then fail.
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

/**
 * POST /api/auth/code  (PUBLIC — listed in proxy.ts PUBLIC_PATHS)
 *
 * Accepts a shared team access code. On a correct code, mints a real
 * g@reprime.com Supabase session server-side and sets the auth cookies on the
 * response, so the ~60 live API routes that gate on this session keep working.
 */
export async function POST(request: NextRequest) {
  let code = ''
  try {
    const body = (await request.json()) as { code?: unknown }
    if (typeof body?.code === 'string') code = body.code
  } catch {
    // Malformed/empty body → treated as missing code below.
  }

  const expected = process.env.AUTH_ACCESS_CODE || DEFAULT_CODE
  if (!code || !codeMatches(code, expected)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 401 })
  }

  try {
    const admin = createServiceClient()

    // Generate a magic-link token for the fixed authorized email. If the user
    // doesn't exist yet, create it first then retry.
    let hashedToken: string | undefined
    let { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: ALLOWED_EMAIL,
    })

    if (error || !data?.properties?.hashed_token) {
      await admin.auth.admin.createUser({
        email: ALLOWED_EMAIL,
        email_confirm: true,
      })
      ;({ data, error } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: ALLOWED_EMAIL,
      }))
    }

    hashedToken = data?.properties?.hashed_token
    if (error || !hashedToken) {
      throw new Error(error?.message || 'generateLink returned no token')
    }

    // Cookie-bound client → verifyOtp sets the auth cookies via the SSR adapter.
    const supabase = await createServerClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: hashedToken,
    })
    if (verifyError) {
      throw new Error(verifyError.message)
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'unknown error'
    // Log server-side; never leak service-role secrets in the response.
    console.error('[auth/code] session mint failed:', detail)
    return NextResponse.json(
      { error: 'session_failed', detail },
      { status: 500 }
    )
  }
}
