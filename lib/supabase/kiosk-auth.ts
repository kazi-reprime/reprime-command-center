import { createServerClient, createServiceClient } from '@/lib/supabase/server'

/**
 * getAuthedClient — tries user session auth first, falls back to service role.
 *
 * The /center kiosk runs without a logged-in user session (no Supabase cookies).
 * API routes that the Command Center calls need to work regardless, so we
 * fall back to the service-role client when no user session is found.
 *
 * Returns { client, user } where user may be null in kiosk/service mode.
 */
export async function getAuthedClient() {
  try {
    const userClient = await createServerClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()

    if (user) {
      return { client: userClient, user }
    }
  } catch {
    // Cookie access or auth errors — fall through to service client
  }

  // Kiosk mode: no user session, use service role
  const serviceClient = createServiceClient()
  return { client: serviceClient, user: null }
}
