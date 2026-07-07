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
      <h1 className="mb-1 text-text-primary text-2xl font-bold">Settings & Configuration</h1>
      <p className="mb-6 text-text-secondary text-xs">
        Manage integrations, preferences, and system configuration
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-4">
        {/* Business Settings */}
        <Card title="Business Profile">
          <div className="flex flex-col gap-3">
            {[
              { label: 'Business Name', key: 'businessName' as const, value: settings.businessName },
              { label: 'Owner Name', key: 'ownerName' as const, value: settings.ownerName },
              { label: 'Timezone', key: 'timezone' as const, value: settings.timezone },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-text-secondary text-[0.7rem] mb-1 font-medium">{field.label}</label>
                <input
                  value={field.value}
                  onChange={e => updateSetting(field.key, e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 border border-border rounded-lg text-text-primary text-sm outline-none font-[inherit] box-border"
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Feature Toggles */}
        <Card title="Features & Preferences">
          <div className="flex flex-col gap-2.5">
            {[
              { label: 'Push Notifications', key: 'notifications' as const, desc: 'Receive alerts for important events' },
              { label: 'AI Auto-Summarize', key: 'aiAutoSummarize' as const, desc: 'Generate AI summaries for new messages' },
              { label: 'Auto Follow-Up Reminders', key: 'autoFollowUp' as const, desc: 'Automatic follow-up scheduling' },
            ].map(toggle => (
              <div key={toggle.key} className="flex items-center justify-between px-3 py-2.5 bg-black/10 rounded-lg">
                <div>
                  <div className="text-text-primary text-xs font-medium">{toggle.label}</div>
                  <div className="text-text-muted text-[0.65rem]">{toggle.desc}</div>
                </div>
                <button
                  onClick={() => updateSetting(toggle.key, !settings[toggle.key])}
                  className="relative border-none cursor-pointer transition-colors duration-200"
                  style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: settings[toggle.key] ? '#00A980' : 'rgba(255,204,51,0.15)',
                  }}
                >
                  <div
                    className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-[left] duration-200"
                    style={{ left: settings[toggle.key] ? 23 : 3 }}
                  />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Integration Status (Live) */}
        <Card title="Integration Status (Live)" style={{ gridColumn: '1 / -1' }}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-2">
            {integrations.map(svc => {
              const testKey = Object.entries(integrationTestMap).find(([name]) => svc.name.includes(name.split(' ')[0]))?.[1]
              return (
                <div key={svc.name} className="flex items-center gap-2.5 px-3 py-2.5 bg-black/10 rounded-lg">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background: svc.status === 'connected' ? '#00A980' : svc.status === 'error' ? '#EF4444' : '#F59E0B',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-text-primary text-xs font-medium">{svc.name}</div>
                    {svc.message && <div className="text-text-muted text-[0.6rem] overflow-hidden text-ellipsis whitespace-nowrap">{svc.message}</div>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[0.6rem] font-semibold ${
                    svc.status === 'connected'
                      ? 'bg-status-success/15 text-status-success'
                      : svc.status === 'error'
                        ? 'bg-status-error/15 text-status-error'
                        : 'bg-status-warning/15 text-status-warning'
                  }`}>
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
      <div className="sticky bottom-5 flex justify-end mt-6 gap-2">
        {dirty && (
          <div className="flex items-center gap-3 px-5 py-3 bg-surface-raised border border-border rounded-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <span className="text-status-warning text-xs">Unsaved changes</span>
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
