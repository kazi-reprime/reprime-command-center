/**
 * Security: Rate Limiter
 * 
 * Per-route rate limiting using Upstash Redis.
 * Falls back to in-memory limiting when Redis unavailable.
 */

interface RateLimitConfig {
  /** Max requests per window */
  limit: number
  /** Window size in seconds */
  windowSeconds: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
}

// In-memory fallback
const memoryStore = new Map<string, { count: number; resetAt: number }>()

/** Rate limit a request by key. Uses Redis if available, memory otherwise. */
export async function rateLimit(
  key: string,
  config: RateLimitConfig = { limit: 60, windowSeconds: 60 },
): Promise<RateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (redisUrl && redisToken) {
    return rateLimitRedis(key, config, redisUrl, redisToken)
  }

  return rateLimitMemory(key, config)
}

async function rateLimitRedis(
  key: string,
  config: RateLimitConfig,
  url: string,
  token: string,
): Promise<RateLimitResult> {
  try {
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({ url, token })

    const redisKey = `ratelimit:${key}`
    const count = await redis.incr(redisKey)

    if (count === 1) {
      await redis.expire(redisKey, config.windowSeconds)
    }

    const ttl = await redis.ttl(redisKey)
    const resetAt = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : config.windowSeconds * 1000))

    return {
      allowed: count <= config.limit,
      remaining: Math.max(0, config.limit - count),
      resetAt,
    }
  } catch {
    // Fallback to memory on Redis error
    return rateLimitMemory(key, config)
  }
}

function rateLimitMemory(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowSeconds * 1000
    memoryStore.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: new Date(resetAt),
    }
  }

  entry.count++
  return {
    allowed: entry.count <= config.limit,
    remaining: Math.max(0, config.limit - entry.count),
    resetAt: new Date(entry.resetAt),
  }
}

/** Route-specific rate limit configurations */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'nora-chat': { limit: 30, windowSeconds: 60 },
  'whatsapp-send': { limit: 20, windowSeconds: 60 },
  'email-send': { limit: 10, windowSeconds: 60 },
  'voice-transcribe': { limit: 15, windowSeconds: 60 },
  'search': { limit: 30, windowSeconds: 60 },
  'health': { limit: 60, windowSeconds: 60 },
  'default': { limit: 60, windowSeconds: 60 },
}

/** Get rate limit config for a route path */
export function getRouteRateLimit(path: string): RateLimitConfig {
  if (path.includes('/nora/chat')) return RATE_LIMITS['nora-chat']
  if (path.includes('/whatsapp') && path.includes('send')) return RATE_LIMITS['whatsapp-send']
  if (path.includes('/email') && path.includes('send')) return RATE_LIMITS['email-send']
  if (path.includes('/voice/transcribe')) return RATE_LIMITS['voice-transcribe']
  if (path.includes('/search')) return RATE_LIMITS['search']
  if (path.includes('/health')) return RATE_LIMITS['health']
  return RATE_LIMITS['default']
}
