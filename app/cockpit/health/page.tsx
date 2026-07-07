/* eslint-disable */
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, ActionButton } from '@/components/ui/shared'
import { LoadingState } from '@/components/ui/LiveStatus'
import { useToast } from '@/lib/contexts/ToastContext'

interface IntegrationStatus {
  name: string
  status: 'connected' | 'missing' | 'error'
  message?: string
}

interface HealthData {
  integrations: IntegrationStatus[]
  summary: { connected: number; missing: number; errors: number; total: number }
  checkedAt: string
}

interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error'
  category: string
  message: string
}

const statusMap = {
  connected: { color: '#00A980', label: 'Connected', icon: '🟢' },
  missing: { color: '#F59E0B', label: 'Not Configured', icon: '🟡' },
  error: { color: '#EF4444', label: 'Error', icon: '🔴' },
}

const levelColors: Record<string, string> = { info: '#3B82F6', warn: '#F59E0B', error: '#EF4444' }

export default function HealthPage() {
  const { addToast } = useToast()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [gatewayProviders, setGatewayProviders] = useState<Array<{
    id: string; name: string; state: string; latencyMs?: number;
    capabilities: string[]; circuitBreaker: string; error?: string;
  }>>([])
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({})
  const [gatewayOverall, setGatewayOverall] = useState<string>('unknown')

  const fetchHealth = useCallback(async (showToast = false) => {
    try {
      const [healthRes, logsRes, gatewayRes] = await Promise.all([
        fetch('/api/integrations/test'),
        fetch('/api/cockpit/logs'),
        fetch('/api/gateway/health').catch(() => null),
      ])
      const healthData = await healthRes.json()
      const logsData = await logsRes.json()
      setHealth(healthData)
      setLogs(logsData.logs || [])

      // Merge gateway health data
      if (gatewayRes?.ok) {
        const gw = await gatewayRes.json()
        setGatewayProviders(gw.providers || [])
        setCapabilities(gw.capabilities || {})
        setGatewayOverall(gw.overall || 'unknown')

        // Merge gateway providers into the integrations list
        const gwIntegrations: IntegrationStatus[] = (gw.providers || []).map((p: {
          id: string; name: string; state: string; error?: string; latencyMs?: number;
        }) => ({
          name: `${p.name} [Gateway]`,
          status: p.state === 'healthy' ? 'connected' as const :
                  p.state === 'not_configured' ? 'missing' as const : 'error' as const,
          message: p.error || (p.latencyMs ? `${p.latencyMs}ms` : undefined),
        }))
        // Append gateway integrations that aren't duplicates
        const existingNames = new Set((healthData.integrations || []).map((i: IntegrationStatus) => i.name.toLowerCase()))
        const newIntegrations = gwIntegrations.filter((i: IntegrationStatus) =>
          !existingNames.has(i.name.replace(' [Gateway]', '').toLowerCase())
        )
        if (newIntegrations.length > 0) {
          const merged = [...(healthData.integrations || []), ...newIntegrations]
          const connected = merged.filter((i: IntegrationStatus) => i.status === 'connected').length
          const missing = merged.filter((i: IntegrationStatus) => i.status === 'missing').length
          const errors = merged.filter((i: IntegrationStatus) => i.status === 'error').length
          setHealth({
            ...healthData,
            integrations: merged,
            summary: { connected, missing, errors, total: merged.length },
          })
        }
      }

      if (showToast) addToast('Health check refreshed', 'success')
    } catch (err) {
      if (showToast) addToast('Failed to refresh health', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [addToast])

  useEffect(() => { fetchHealth() }, [fetchHealth])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchHealth(), 30000)
    return () => clearInterval(interval)
  }, [fetchHealth])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchHealth(true)
  }

  if (loading) return <LoadingState message="Checking system health..." />

  const summary = health?.summary || { connected: 0, missing: 0, errors: 0, total: 0 }
  const integrations = health?.integrations || []

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <h1 className="m-0 text-text-primary text-2xl font-bold">System Health &amp; Logs</h1>
        <ActionButton
          label={refreshing ? 'Checking...' : '🔄 Refresh'}
          variant="ghost"
          onClick={handleRefresh}
        />
      </div>
      <p className="mt-0 mb-4 text-text-secondary text-sm">
        {summary.connected} connected • {summary.missing} not configured • {summary.errors} errors
        {health?.checkedAt && ` • Last checked: ${new Date(health.checkedAt).toLocaleTimeString()}`}
      </p>

      {/* P0 Capabilities Bar */}
      {Object.keys(capabilities).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: 'whatsapp', label: 'WhatsApp', emoji: '💬' },
            { key: 'email_send', label: 'Email Send', emoji: '📤' },
            { key: 'email_read', label: 'Email Read', emoji: '📥' },
            { key: 'ai', label: 'AI Chat', emoji: '🧠' },
            { key: 'stt', label: 'Voice STT', emoji: '🎤' },
            { key: 'tts', label: 'Voice TTS', emoji: '🔊' },
            { key: 'meeting_create', label: 'Meetings', emoji: '📅' },
            { key: 'zoom', label: 'Zoom', emoji: '🎥' },
            { key: 'calendar', label: 'Calendar', emoji: '📆' },
          ].map(cap => {
            const active = capabilities[cap.key]
            return (
              <span
                key={cap.key}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.65rem] font-semibold"
                style={{
                  background: active ? 'rgba(0,169,128,0.08)' : 'rgba(245,158,11,0.08)',
                  color: active ? '#00A980' : '#9CA3AF',
                  border: `1px solid ${active ? 'rgba(0,169,128,0.2)' : 'rgba(156,163,175,0.15)'}`,
                }}
              >
                <span>{cap.emoji}</span>
                {cap.label}
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? '#00A980' : '#9CA3AF' }} />
              </span>
            )
          })}
          <span className="inline-flex items-center gap-1 px-2 py-1 text-[0.6rem] text-text-muted">
            Gateway: {gatewayOverall === 'healthy' ? '🟢' : gatewayOverall === 'degraded' ? '🟡' : '🔴'} {gatewayOverall}
            {gatewayProviders.length > 0 && ` • ${gatewayProviders.filter(p => p.state === 'healthy').length}/${gatewayProviders.length} providers`}
          </span>
        </div>
      )}

      {/* Overall Status */}
      <div
        className="rounded-xl p-5 mb-6 flex items-center gap-3"
        style={{
          background: summary.errors > 0 ? 'rgba(239,68,68,0.08)' : summary.missing > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(0,169,128,0.08)',
          border: `1px solid ${summary.errors > 0 ? 'rgba(239,68,68,0.2)' : summary.missing > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(0,169,128,0.2)'}`,
        }}
      >
        <span className="text-3xl">{summary.errors > 0 ? '🔴' : summary.missing > 0 ? '🟡' : '🟢'}</span>
        <div>
          <div className="text-text-primary text-base font-semibold">
            {summary.errors > 0 ? 'Some integrations have errors' : summary.missing > 0 ? `System operational — ${summary.missing} integration${summary.missing > 1 ? 's' : ''} not configured` : 'All systems operational'}
          </div>
          <div className="text-text-secondary text-xs">
            {summary.connected}/{summary.total} integrations connected
          </div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
        {/* Live Integration Status */}
        <Card title="Integration Status (Live)">
          <div className="flex flex-col gap-1.5">
            {integrations.map(svc => {
              const st = statusMap[svc.status]
              return (
                <div key={svc.name} className="flex items-center gap-2.5 p-2 bg-surface-hover rounded-md">
                  <span className="text-sm">{st.icon}</span>
                  <span className="flex-1 text-text-primary text-sm">{svc.name}</span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-semibold"
                    style={{ background: `${st.color}15`, color: st.color }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
                    {st.label}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* System Logs (Live) */}
        <Card title="System Logs (Live)">
          <div className="flex flex-col gap-1 font-mono">
            {logs.length > 0 ? logs.slice(0, 15).map(log => (
              <div key={log.id} className="flex gap-2 py-1.5 border-b border-border text-xs">
                <span className="text-text-muted" style={{ minWidth: 65 }}>
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span
                  className="font-semibold uppercase"
                  style={{ color: levelColors[log.level], minWidth: 40 }}
                >{log.level}</span>
                <span className="text-text-secondary" style={{ minWidth: 55 }}>[{log.category}]</span>
                <span className="text-text-primary">{log.message}</span>
              </div>
            )) : (
              <div className="p-4 text-center text-text-muted text-xs">
                No system logs yet. Logs appear as integrations are used.
              </div>
            )}
          </div>
        </Card>

        {/* Missing Configurations */}
        {integrations.filter(i => i.status === 'missing').length > 0 && (
          <Card title="Configuration Required" style={{ gridColumn: '1 / -1' }}>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
              {integrations.filter(i => i.status === 'missing').map(svc => (
                <div key={svc.name} className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
                  <span className="text-status-warning text-sm">🔧</span>
                  <div className="flex-1">
                    <div className="text-text-primary text-xs font-medium">{svc.name}</div>
                    <div className="text-text-secondary text-[0.65rem]">{svc.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
