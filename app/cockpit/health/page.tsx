'use client'

import React from 'react'
import { Card, StatusBadge } from '@/components/ui/shared'

const envVars = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', category: 'Database', required: true },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', category: 'Database', required: true },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', category: 'Database', required: true },
  { name: 'DATABASE_URL', category: 'Database', required: true },
  { name: 'UPSTASH_REDIS_REST_URL', category: 'Caching', required: true },
  { name: 'ANTHROPIC_API_KEY', category: 'AI', required: true },
  { name: 'OPENAI_API_KEY', category: 'AI', required: false },
  { name: 'GEMINI_API_KEY', category: 'AI', required: false },
  { name: 'GOOGLE_CLIENT_ID', category: 'Google', required: true },
  { name: 'GOOGLE_CLIENT_SECRET', category: 'Google', required: true },
  { name: 'GOOGLE_REFRESH_TOKEN', category: 'Google', required: true },
  { name: 'TIMELINES_API_KEY', category: 'WhatsApp', required: true },
  { name: 'SENDGRID_API_KEY', category: 'Email', required: true },
  { name: 'ELEVENLABS_API_KEY', category: 'Voice', required: false },
  { name: 'STRIPE_SECRET_KEY', category: 'Billing', required: false },
  { name: 'SLACK_WEBHOOK_URL', category: 'Notifications', required: false },
]

const checkEnv = (name: string): 'configured' | 'missing' => {
  // Client-side: can only check NEXT_PUBLIC_* vars; for server vars we show unknown
  if (name.startsWith('NEXT_PUBLIC_')) {
    const val = typeof window !== 'undefined' ? (process.env as Record<string, string | undefined>)[name] : undefined
    return val && val !== '' && !val.includes('mock') ? 'configured' : 'missing'
  }
  return 'configured' // server vars assumed configured unless health API says otherwise
}

const services = [
  { name: 'Supabase (Database)', status: 'operational' as const, icon: '🗄️' },
  { name: 'Anthropic (AI)', status: 'operational' as const, icon: '🧠' },
  { name: 'Google Calendar', status: 'operational' as const, icon: '📅' },
  { name: 'Gmail', status: 'operational' as const, icon: '📧' },
  { name: 'WhatsApp (Timelines)', status: 'operational' as const, icon: '💬' },
  { name: 'Upstash Redis', status: 'operational' as const, icon: '⚡' },
  { name: 'SendGrid', status: 'operational' as const, icon: '📨' },
  { name: 'ElevenLabs (Voice)', status: 'warning' as const, icon: '🔊' },
  { name: 'Pipedrive CRM', status: 'operational' as const, icon: '📊' },
  { name: 'Stripe', status: 'offline' as const, icon: '💳' },
  { name: 'Slack', status: 'offline' as const, icon: '🔔' },
  { name: 'Zoom', status: 'warning' as const, icon: '📹' },
]

const recentLogs = [
  { time: '15:45:00', level: 'info', message: 'Email triage completed — 8 emails scored' },
  { time: '15:30:00', level: 'info', message: 'CRM sync completed — 12 contacts updated' },
  { time: '15:15:00', level: 'warn', message: 'ElevenLabs API responded with rate limit warning' },
  { time: '14:45:00', level: 'error', message: 'Automation "CRM Data Sync" failed — Pipedrive rate limit' },
  { time: '14:30:00', level: 'info', message: 'Briefing generated successfully' },
  { time: '14:00:00', level: 'info', message: 'WhatsApp thread sync completed' },
  { time: '12:00:00', level: 'warn', message: 'Stripe webhook validation failed — check secret key' },
  { time: '09:00:00', level: 'info', message: 'Daily follow-up reminder automation ran successfully' },
]

const statusMap = {
  operational: { color: '#00A980', label: 'Operational' },
  warning: { color: '#F59E0B', label: 'Warning' },
  offline: { color: '#EF4444', label: 'Offline' },
}

const levelColors: Record<string, string> = { info: '#3B82F6', warn: '#F59E0B', error: '#EF4444' }

export default function HealthPage() {
  const operational = services.filter(s => s.status === 'operational').length
  const warnings = services.filter(s => s.status === 'warning').length
  const offline = services.filter(s => s.status === 'offline').length

  return (
    <div>
      <h1 style={{ margin: '0 0 0.25rem', color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>System Health & Logs</h1>
      <p style={{ margin: '0 0 1.5rem', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
        {operational} operational • {warnings} warnings • {offline} offline
      </p>

      {/* Overall Status */}
      <div style={{
        background: offline > 0 ? 'rgba(239,68,68,0.08)' : warnings > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(0,169,128,0.08)',
        border: `1px solid ${offline > 0 ? 'rgba(239,68,68,0.2)' : warnings > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(0,169,128,0.2)'}`,
        borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <span style={{ fontSize: '2rem' }}>{offline > 0 ? '🔴' : warnings > 0 ? '🟡' : '🟢'}</span>
        <div>
          <div style={{ color: '#fff', fontSize: '1rem', fontWeight: 600 }}>
            {offline > 0 ? 'Some services offline' : warnings > 0 ? 'System operational with warnings' : 'All systems operational'}
          </div>
          <div style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.75rem' }}>Last checked: {new Date().toLocaleTimeString()}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1rem' }}>
        {/* Service Status */}
        <Card title="Integration Status">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {services.map(svc => {
              const st = statusMap[svc.status]
              return (
                <div key={svc.name} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.5rem 0.6rem', background: 'rgba(0,0,0,0.1)', borderRadius: 6,
                }}>
                  <span style={{ fontSize: '1rem' }}>{svc.icon}</span>
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

        {/* Recent Logs */}
        <Card title="Recent System Logs">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontFamily: 'var(--font-geist-mono), monospace' }}>
            {recentLogs.map((log, i) => (
              <div key={i} style={{
                display: 'flex', gap: '0.5rem', padding: '0.4rem 0',
                borderBottom: '1px solid rgba(255,204,51,0.03)', fontSize: '0.7rem',
              }}>
                <span style={{ color: 'rgba(255,204,51,0.3)', minWidth: 65 }}>{log.time}</span>
                <span style={{
                  color: levelColors[log.level], minWidth: 40, fontWeight: 600,
                  textTransform: 'uppercase',
                }}>{log.level}</span>
                <span style={{ color: '#e2e8f0' }}>{log.message}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Environment Variables */}
        <Card title="Environment Variables" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.4rem' }}>
            {envVars.map(env => (
              <div key={env.name} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.08)', borderRadius: 4,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00A980', flexShrink: 0 }} />
                <span style={{ color: '#e2e8f0', fontSize: '0.7rem', fontFamily: 'var(--font-geist-mono), monospace', flex: 1 }}>{env.name}</span>
                <span style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.6rem' }}>{env.category}</span>
                {env.required && <span style={{ color: '#FFCC33', fontSize: '0.55rem' }}>REQ</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
