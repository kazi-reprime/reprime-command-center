/**
 * Audit Logger — Writes gateway actions to the audit_logs table
 * 
 * Every gateway operation (send, receive, failover, error) gets logged.
 * Secret values are redacted before persistence.
 */

import type { AuditLogEntry, GatewayCapability } from './types'

// In-memory buffer for batch writes
const buffer: AuditLogEntry[] = []
const MAX_BUFFER_SIZE = 50
const FLUSH_INTERVAL_MS = 10_000
let flushTimer: ReturnType<typeof setInterval> | null = null

/** Redact sensitive values from metadata before logging */
function redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE_KEYS = /key|token|secret|password|auth|credential|api_key|apikey/i
  const redacted: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.test(k) && typeof v === 'string') {
      redacted[k] = v.length > 8 ? `${v.slice(0, 4)}…${v.slice(-4)}` : '***'
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      redacted[k] = redactSecrets(v as Record<string, unknown>)
    } else {
      redacted[k] = v
    }
  }
  return redacted
}

/** Write an audit entry (buffered for batch writes) */
export function writeAuditLog(entry: AuditLogEntry): void {
  const sanitized: AuditLogEntry = {
    ...entry,
    metadata: entry.metadata ? redactSecrets(entry.metadata) : undefined,
    error: entry.error?.slice(0, 500), // Truncate long errors
  }

  buffer.push(sanitized)

  if (buffer.length >= MAX_BUFFER_SIZE) {
    void flushAuditLogs()
  }

  // Ensure periodic flush
  if (!flushTimer) {
    flushTimer = setInterval(() => {
      void flushAuditLogs()
    }, FLUSH_INTERVAL_MS)
  }
}

/** Flush buffered audit logs to the database */
export async function flushAuditLogs(): Promise<void> {
  if (buffer.length === 0) return

  const entries = buffer.splice(0, buffer.length)

  try {
    // Dynamic import to avoid circular deps with supabase client
    const { createServiceClient } = await import('@/lib/supabase/server')
    const supabase = createServiceClient()

    // The existing audit_logs table requires org_id — use the default org
    const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'

    const rows = entries.map((e) => ({
      org_id: DEFAULT_ORG_ID,
      action: `gateway:${e.action}`,
      details: {
        capability: e.capability,
        providerId: e.providerId,
        success: e.success,
        latencyMs: e.latencyMs,
        error: e.error,
        metadata: e.metadata,
      },
      created_at: e.timestamp.toISOString(),
    }))

    const { error } = await supabase.from('audit_logs').insert(rows)
    if (error) {
      console.error('[audit] flush failed:', error.message)
      // Don't re-buffer on failure — audit logs are best-effort
    }
  } catch (err) {
    console.error('[audit] flush threw:', (err as Error).message)
  }
}

/** Create a scoped audit helper for a specific capability */
export function createAuditor(capability: GatewayCapability) {
  return {
    success(providerId: string, latencyMs: number, metadata?: Record<string, unknown>): void {
      writeAuditLog({
        action: 'execute',
        capability,
        providerId,
        success: true,
        latencyMs,
        metadata,
        timestamp: new Date(),
      })
    },
    failure(providerId: string | null, latencyMs: number, error: string, metadata?: Record<string, unknown>): void {
      writeAuditLog({
        action: 'execute_failed',
        capability,
        providerId,
        success: false,
        latencyMs,
        error,
        metadata,
        timestamp: new Date(),
      })
    },
    event(action: string, metadata?: Record<string, unknown>): void {
      writeAuditLog({
        action,
        capability,
        providerId: null,
        success: true,
        latencyMs: 0,
        metadata,
        timestamp: new Date(),
      })
    },
  }
}
