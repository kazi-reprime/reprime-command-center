/**
 * Provider Registry — OpenClaw-style capability routing
 * 
 * Maps capabilities → ordered provider list.
 * Routes requests to the best available provider based on:
 *   1. Configuration status (is the provider configured?)
 *   2. Circuit breaker state (is the circuit open?)
 *   3. Health score (latency, failures, rate limits)
 *   4. Priority (user-defined preference order)
 * 
 * Automatic failover: if primary fails, tries next in chain.
 * Never duplicates outbound side effects during fallback.
 */

import type {
  GatewayCapability,
  GatewayRequest,
  GatewayResponse,
  ProviderAdapter,
  ProviderHealthReport,
  GatewayHealthReport,
  AuditLogEntry,
} from './types'
import { getCircuitBreaker } from './circuit-breaker'
import { healthMonitor } from './health-monitor'

// ── Registry State ─────────────────────────────────────────────────────────────

const providers = new Map<string, ProviderAdapter>()
const auditListeners: Array<(entry: AuditLogEntry) => void> = []

// ── Registration ───────────────────────────────────────────────────────────────

/** Register a provider adapter with the gateway */
export function registerProvider(adapter: ProviderAdapter): void {
  providers.set(adapter.id, adapter)
  healthMonitor.register(adapter.id, adapter.isConfigured())
  // Initialize circuit breaker
  getCircuitBreaker(adapter.id)
  console.log(
    `[gateway] registered provider: ${adapter.name} (${adapter.id}) — ` +
    `configured: ${adapter.isConfigured()}, capabilities: [${adapter.capabilities.join(', ')}]`,
  )
}

/** Unregister a provider */
export function unregisterProvider(id: string): void {
  providers.delete(id)
}

/** Subscribe to audit log entries */
export function onAudit(listener: (entry: AuditLogEntry) => void): () => void {
  auditListeners.push(listener)
  return () => {
    const idx = auditListeners.indexOf(listener)
    if (idx >= 0) auditListeners.splice(idx, 1)
  }
}

// ── Provider Selection ─────────────────────────────────────────────────────────

/** Get all providers for a capability, ordered by health score + priority */
export function getProvidersForCapability(capability: GatewayCapability): ProviderAdapter[] {
  const matching: ProviderAdapter[] = []

  for (const adapter of providers.values()) {
    if (adapter.capabilities.includes(capability) && adapter.isConfigured()) {
      matching.push(adapter)
    }
  }

  // Sort by health score (descending) then priority (ascending)
  return matching.sort((a, b) => {
    const scoreA = healthMonitor.getHealthScore(a.id)
    const scoreB = healthMonitor.getHealthScore(b.id)
    if (scoreA !== scoreB) return scoreB - scoreA
    return a.priority - b.priority
  })
}

/** Get the best available provider for a capability */
export function getBestProvider(capability: GatewayCapability): ProviderAdapter | null {
  const sorted = getProvidersForCapability(capability)

  for (const adapter of sorted) {
    const cb = getCircuitBreaker(adapter.id)
    if (cb.canExecute()) {
      return adapter
    }
  }

  return null
}

// ── Request Execution ──────────────────────────────────────────────────────────

/**
 * Execute a gateway request with automatic failover.
 * 
 * Tries providers in health-score order. On failure:
 * - Records failure in health monitor + circuit breaker
 * - Moves to next provider (NEVER retries the same outbound side effect)
 * - If all providers fail, returns error with full chain
 */
