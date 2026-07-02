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

  const fetchHealth = useCallback(async (showToast = false) => {
    try {
      const [healthRes, logsRes] = await Promise.all([
        fetch('/api/integrations/test'),
        fetch('/api/cockpit/logs'),
      ])
      const healthData = await healthRes.json()
      const logsData = await logsRes.json()
      setHealth(healthData)
      setLogs(logsData.logs || [])
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>System Health & Logs</h1>
        <ActionButton
          label={refreshing ? 'Checking...' : '🔄 Refresh'}
          variant="ghost"
          onClick={handleRefresh}
        />
      </div>
      <p style={{ margin: '0 0 1.5rem', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
        {summary.connected} connected • {summary.missing} not configured • {summary.errors} errors
        {health?.checkedAt && ` • Last checked: ${new Date(health.checkedAt).toLocaleTimeString()}`}
      </p>

      {/* Overall Status */}
      <div style={{
        background: summary.errors > 0 ? 'rgba(239,68,68,0.08)' : summary.missing > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(0,169,128,0.08)',
        border: `1px solid ${summary.errors > 0 ? 'rgba(239,68,68,0.2)' : summary.missing > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(0,169,128,0.2)'}`,
        borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <span style={{ fontSize: '2rem' }}>{summary.errors > 0 ? '🔴' : summary.missing > 0 ? '🟡' : '🟢'}</span>
        <div>
          <div style={{ color: '#fff', fontSize: '1rem', fontWeight: 600 }}>
            {summary.errors > 0 ? 'Some integrations have errors' : summary.missing > 0 ? `System operational — ${summary.missing} integration${summary.missing > 1 ? 's' : ''} not configured` : 'All systems operational'}
          </div>
          <div style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.75rem' }}>
            {summary.connected}/{summary.total} integrations connected
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1rem' }}>
        {/* Live Integration Status */}
        <Card title="Integration Status (Live)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {integrations.map(svc => {
              const st = statusMap[svc.status]
              return (
                <div key={svc.name} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.5rem 0.6rem', background: 'rgba(0,0,0,0.1)', borderRadius: 6,
                }}>
                  <span style={{ fontSize: '0.8rem' }}>{st.icon}</span>
                  <span style={{ flex: 1, color: '#e2e8f0', fontSize: '0.8rem' }}>{svc.name}</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.2rem 0.5rem', borderRadius: 999, fontSize: '0.6rem', fontWeight: 600,
                    background: `${st.color}15`, color: st.color,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color }} />
                    {st.label}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* System Logs (Live) */}
        <Card title="System Logs (Live)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontFamily: 'var(--font-geist-mono), monospace' }}>
            {logs.length > 0 ? logs.slice(0, 15).map(log => (
              <div key={log.id} style={{
                display: 'flex', gap: '0.5rem', padding: '0.4rem 0',
                borderBottom: '1px solid rgba(255,204,51,0.03)', fontSize: '0.7rem',
              }}>
                <span style={{ color: 'rgba(255,204,51,0.3)', minWidth: 65 }}>
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span style={{
                  color: levelColors[log.level], minWidth: 40, fontWeight: 600,
                  textTransform: 'uppercase',
                }}>{log.level}</span>
                <span style={{ color: 'rgba(255,204,51,0.4)', minWidth: 55 }}>[{log.category}]</span>
                <span style={{ color: '#e2e8f0' }}>{log.message}</span>
              </div>
            )) : (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,204,51,0.3)', fontSize: '0.75rem' }}>
                No system logs yet. Logs appear as integrations are used.
              </div>
            )}
          </div>
        </Card>

        {/* Missing Configurations */}
        {integrations.filter(i => i.status === 'missing').length > 0 && (
          <Card title="Configuration Required" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.4rem' }}>
              {integrations.filter(i => i.status === 'missing').map(svc => (
                <div key={svc.name} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.06)',
                  border: '1px solid rgba(245,158,11,0.1)', borderRadius: 6,
                }}>
                  <span style={{ color: '#F59E0B', fontSize: '0.8rem' }}>🔧</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 500 }}>{svc.name}</div>
                    <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>{svc.message}</div>
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
