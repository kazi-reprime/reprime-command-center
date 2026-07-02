'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, ActionButton, StatusBadge } from '@/components/ui/shared'
import { LoadingState } from '@/components/ui/LiveStatus'
import { useToast } from '@/lib/contexts/ToastContext'

interface IntegrationStatus {
  name: string
  status: 'connected' | 'missing' | 'error'
  message?: string
}

interface SettingsState {
  businessName: string
  ownerName: string
  timezone: string
  notifications: boolean
  aiAutoSummarize: boolean
  autoFollowUp: boolean
}

const DEFAULT_SETTINGS: SettingsState = {
  businessName: 'RePrime Capital',
  ownerName: 'Gideon Gratsiani',
  timezone: 'America/New_York',
  notifications: true,
  aiAutoSummarize: true,
  autoFollowUp: true,
}

export default function SettingsPage() {
  const { addToast } = useToast()
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState<string | null>(null)
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS)
  const [dirty, setDirty] = useState(false)

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cockpit_settings')
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) })
      }
    } catch {
      // Use defaults
    }
  }, [])

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/test')
      const data = await res.json()
      setIntegrations(data.integrations || [])
    } catch {
      addToast('Failed to check integration status', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { fetchIntegrations() }, [fetchIntegrations])

  const handleTestIntegration = async (integration: string) => {
    setTesting(integration)
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration }),
      })
      const data = await res.json()
      addToast(
        `${data.name}: ${data.status === 'connected' ? 'Connected successfully' : data.message || 'Not configured'}`,
        data.status === 'connected' ? 'success' : data.status === 'error' ? 'error' : 'warning'
      )
      // Refresh all integrations
      fetchIntegrations()
    } catch {
      addToast('Test failed', 'error')
    } finally {
      setTesting(null)
    }
  }

  const handleSaveSettings = () => {
    try {
      localStorage.setItem('cockpit_settings', JSON.stringify(settings))
      setDirty(false)
      addToast('Settings saved successfully', 'success')
    } catch {
      addToast('Failed to save settings', 'error')
    }
  }

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const integrationTestMap: Record<string, string> = {
    'Database': 'database',
    'Email (SendGrid)': 'email',
    'WhatsApp (Timelines)': 'whatsapp',
    'CRM (Pipedrive)': 'crm',
    'Google (Gmail/Calendar)': 'google',
    'Redis (Upstash)': 'redis',
    'Voice (ElevenLabs)': 'voice',
    'Billing (Stripe)': 'stripe',
    'Slack': 'slack',
    'Zoom': 'zoom',
  }

  if (loading) return <LoadingState message="Loading settings..." />

  return (
    <div>
      <h1 style={{ margin: '0 0 0.25rem', color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Settings & Configuration</h1>
      <p style={{ margin: '0 0 1.5rem', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
        Manage integrations, preferences, and system configuration
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1rem' }}>
        {/* Business Settings */}
        <Card title="Business Profile">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { label: 'Business Name', key: 'businessName' as const, value: settings.businessName },
              { label: 'Owner Name', key: 'ownerName' as const, value: settings.ownerName },
              { label: 'Timezone', key: 'timezone' as const, value: settings.timezone },
            ].map(field => (
              <div key={field.key}>
                <label style={{ display: 'block', color: 'rgba(255,204,51,0.6)', fontSize: '0.7rem', marginBottom: '0.25rem', fontWeight: 500 }}>{field.label}</label>
                <input
                  value={field.value}
                  onChange={e => updateSetting(field.key, e.target.value)}
                  style={{
                    width: '100%', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,204,51,0.1)', borderRadius: 8,
                    color: '#fff', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Feature Toggles */}
        <Card title="Features & Preferences">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[
              { label: 'Push Notifications', key: 'notifications' as const, desc: 'Receive alerts for important events' },
              { label: 'AI Auto-Summarize', key: 'aiAutoSummarize' as const, desc: 'Generate AI summaries for new messages' },
              { label: 'Auto Follow-Up Reminders', key: 'autoFollowUp' as const, desc: 'Automatic follow-up scheduling' },
            ].map(toggle => (
              <div key={toggle.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.1)', borderRadius: 8,
              }}>
                <div>
                  <div style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 500 }}>{toggle.label}</div>
                  <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>{toggle.desc}</div>
                </div>
                <button
                  onClick={() => updateSetting(toggle.key, !settings[toggle.key])}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: settings[toggle.key] ? '#00A980' : 'rgba(255,204,51,0.15)',
                    position: 'relative', transition: 'background 200ms',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3,
                    left: settings[toggle.key] ? 23 : 3,
                    transition: 'left 200ms',
                  }} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Integration Status (Live) */}
        <Card title="Integration Status (Live)" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.5rem' }}>
            {integrations.map(svc => {
              const testKey = Object.entries(integrationTestMap).find(([name]) => svc.name.includes(name.split(' ')[0]))?.[1]
              return (
                <div key={svc.name} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.1)', borderRadius: 8,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: svc.status === 'connected' ? '#00A980' : svc.status === 'error' ? '#EF4444' : '#F59E0B',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 500 }}>{svc.name}</div>
                    {svc.message && <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.message}</div>}
                  </div>
                  <span style={{
                    padding: '0.2rem 0.5rem', borderRadius: 999, fontSize: '0.6rem', fontWeight: 600,
                    background: svc.status === 'connected' ? 'rgba(0,169,128,0.15)' : svc.status === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                    color: svc.status === 'connected' ? '#00A980' : svc.status === 'error' ? '#EF4444' : '#F59E0B',
                  }}>
                    {svc.status === 'connected' ? 'Connected' : svc.status === 'error' ? 'Error' : 'Missing'}
                  </span>
                  {testKey && (
                    <ActionButton
                      label={testing === testKey ? '...' : 'Test'}
                      variant="ghost"
                      onClick={() => handleTestIntegration(testKey)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Save Button */}
      <div style={{
        position: 'sticky', bottom: 20, display: 'flex', justifyContent: 'flex-end',
        marginTop: '1.5rem', gap: '0.5rem',
      }}>
        {dirty && (
          <div style={{
            padding: '0.75rem 1.25rem', background: 'rgba(14,52,112,0.95)',
            border: '1px solid rgba(255,204,51,0.15)', borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
          }}>
            <span style={{ color: '#F59E0B', fontSize: '0.8rem' }}>Unsaved changes</span>
            <ActionButton label="Save Changes" variant="primary" size="md" onClick={handleSaveSettings} />
            <ActionButton label="Discard" variant="ghost" size="md" onClick={() => {
              try {
                const saved = localStorage.getItem('cockpit_settings')
                if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) })
                else setSettings(DEFAULT_SETTINGS)
              } catch { setSettings(DEFAULT_SETTINGS) }
              setDirty(false)
            }} />
          </div>
        )}
      </div>
    </div>
  )
}
