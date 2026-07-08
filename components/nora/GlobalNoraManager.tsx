'use client'

import { useEffect } from 'react'
import { useStore } from '@/lib/store/useStore'

/**
 * GlobalNoraManager — Handles spacebar trigger and voice interruption logic
 * across all cockpit and center views.
 */
export default function GlobalNoraManager() {
  const noraStatus = useStore(s => s.noraStatus)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Special case: Escape should still stop Nora even if focused in a field
        if (e.key === 'Escape') {
          window.dispatchEvent(new Event('nora:stop-speaking'))
        }
        return
      }

      const isSpace = e.key === ' ' || e.code === 'Space'
      if (isSpace && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        
        // If Nora is speaking or thinking, interrupt her immediately
        if (noraStatus === 'speaking' || noraStatus === 'thinking') {
          window.dispatchEvent(new Event('nora:stop-speaking'))
        }
        
        // Trigger Nora emergence (opens the voice shell overlay if not present)
        window.dispatchEvent(new Event('nora:emerge'))
        
        // Also trigger existing listeners on /center
        window.dispatchEvent(new Event('center:focus-nora'))

        // New unified event for VoiceShell to start recording
        window.dispatchEvent(new Event('nora:start-recording'))
      }

      if (e.key === 'Escape') {
        window.dispatchEvent(new Event('nora:stop-speaking'))
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        window.dispatchEvent(new Event('nora:stop-recording'))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [noraStatus])

  return null
}
