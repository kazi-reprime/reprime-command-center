import { createServerClient as _createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createServerClient = async () => {
  const cookieStore = await cookies()
  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cs) {
          cs.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export const createServiceClient = () => {
  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock',
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