export async function executeRequest<TInput, TOutput>(
  request: GatewayRequest<TInput>,
): Promise<GatewayResponse<TOutput>> {
  const startTime = Date.now()
  const sorted = getProvidersForCapability(request.capability)
  const chain: string[] = []
  let lastError = ''

  if (sorted.length === 0) {
    emitAudit({
      action: 'gateway:no_provider',
      capability: request.capability,
      providerId: null,
      success: false,
      latencyMs: 0,
      error: `No configured provider for capability: ${request.capability}`,
      timestamp: new Date(),
    })

    return {
      success: false,
      providerId: 'none',
      error: `No configured provider for capability: ${request.capability}`,
      attemptsCount: 0,
      providerChain: [],
      totalLatencyMs: 0,
    }
  }

  // If a preferred provider is specified, put it first
  if (request.preferredProvider) {
    const idx = sorted.findIndex((a) => a.id === request.preferredProvider)
    if (idx > 0) {
      const [preferred] = sorted.splice(idx, 1)
      sorted.unshift(preferred)
    }
  }

  for (const adapter of sorted) {
    const cb = getCircuitBreaker(adapter.id)

    if (!cb.canExecute()) {
      chain.push(`${adapter.id}:circuit_open`)
      continue
    }

    chain.push(adapter.id)
    const attemptStart = Date.now()

    try {
      const result = await adapter.execute<TInput, TOutput>(request.capability, request.payload)
      const latency = Date.now() - attemptStart

      // Record success
      cb.recordSuccess()
      healthMonitor.recordSuccess(adapter.id, latency)

      emitAudit({
        action: 'gateway:execute',
        capability: request.capability,
        providerId: adapter.id,
        success: true,
        latencyMs: latency,
        metadata: request.metadata,
        timestamp: new Date(),
      })

      return {
        success: true,
        providerId: adapter.id,
        data: result,
        attemptsCount: chain.length,
        providerChain: chain,
        totalLatencyMs: Date.now() - startTime,
      }
    } catch (err) {
      const latency = Date.now() - attemptStart
      const errorMsg = err instanceof Error ? err.message : String(err)
      lastError = `${adapter.id}: ${errorMsg}`

      // Record failure
      cb.recordFailure(errorMsg)
      healthMonitor.recordFailure(adapter.id, errorMsg, latency)

      emitAudit({
        action: 'gateway:execute_failed',
        capability: request.capability,
        providerId: adapter.id,
        success: false,
        latencyMs: latency,
        error: errorMsg,
        metadata: request.metadata,
        timestamp: new Date(),
      })

      console.error(
        `[gateway] ${adapter.id} failed for ${request.capability}: ${errorMsg}`,
      )

      // Continue to next provider (failover) — DO NOT retry same provider
      // to avoid duplicate outbound side effects
    }
  }

  // All providers exhausted
  return {
    success: false,
    providerId: 'none',
    error: `All providers failed for ${request.capability}. Last error: ${lastError}`,
    attemptsCount: chain.length,
    providerChain: chain,
    totalLatencyMs: Date.now() - startTime,
  }
}

// ── Health Reporting ────────────────────────────────────────────────────────────

/** Get comprehensive health report for all registered providers */
export function getHealthReport(): GatewayHealthReport {
  const reports: ProviderHealthReport[] = []

  for (const adapter of providers.values()) {
    reports.push({
      providerId: adapter.id,
      name: adapter.name,
      capabilities: adapter.capabilities,
      health: healthMonitor.getHealth(adapter.id),
      circuitBreaker: getCircuitBreaker(adapter.id).getSnapshot(),
    })
  }

  // Compute overall
  const configured = reports.filter((r) => r.health.state !== 'not_configured')
  const healthy = configured.filter((r) => r.health.state === 'healthy')
  const overall =
    configured.length === 0
      ? 'critical'
      : healthy.length === configured.length
        ? 'ok'
        : healthy.length > 0
          ? 'degraded'
          : 'critical'

  return {
    overall,
    providers: reports,
    timestamp: new Date(),
  }
}

/** Get a list of all registered provider IDs */
export function getRegisteredProviderIds(): string[] {
  return Array.from(providers.keys())
}

/** Check if a specific capability has at least one healthy provider */
export function hasCapability(capability: GatewayCapability): boolean {
  return getBestProvider(capability) !== null
}

// ── Internal ───────────────────────────────────────────────────────────────────

function emitAudit(entry: AuditLogEntry): void {
  for (const listener of auditListeners) {
    try {
      listener(entry)
    } catch {
      // Audit listeners must never break the request path
    }
  }
}
