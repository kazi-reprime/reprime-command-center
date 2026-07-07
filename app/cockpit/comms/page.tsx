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
  return (
    <div style={{
      display: 'flex', 
      height: 'calc(100vh - 140px)',
      gap: 20,
      background: 'transparent', 
      fontFamily: 'inherit',
      overflow: 'hidden',
      padding: '0 4px 10px 4px',
    }}>
      {/* 🟢 WhatsApp Pillar */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        minWidth: 0, 
        borderRadius: 24, 
        overflow: 'hidden', 
        border: '1px solid rgba(37,211,102,0.2)',
        background: 'rgba(11,20,38,0.7)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.05)',
      }}>
        <div style={{ 
          padding: '16px 24px', 
          background: 'linear-gradient(90deg, rgba(37,211,102,0.15), transparent)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37,211,102,0.3)'
            }}>
              <span style={{ fontSize: 16 }}>💬</span>
            </div>
            <div>
              <span style={{ 
                color: '#fff', 
                fontWeight: 900, 
                fontSize: 13, 
                letterSpacing: '0.1em', 
                textTransform: 'uppercase',
                display: 'block'
              }}>WhatsApp Hub</span>
              <span style={{ fontSize: 9, color: 'rgba(37,211,102,0.6)', fontWeight: 800, letterSpacing: '0.05em' }}>ENCRYPTED SYNC</span>
            </div>
          </div>
          <div style={{ 
            fontSize: 10, 
            color: 'rgba(255,255,255,0.4)', 
            fontWeight: 700,
            background: 'rgba(255,255,255,0.05)',
            padding: '4px 10px',
            borderRadius: 6,
            letterSpacing: '0.05em'
          }}>ACTIVE</div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <WhatsAppClient />
        </div>
      </div>

      {/* 🔴 Google Pillar */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        minWidth: 0, 
        borderRadius: 24, 
        overflow: 'hidden', 
        border: '1px solid rgba(234,67,53,0.2)',
        background: 'rgba(11,20,38,0.7)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.05)',
      }}>
        <div style={{ 
          padding: '16px 24px', 
          background: 'linear-gradient(90deg, rgba(234,67,53,0.15), transparent)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg, #EA4335, #C62828)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(234,67,53,0.3)'
            }}>
              <span style={{ fontSize: 16 }}>📧</span>
            </div>
            <div>
              <span style={{ 
                color: '#fff', 
                fontWeight: 900, 
                fontSize: 13, 
                letterSpacing: '0.1em', 
                textTransform: 'uppercase',
                display: 'block'
              }}>Google Inbox</span>
              <span style={{ fontSize: 9, color: 'rgba(234,67,53,0.6)', fontWeight: 800, letterSpacing: '0.05em' }}>OAUTH SECURED</span>
            </div>
          </div>
          <div style={{ 
            fontSize: 10, 
            color: 'rgba(255,255,255,0.4)', 
            fontWeight: 700,
            background: 'rgba(255,255,255,0.05)',
            padding: '4px 10px',
            borderRadius: 6,
            letterSpacing: '0.05em'
          }}>SYNCED</div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <GmailClient />
        </div>
      </div>
    </div>
  )
}


