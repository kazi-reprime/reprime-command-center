/* eslint-disable */
'use client'

import { useState } from 'react'
import WhatsAppClient from '@/components/cockpit/WhatsAppClient'
import GmailClient from '@/components/cockpit/GmailClient'

type Tab = 'whatsapp' | 'gmail'

const TABS: { key: Tab; label: string; icon: string; color: string; gradient: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp', icon: '💬', color: '#25D366', gradient: 'linear-gradient(135deg, #25D366, #128C7E)' },
  { key: 'gmail', label: 'Gmail', icon: '📧', color: '#EA4335', gradient: 'linear-gradient(135deg, #EA4335, #C62828)' },
]

export default function CommsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('whatsapp')

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#0B1426', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Tab Bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(14,52,112,0.3)',
        flexShrink: 0,
      }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 24px', border: 'none',
              background: activeTab === tab.key ? tab.gradient : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'rgba(255,255,255,0.4)',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              letterSpacing: '0.03em',
              borderBottom: activeTab === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            <span style={{ fontSize: 16 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {activeTab === 'whatsapp' && <WhatsAppClient />}
        {activeTab === 'gmail' && <GmailClient />}
      </div>
    </div>
  )
}
