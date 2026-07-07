import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a new Supabase browser client instance.
 * Used by components that need SSR-compatible Supabase (auth callbacks, etc).
 */
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock'
  )

/**
 * Singleton Supabase client for Realtime subscriptions and general use.
 * Both /center and /cockpit should use this singleton to avoid duplicate
 * connections and channel subscriptions.
 */
let _singleton: ReturnType<typeof createClient> | null = null
export function getClient() {
  if (!_singleton) _singleton = createClient()
  return _singleton
}
