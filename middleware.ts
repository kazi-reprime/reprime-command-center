import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─── Public paths ───────────────────────────────────────────────────────────
// These paths bypass auth entirely. API routes authenticate themselves
// (CRON_SECRET, X-Captain-Token, x-center-pass, etc.)
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/auth/callback',
  '/api/',         // All API routes — each has its own auth guard
  '/invite',
  '/v',            // Tracked video links
  '/outreach',
  '/center.html',
  '/center',       // Outreach center
  '/compose',      // Compose page
  '/cockpit',      // Main cockpit dashboard
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Let public paths through immediately
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Static assets — let through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  ) {
    return NextResponse.next()
  }

  // For protected pages, check for Supabase auth cookie.
  // We avoid importing @supabase/ssr at module level because it uses
  // process.version which crashes the Edge Runtime on Vercel.
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('[middleware] Missing SUPABASE env vars')
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Look for the Supabase auth token in cookies
    // Supabase stores the session in sb-<ref>-auth-token cookie
    const allCookies = request.cookies.getAll()
    const authCookie = allCookies.find(
      (c) => c.name.includes('auth-token') && c.name.startsWith('sb-')
    )

    if (!authCookie?.value) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Parse the access token from the cookie value
    // The cookie contains a base64-encoded JSON array: [access_token, refresh_token, ...]
    let accessToken: string | null = null
    try {
      // Try parsing as JSON array (newer format)
      const parsed = JSON.parse(authCookie.value)
      accessToken = Array.isArray(parsed) ? parsed[0] : parsed?.access_token
    } catch {
      // Try treating as a chunked cookie — look for parts
      const baseName = authCookie.name
      const parts: string[] = [authCookie.value]
      for (let i = 1; i <= 5; i++) {
        const chunk = request.cookies.get(`${baseName}.${i}`)
        if (chunk?.value) parts.push(chunk.value)
        else break
      }
      try {
        const joined = parts.join('')
        const parsed = JSON.parse(decodeURIComponent(joined))
        accessToken = Array.isArray(parsed) ? parsed[0] : parsed?.access_token
      } catch {
        // Last resort — use the raw value
        accessToken = authCookie.value
      }
    }

    if (!accessToken) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Verify the token with Supabase's /auth/v1/user endpoint
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseKey,
      },
    })

    if (!userRes.ok) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const userData = await userRes.json()
    if (!userData?.email || userData.email !== 'g@reprime.com') {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return NextResponse.next()
  } catch (err) {
    console.error('[middleware] Auth check failed:', err)
    // Never crash — redirect to login instead of returning 500
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)'],
}
