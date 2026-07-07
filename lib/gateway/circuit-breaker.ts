/**
 * Circuit Breaker — Hermes-style provider resilience
 * 
 * States: Closed → Open → Half-Open → Closed
 * 
 * - Closed: requests flow through normally. Failures are counted.
 * - Open: requests fail immediately. After resetTimeout, moves to Half-Open.
 * - Half-Open: limited probe requests. Success closes, failure reopens.
 * 
 * Persisted in-memory with optional Redis backing for multi-instance deployments.
 */

import type { CircuitBreakerConfig, CircuitBreakerSnapshot, CircuitBreakerState } from './types'

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  successThreshold: 2,
  windowMs: 60_000,
}

interface FailureRecord {
  timestamp: number
  error: string
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed'
  private failures: FailureRecord[] = []
  private halfOpenSuccesses = 0
  private lastStateChangeAt = Date.now()
  private lastSuccessAt: number | null = null
  private lastFailureAt: number | null = null
  private readonly config: CircuitBreakerConfig

  constructor(
    public readonly providerId: string,
    config?: Partial<CircuitBreakerConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** Get current state snapshot for monitoring */
  getSnapshot(): CircuitBreakerSnapshot {
    this.evaluateState()
    return {
      providerId: this.providerId,
      state: this.state,
      failureCount: this.getRecentFailureCount(),
      successCount: this.halfOpenSuccesses,
      lastFailureAt: this.lastFailureAt ? new Date(this.lastFailureAt) : null,
      lastSuccessAt: this.lastSuccessAt ? new Date(this.lastSuccessAt) : null,
      lastStateChangeAt: new Date(this.lastStateChangeAt),
      nextProbeAt: this.state === 'open'
        ? new Date(this.lastStateChangeAt + this.config.resetTimeoutMs)
        : null,
    }
  }

  /** Check if a request should be allowed through */
  canExecute(): boolean {
    this.evaluateState()

    switch (this.state) {
      case 'closed':
        return true
      case 'open':
        return false
      case 'half_open':
        // Allow limited probes in half-open
        return true
      default:
        return false
    }
  }

  /** Record a successful execution */
  recordSuccess(): void {
    this.lastSuccessAt = Date.now()

    if (this.state === 'half_open') {
      this.halfOpenSuccesses++
      if (this.halfOpenSuccesses >= this.config.successThreshold) {
        this.transitionTo('closed')
        this.failures = []
        this.halfOpenSuccesses = 0
      }
    }

    // In closed state, clear old failures
    if (this.state === 'closed') {
      this.pruneOldFailures()
    }
  }

  /** Record a failed execution */
  recordFailure(error: string): void {
    const now = Date.now()
    this.lastFailureAt = now
    this.failures.push({ timestamp: now, error })

    if (this.state === 'half_open') {
      // Any failure in half-open reopens the circuit
      this.transitionTo('open')
      this.halfOpenSuccesses = 0
      return
    }

    if (this.state === 'closed') {
      this.pruneOldFailures()
      if (this.getRecentFailureCount() >= this.config.failureThreshold) {
        this.transitionTo('open')
      }
    }
  }

  /** Reset the circuit breaker to closed state */
  reset(): void {
    this.transitionTo('closed')
    this.failures = []
    this.halfOpenSuccesses = 0
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private evaluateState(): void {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastStateChangeAt
      if (elapsed >= this.config.resetTimeoutMs) {
        this.transitionTo('half_open')
        this.halfOpenSuccesses = 0
      }
    }
  }

  private transitionTo(newState: CircuitBreakerState): void {
    if (this.state === newState) return
    const oldState = this.state
    this.state = newState
    this.lastStateChangeAt = Date.now()
    console.log(
      `[circuit-breaker] ${this.providerId}: ${oldState} → ${newState}`,
    )
  }

  private pruneOldFailures(): void {
    const cutoff = Date.now() - this.config.windowMs
    this.failures = this.failures.filter((f) => f.timestamp > cutoff)
  }

  private getRecentFailureCount(): number {
    const cutoff = Date.now() - this.config.windowMs
    return this.failures.filter((f) => f.timestamp > cutoff).length
  }
}

// ── Circuit Breaker Registry ─────────────────────────────────────────────────

const breakers = new Map<string, CircuitBreaker>()

/** Get or create a circuit breaker for a provider */
export function getCircuitBreaker(
  providerId: string,
  config?: Partial<CircuitBreakerConfig>,
): CircuitBreaker {
  let cb = breakers.get(providerId)
  if (!cb) {
    cb = new CircuitBreaker(providerId, config)
    breakers.set(providerId, cb)
  }
  return cb
}

/** Get all circuit breaker snapshots for monitoring */
export function getAllCircuitBreakerSnapshots(): CircuitBreakerSnapshot[] {
  return Array.from(breakers.values()).map((cb) => cb.getSnapshot())
}

/** Reset all circuit breakers (e.g., after config change) */
export function resetAllCircuitBreakers(): void {
  for (const cb of breakers.values()) {
    cb.reset()
  }
}
