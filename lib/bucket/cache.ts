import { Redis } from '@upstash/redis'

/**
 * Bucket-list cache for the GET /api/bucket?status=open hot path.
 *
 * Two-tier TTL: values are written with a 1-hour expiry so we keep a stale
 * fallback when Supabase times out, but readers treat anything older than
 * BUCKET_CACHE_FRESH_MS (5 min) as "needs refresh" and re-fetch. This matches
 * the spec ("5-minute cache, return stale on timeout").
 *
 * Bust is destructive — any write to bucket_items invalidates the cache.
 */

const CACHE_KEY_OPEN = 'bucket:list:open:v1'
const STALE_TTL_SECONDS = 60 * 60
export const BUCKET_CACHE_FRESH_MS = 5 * 60 * 1000

export interface BucketCacheEnvelope<T = unknown> {
  cachedAt: number
  items: T[]
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export async function readBucketOpenCache<T = unknown>(): Promise<BucketCacheEnvelope<T> | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    return await redis.get<BucketCacheEnvelope<T>>(CACHE_KEY_OPEN)
  } catch (err) {
    console.error('[bucket-cache] read failed', err)
    return null
  }
}

export async function writeBucketOpenCache<T = unknown>(items: T[]): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  const envelope: BucketCacheEnvelope<T> = { cachedAt: Date.now(), items }
  try {
    await redis.set(CACHE_KEY_OPEN, envelope, { ex: STALE_TTL_SECONDS })
  } catch (err) {
    console.error('[bucket-cache] write failed', err)
  }
}

export async function bustBucketCache(): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(CACHE_KEY_OPEN)
  } catch (err) {
    console.error('[bucket-cache] bust failed', err)
  }
}

export function isFresh(envelope: BucketCacheEnvelope | null): boolean {
  if (!envelope) return false
  return Date.now() - envelope.cachedAt < BUCKET_CACHE_FRESH_MS
}
