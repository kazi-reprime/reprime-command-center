/**
 * useGatewayHealth — Live integration health monitoring
 *
 * Polls /api/gateway/health every 30 seconds.
 * Returns per-provider health, capability availability, and overall status.
 */

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

interface ProviderHealth {
  id: string
  name: string
  capabilities: string[]
  state: 'healthy' | 'degraded' | 'down' | 'not_configured'
  latencyMs?: number
  failureStreak: number
  circuitBreaker: string
  lastSuccessAt?: string
  lastFailureAt?: string
  error?: string
}

interface CapabilityMap {
  whatsapp: boolean
  email_send: boolean
  email_read: boolean
  ai: boolean
  stt: boolean
  tts: boolean
  meeting_create: boolean
  meeting_list: boolean
  calendar: boolean
  zoom: boolean
}

interface GatewayHealth {
  overall: 'healthy' | 'degraded' | 'critical'
  timestamp: string
  capabilities: CapabilityMap
  providers: ProviderHealth[]
}

export function useGatewayHealth(intervalMs = 30000) {
  const [health, setHealth] = useState<GatewayHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/gateway/health')
      if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
      const data = await res.json()
      setHealth(data as GatewayHealth)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    timerRef.current = setInterval(fetchHealth, intervalMs)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchHealth, intervalMs])

  // Derived states
  const isHealthy = health?.overall === 'healthy'
  const isDegraded = health?.overall === 'degraded'
  const isCritical = health?.overall === 'critical'

  const healthyCount = health?.providers.filter(p => p.state === 'healthy').length || 0
  const totalProviders = health?.providers.length || 0

  const canSendWhatsApp = health?.capabilities.whatsapp ?? false
  const canSendEmail = health?.capabilities.email_send ?? false
  const canReadEmail = health?.capabilities.email_read ?? false
  const canUseAI = health?.capabilities.ai ?? false
  const canUseMeetings = health?.capabilities.meeting_create ?? false

  return {
    health,
    loading,
    error,
    refresh: fetchHealth,
    // Overall
    isHealthy,
    isDegraded,
    isCritical,
    healthyCount,
    totalProviders,
    // Capabilities
    canSendWhatsApp,
    canSendEmail,
    canReadEmail,
    canUseAI,
    canUseMeetings,
  }
}
