import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const REQUIRED_ENVS = [
  'CRON_SECRET',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'ELEVENLABS_API_KEY',
  'TIMELINES_API_KEY',
  'PIPEDRIVE_API_TOKEN',
  'GOOGLE_REFRESH_TOKEN',
  'SENDGRID_API_KEY',
  'INFORUPTCY_EMAIL',
  'INFORUPTCY_PASSWORD',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
] as const

type RequiredEnv = (typeof REQUIRED_ENVS)[number]
type EnvFlags = Record<RequiredEnv, boolean>

const DB_TIMEOUT_MS = 5000

async function pingDb(): Promise<{ reachable: boolean; latencyMs: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const start = Date.now()
  if (!url || !key) {
    return { reachable: false, latencyMs: 0 }
  }

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), DB_TIMEOUT_MS)
  try {
    // Hit a real table (crew_members is small + always seeded with 6 rows
    // per the 2026-05-05 migration). limit=0 returns an empty array fast,
    // confirms the DB is reachable AND the schema is migrated.
    const res = await fetch(
      `${url}/rest/v1/crew_members?select=email&limit=0`,
      {
        method: 'GET',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: ctrl.signal,
        cache: 'no-store',
      }
    )
    return { reachable: res.ok, latencyMs: Date.now() - start }
  } catch {
    return { reachable: false, latencyMs: Date.now() - start }
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET() {
  const env = Object.fromEntries(
    REQUIRED_ENVS.map((k) => [k, Boolean(process.env[k])])
  ) as EnvFlags

  const db = await pingDb()

  const missingEnv = REQUIRED_ENVS.some((k) => !env[k])
  const overall: 'ok' | 'degraded' | 'down' =
    !db.reachable ? 'down' : missingEnv ? 'degraded' : 'ok'

  return NextResponse.json(
    {
      sha: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
      deployedAt: process.env.VERCEL_DEPLOYMENT_TS || null,
      env,
      db,
      overall,
    },
    {
      headers: { 'cache-control': 'no-store, must-revalidate' },
    }
  )
}
