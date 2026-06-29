import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient as _createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  // Shared access-code login. Reachable without a session; the route itself
  // checks the code and mints the g@reprime.com session on success.
  '/api/auth/code',
  '/api/whatsapp/webhook',
  '/api/phone/bb-webhook',
  '/api/phone/quo-webhook',
  '/invite',
  // Recipient-facing tracked video link → /v/<inviteId> logs the watch + 302s
  // to YouTube. Public, no dashboard login.
  '/v',
  '/api/bookings/confirm',
  // Recipient-facing — the public invite/choose pages fetch this to show
  // Gideon's open times. Route reads availability via GOOGLE_REFRESH_TOKEN
  // server-side and returns free slots only (no secrets). Without this in the
  // allowlist the public booking page is redirected to /login, gets nothing,
  // and falls back to "reach out directly to schedule."
  '/api/bookings/available-slots',
  // Recipient-facing — Screen 3 Add Attendee + reschedule + .ics download
  '/api/invitations/add-attendee',
  // Captain hotfix 2026-05-20: Chrome Extension mints invites via X-Captain-Token
  // header. Endpoint itself enforces the token check; middleware just lets it through.
  '/api/invitations',
  // Vercel cron hits these without user cookies; CRON_SECRET bearer is the
  // real auth gate inside each route handler.
  '/api/bucket/fire-reminders',
  '/api/email/sync',
  '/api/cron/inforuptcy-poll',
  '/api/cron/slack-digest',
  // Public health endpoint — read-only env presence + DB ping. No secrets in
  // response. Used by extension4 / extension6 to verify deploys without auth.
  '/api/health',
  // Command Center outreach tool — password-gated by sbh770 inside each route
  // (x-center-pass header), so it must bypass the dashboard Supabase login.
  '/outreach',
  '/center.html',
  '/api/center',
  '/api/cron/center-drain',
  '/api/cron/center-watch',
  '/api/cron/email-watch',
  '/api/cron/gmail-watch-arm',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const response = NextResponse.next()
  const supabase = _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cs) {
          cs.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== 'g@reprime.com') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)'],
}
