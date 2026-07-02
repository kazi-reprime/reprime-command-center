'use client'

import React, { useState } from 'react'
import { Card, ActionButton, FormInput, FormSelect } from '@/components/ui/shared'

const integrations = [
  { id: 'supabase', name: 'Supabase', icon: '🗄️', category: 'Database', status: 'connected', keys: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] },
  { id: 'anthropic', name: 'Anthropic (Claude)', icon: '🧠', category: 'AI', status: 'connected', keys: ['ANTHROPIC_API_KEY'] },
  { id: 'openai', name: 'OpenAI', icon: '🤖', category: 'AI', status: 'optional', keys: ['OPENAI_API_KEY'] },
  { id: 'google', name: 'Google (Calendar/Gmail)', icon: '📅', category: 'Communication', status: 'connected', keys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'] },
  { id: 'timelines', name: 'Timelines.ai (WhatsApp)', icon: '💬', category: 'Communication', status: 'connected', keys: ['TIMELINES_API_KEY'] },
  { id: 'pipedrive', name: 'Pipedrive CRM', icon: '📊', category: 'CRM', status: 'connected', keys: ['PIPEDRIVE_API_TOKEN'] },
  { id: 'sendgrid', name: 'SendGrid', icon: '📨', category: 'Email', status: 'connected', keys: ['SENDGRID_API_KEY'] },
  { id: 'elevenlabs', name: 'ElevenLabs', icon: '🔊', category: 'Voice', status: 'optional', keys: ['ELEVENLABS_API_KEY'] },
  { id: 'redis', name: 'Upstash Redis', icon: '⚡', category: 'Caching', status: 'connected', keys: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'] },
  { id: 'stripe', name: 'Stripe', icon: '💳', category: 'Billing', status: 'not_connected', keys: ['STRIPE_SECRET_KEY'] },
  { id: 'slack', name: 'Slack', icon: '🔔', category: 'Notifications', status: 'not_connected', keys: ['SLACK_WEBHOOK_URL'] },
  { id: 'zoom', name: 'Zoom', icon: '📹', category: 'Meetings', status: 'optional', keys: ['ZOOM_API_KEY'] },
]

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general')
  const [saved, setSaved] = useState(false)

  const [settings, setSettings] = useState({
    businessName: 'RePrime Group',
    ownerName: 'Gideon',
    email: 'g@reprime.com',
    timezone: 'America/New_York',
    currency: 'USD',
    language: 'en',
    theme: 'dark',
    aiModel: 'claude-sonnet-4-20250514',
    aiTemperature: '0.7',
    emailNotifications: true,
    slackNotifications: false,
    dailyBriefing: true,
    briefingTime: '08:00',
  })

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const sections = [
    { key: 'general', label: 'General', icon: '⚙️' },
    { key: 'integrations', label: 'Integrations', icon: '🔗' },
    { key: 'ai', label: 'AI Configuration', icon: '🧠' },
    { key: 'notifications', label: 'Notifications', icon: '🔔' },
    { key: 'team', label: 'Team', icon: '👥' },
  ]

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    connected: { bg: 'rgba(0,169,128,0.15)', text: '#00A980', label: 'Connected' },
    optional: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', label: 'Optional' },
    not_connected: { bg: 'rgba(107,114,128,0.15)', text: '#6B7280', label: 'Not Connected' },
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 0.25rem', color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Settings & Integrations</h1>
      <p style={{ margin: '0 0 1.5rem', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>Configure your Command Center</p>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1.5rem' }}>
        {/* Section Nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {sections.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 0.75rem', borderRadius: 8, border: 'none',
                background: activeSection === s.key ? 'rgba(255,204,51,0.1)' : 'transparent',
                color: activeSection === s.key ? '#FFCC33' : 'rgba(255,204,51,0.5)',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
                textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div>
          {activeSection === 'general' && (
            <Card title="General Settings">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <FormInput label="Business Name" value={settings.businessName} onChange={v => setSettings(s => ({ ...s, businessName: v }))} />
                <FormInput label="Owner Name" value={settings.ownerName} onChange={v => setSettings(s => ({ ...s, ownerName: v }))} />
                <FormInput label="Email" value={settings.email} onChange={v => setSettings(s => ({ ...s, email: v }))} type="email" />
                <FormSelect label="Timezone" value={settings.timezone} onChange={v => setSettings(s => ({ ...s, timezone: v }))} options={[
                  { value: 'America/New_York', label: 'Eastern (ET)' },
                  { value: 'America/Chicago', label: 'Central (CT)' },
                  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
                  { value: 'Asia/Jerusalem', label: 'Israel (IST)' },
                ]} />
                <FormSelect label="Currency" value={settings.currency} onChange={v => setSettings(s => ({ ...s, currency: v }))} options={[
                  { value: 'USD', label: 'USD ($)' }, { value: 'EUR', label: 'EUR (€)' }, { value: 'ILS', label: 'ILS (₪)' },
                ]} />
                <FormSelect label="Theme" value={settings.theme} onChange={v => setSettings(s => ({ ...s, theme: v }))} options={[
                  { value: 'dark', label: 'Dark (Navy)' }, { value: 'light', label: 'Light' },
                ]} />
              </div>
              <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <ActionButton label={saved ? '✓ Saved' : 'Save Changes'} onClick={handleSave} variant="primary" size="md" />
              </div>
            </Card>
          )}

          {activeSection === 'integrations' && (
            <Card title="Integration Management" noPad>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {integrations.map(int => {
                  const st = statusColors[int.status]
                  return (
                    <div key={int.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,204,51,0.04)',
                    }}>
                      <span style={{ fontSize: '1.25rem' }}>{int.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{int.name}</div>
                        <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>{int.category} • Keys: {int.keys.join(', ')}</div>
                      </div>
                      <span style={{
                        padding: '0.2rem 0.5rem', borderRadius: 999,
                        background: st.bg, color: st.text, fontSize: '0.65rem', fontWeight: 600,
                      }}>{st.label}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {activeSection === 'ai' && (
            <Card title="AI Configuration">
              <FormSelect label="Default AI Model" value={settings.aiModel} onChange={v => setSettings(s => ({ ...s, aiModel: v }))} options={[
                { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
                { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
                { value: 'gpt-4o', label: 'GPT-4o' },
              ]} />
              <FormInput label="Temperature" value={settings.aiTemperature} onChange={v => setSettings(s => ({ ...s, aiTemperature: v }))} type="number" placeholder="0.0 - 1.0" />
              <div style={{ marginTop: '1rem' }}>
                <ActionButton label={saved ? '✓ Saved' : 'Save Changes'} onClick={handleSave} variant="primary" size="md" />
              </div>
            </Card>
          )}

          {activeSection === 'notifications' && (
            <Card title="Notification Preferences">
              {[
                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive email alerts for important events' },
                { key: 'slackNotifications', label: 'Slack Notifications', desc: 'Post updates to your Slack channel' },
                { key: 'dailyBriefing', label: 'Daily Briefing', desc: 'Receive AI-generated daily briefing' },
              ].map(item => (
                <div key={item.key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.85rem 0', borderBottom: '1px solid rgba(255,204,51,0.04)',
                }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500 }}>{item.label}</div>
                    <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.7rem' }}>{item.desc}</div>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, [item.key]: !s[item.key as keyof typeof s] }))}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: (settings[item.key as keyof typeof settings] as boolean) ? '#00A980' : 'rgba(255,204,51,0.1)',
                      position: 'relative', transition: 'background 200ms',
                    }}
                  >
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 3,
                      left: (settings[item.key as keyof typeof settings] as boolean) ? 23 : 3,
                      transition: 'left 200ms',
                    }} />
                  </button>
                </div>
              ))}
              {settings.dailyBriefing && (
                <div style={{ marginTop: '0.75rem' }}>
                  <FormInput label="Briefing Time" value={settings.briefingTime} onChange={v => setSettings(s => ({ ...s, briefingTime: v }))} type="time" />
                </div>
              )}
              <div style={{ marginTop: '1rem' }}>
                <ActionButton label={saved ? '✓ Saved' : 'Save Changes'} onClick={handleSave} variant="primary" size="md" />
              </div>
            </Card>
          )}

          {activeSection === 'team' && (
            <Card title="Team Members">
              {[
                { name: 'Gideon', role: 'Owner / CEO', email: 'g@reprime.com' },
                { name: 'Shirel', role: 'Operations', email: 'shirel@reprime.com' },
                { name: 'Adir', role: 'Technology', email: 'adir@reprime.com' },
                { name: 'Yaron', role: 'Finance', email: 'yaron@reprime.com' },
              ].map(member => (
                <div key={member.name} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 0', borderBottom: '1px solid rgba(255,204,51,0.04)',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,204,51,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#FFCC33', fontSize: '0.75rem', fontWeight: 700,
                  }}>{member.name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{member.name}</div>
                    <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.7rem' }}>{member.role} • {member.email}</div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
