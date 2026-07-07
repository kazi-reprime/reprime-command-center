/**
 * Health Monitor — Truthful provider health tracking
 * 
 * Tracks per-provider: latency, failure streaks, auth state,
 * rate limits, last success/failure timestamps.
 * 
 * Health scores drive the provider registry's routing decisions.
 * States are always truthful — never show fake "connected".
 */

import type { ProviderHealth, ProviderHealthState } from './types'

interface HealthRecord {
  latencies: number[]
  lastSuccessAt: number | null
  lastFailureAt: number | null
  failureStreak: number
  rateLimitResetAt: number | null
  authFailedAt: number | null
  configured: boolean
  lastError: string | null
}

const MAX_LATENCY_SAMPLES = 20

export class HealthMonitor {
  private records = new Map<string, HealthRecord>()

  /** Initialize tracking for a provider */
  register(providerId: string, configured: boolean): void {
    if (!this.records.has(providerId)) {
      this.records.set(providerId, {
        latencies: [],
        lastSuccessAt: null,
        lastFailureAt: null,
        failureStreak: 0,
        rateLimitResetAt: null,
        authFailedAt: null,
        configured,
        lastError: null,
      })
    } else {
      // Update configuration state
      const rec = this.records.get(providerId)!
      rec.configured = configured
    }
  }

  /** Record a successful operation */
  recordSuccess(providerId: string, latencyMs: number): void {
    const rec = this.getOrCreate(providerId)
    rec.lastSuccessAt = Date.now()
    rec.failureStreak = 0
    rec.lastError = null
    rec.authFailedAt = null
    rec.latencies.push(latencyMs)
    if (rec.latencies.length > MAX_LATENCY_SAMPLES) {
      rec.latencies.shift()
    }
  }

  /** Record a failed operation */
  recordFailure(providerId: string, error: string, latencyMs?: number): void {
    const rec = this.getOrCreate(providerId)
    rec.lastFailureAt = Date.now()
    rec.failureStreak++
    rec.lastError = error

    if (latencyMs !== undefined) {
      rec.latencies.push(latencyMs)
      if (rec.latencies.length > MAX_LATENCY_SAMPLES) {
        rec.latencies.shift()
      }
    }

    // Classify error types
    const errLower = error.toLowerCase()
    if (errLower.includes('401') || errLower.includes('403') || errLower.includes('auth') || errLower.includes('token')) {
      rec.authFailedAt = Date.now()
    }
    if (errLower.includes('429') || errLower.includes('rate limit')) {
      // Default 60s rate limit cooldown
      rec.rateLimitResetAt = Date.now() + 60_000
    }
  }

  /** Record a rate limit with specific reset time */
  recordRateLimit(providerId: string, resetAt: Date): void {
    const rec = this.getOrCreate(providerId)
    rec.rateLimitResetAt = resetAt.getTime()
    rec.lastError = 'Rate limited'
  }

  /** Record an auth failure */
  recordAuthFailure(providerId: string): void {
    const rec = this.getOrCreate(providerId)
    rec.authFailedAt = Date.now()
    rec.lastError = 'Authentication failed'
  }

  /** Get truthful health snapshot for a provider */
  getHealth(providerId: string): ProviderHealth {
    const rec = this.records.get(providerId)

    if (!rec) {
      return {
        state: 'not_configured',
        latencyMs: 0,
        lastSuccessAt: null,
        lastFailureAt: null,
        failureStreak: 0,
        rateLimitResetAt: null,
        errorMessage: 'Provider not registered',
      }
    }

    if (!rec.configured) {
      return {
        state: 'not_configured',
        latencyMs: 0,
        lastSuccessAt: null,
        lastFailureAt: null,
        failureStreak: 0,
        rateLimitResetAt: null,
        errorMessage: 'Provider not configured — missing credentials',
      }
    }

    const state = this.computeState(rec)
    const avgLatency = rec.latencies.length > 0
      ? Math.round(rec.latencies.reduce((a, b) => a + b, 0) / rec.latencies.length)
      : 0

    return {
      state,
      latencyMs: avgLatency,
      lastSuccessAt: rec.lastSuccessAt ? new Date(rec.lastSuccessAt) : null,
      lastFailureAt: rec.lastFailureAt ? new Date(rec.lastFailureAt) : null,
      failureStreak: rec.failureStreak,
      rateLimitResetAt: rec.rateLimitResetAt ? new Date(rec.rateLimitResetAt) : null,
      errorMessage: rec.lastError || undefined,
    }
  }

  /** Get health score (0-100) for routing decisions. Higher = healthier */
  getHealthScore(providerId: string): number {
    const h = this.getHealth(providerId)

    switch (h.state) {
      case 'healthy':
        // Penalize high latency slightly
        return Math.max(70, 100 - Math.floor(h.latencyMs / 100))
      case 'degraded':
        return 40
      case 'rate_limited':
        return 10
      case 'failing_over':
        return 5
      case 'auth_failed':
        return 0
      case 'not_configured':
        return 0
      case 'disconnected':
        return 0
      default:
        return 0
    }
  }

  /** Get all registered provider healths */
  getAllHealths(): Map<string, ProviderHealth> {
    const result = new Map<string, ProviderHealth>()
    for (const [id] of this.records) {
      result.set(id, this.getHealth(id))
    }
    return result
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private getOrCreate(providerId: string): HealthRecord {
    let rec = this.records.get(providerId)
    if (!rec) {
      rec = {
        latencies: [],
        lastSuccessAt: null,
        lastFailureAt: null,
        failureStreak: 0,
        rateLimitResetAt: null,
        authFailedAt: null,
        configured: true,
        lastError: null,
      }
      this.records.set(providerId, rec)
    }
    return rec
  }

  private computeState(rec: HealthRecord): ProviderHealthState {
    const now = Date.now()

    // Auth failure is a hard block
    if (rec.authFailedAt && now - rec.authFailedAt < 300_000) {
      return 'auth_failed'
    }

    // Rate limited
    if (rec.rateLimitResetAt && now < rec.rateLimitResetAt) {
      return 'rate_limited'
    }

    // Never succeeded and no recent activity
    if (rec.lastSuccessAt === null && rec.lastFailureAt === null) {
      return rec.configured ? 'healthy' : 'not_configured'
    }

    // High failure streak
    if (rec.failureStreak >= 10) {
      return 'disconnected'
    }
    if (rec.failureStreak >= 5) {
      return 'failing_over'
    }

    // Recent failures but some successes
    if (rec.failureStreak >= 2) {
      return 'degraded'
    }

    // Long time since last success
    if (rec.lastSuccessAt && now - rec.lastSuccessAt > 300_000 && rec.failureStreak > 0) {
      return 'degraded'
    }

    return 'healthy'
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

export const healthMonitor = new HealthMonitor()
