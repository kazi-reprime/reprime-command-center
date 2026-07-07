'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import VoiceShell from '@/components/center/VoiceShell'

/**
 * NoraOverlay — renders a floating VoiceShell at the bottom of the screen
 * on ANY page (except /center where it's already integrated).
 */
export default function NoraOverlay() {
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()

  // Auto-hide on /center since it has its own VoiceShellFooter
  const isCenter = pathname?.startsWith('/center')

  useEffect(() => {
    const handleEmerge = () => {
      if (isCenter) return
      setVisible(true)
    }
    const handleClose = () => setVisible(false)

    window.addEventListener('nora:emerge', handleEmerge)
    window.addEventListener('nora:close-overlay', handleClose)
    return () => {
      window.removeEventListener('nora:emerge', handleEmerge)
      window.removeEventListener('nora:close-overlay', handleClose)
    }
  }, [isCenter])

  if (isCenter || !visible) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: '24px 40px 48px',
        background: 'linear-gradient(to top, rgba(14, 52, 112, 0.95), transparent)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        animation: 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style jsx global>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div style={{ width: '100%', maxWidth: 800, position: 'relative' }}>
        {/* Close affordance */}
        <button
          onClick={() => setVisible(false)}
          style={{
            position: 'absolute',
            right: -20,
            top: -20,
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'rgba(255, 204, 51, 0.1)',
            border: '1px solid rgba(255, 204, 51, 0.3)',
            color: 'var(--rp-gold)',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          ✕
        </button>

        <VoiceShell />
      </div>

      <div 
        style={{ 
          marginTop: 12, 
          fontSize: 10, 
          fontWeight: 800, 
          color: 'rgba(255,204,51,0.5)', 
          textTransform: 'uppercase', 
          letterSpacing: '0.2em' 
        }}
      >
        Nora Assistant • Active Everywhere
      </div>
    </div>,
    document.body
  )
}
