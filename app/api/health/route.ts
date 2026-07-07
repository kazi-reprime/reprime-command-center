import { NextResponse } from 'next/server'
import { pipedriveAdapter } from '@/lib/adapters/pipedriveAdapter'
import { smsAdapter } from '@/lib/adapters/smsAdapter'
import { whatsappAdapter } from '@/lib/adapters/whatsappAdapter'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Core vars — system won't function without these
const REQUIRED_ENVS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'TIMELINES_API_KEY',
  'GOOGLE_REFRESH_TOKEN',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'CRON_SECRET',
] as const

// Optional vars — system degrades gracefully without these
const OPTIONAL_ENVS = [
  'ELEVENLABS_API_KEY',
  'PIPEDRIVE_API_TOKEN',
  'SENDGRID_API_KEY',
  'INFORUPTCY_EMAIL',
  'INFORUPTCY_PASSWORD',
] as const

type RequiredEnv = (typeof REQUIRED_ENVS)[number]
type OptionalEnv = (typeof OPTIONAL_ENVS)[number]
type EnvFlags = Record<RequiredEnv | OptionalEnv, boolean>

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
  const allEnvs = [...REQUIRED_ENVS, ...OPTIONAL_ENVS] as const
  const env = Object.fromEntries(
    allEnvs.map((k) => [k, Boolean(process.env[k])])
  ) as EnvFlags

  const db = await pingDb()

  const adapters = {
    pipedrive: pipedriveAdapter.getStatus(),
    sms: smsAdapter.getStatus(),
    whatsapp: whatsappAdapter.getStatus(),
  }

  const missingRequired = REQUIRED_ENVS.some((k) => !env[k])
  const missingAdapter = Object.values(adapters).some(a => !a.isConfigured)
  
  const overall: 'ok' | 'degraded' | 'down' =
    !db.reachable ? 'down' : (missingRequired || missingAdapter) ? 'degraded' : 'ok'

  return NextResponse.json(
    {
      sha: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
      deployedAt: process.env.VERCEL_DEPLOYMENT_TS || null,
      env,
      db,
      adapters,
      overall,
    },
    {
      headers: { 'cache-control': 'no-store, must-revalidate' },
    }
  )
}
