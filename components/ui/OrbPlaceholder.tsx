'use client'

import React, { useState, useEffect } from 'react'

type ShellState = 'idle' | 'listening' | 'recording' | 'parsing' | 'sent'

export function OrbPlaceholder({ className = '' }: { className?: string }) {
  const [state, setState] = useState<ShellState>('idle')

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ state: ShellState }>
      setState(customEvent.detail.state)
    }
    window.addEventListener('nora-state-change', handler)
    return () => window.removeEventListener('nora-state-change', handler)
  }, [])

  let outerGlow = 'bg-purple-500/20'
  let innerGradient = 'from-white via-purple-100 to-purple-400'
  let shadow = 'rgba(168,85,247,0.3)'
  let animation = 'animate-bounce'

  if (state === 'listening') {
    outerGlow = 'bg-warning/30'
    innerGradient = 'from-white via-amber-100 to-amber-400'
    shadow = 'rgba(245,158,11,0.3)'
    animation = 'animate-pulse'
  } else if (state === 'recording') {
    outerGlow = 'bg-red-500/30'
    innerGradient = 'from-white via-red-100 to-red-400'
    shadow = 'rgba(239,68,68,0.3)'
    animation = 'animate-pulse scale-110'
  } else if (state === 'parsing') {
    outerGlow = 'bg-indigo-500/30'
    innerGradient = 'from-white via-indigo-100 to-indigo-400'
    shadow = 'rgba(99,102,241,0.3)'
    animation = 'animate-ping'
  } else if (state === 'sent') {
    outerGlow = 'bg-success/30'
    innerGradient = 'from-white via-emerald-100 to-emerald-400'
    shadow = 'rgba(16,185,129,0.3)'
    animation = 'animate-bounce'
  }

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer Glow */}
      <div className={`absolute w-full h-full ${outerGlow} rounded-full blur-2xl transition-colors duration-500`} />
      
      {/* The 3D Orb */}
      <div 
        className={`relative w-16 h-16 rounded-full bg-gradient-to-br ${innerGradient} ${animation} transition-all duration-500`}
        style={{
          boxShadow: `inset 0 -8px 16px rgba(0,0,0,0.1), 0 8px 24px ${shadow}`,
          animationDuration: state === 'idle' ? '4s' : '1.5s',
          animationTimingFunction: 'ease-in-out',
        }}
      >
        {/* Specular highlight for 3D effect */}
        <div className="absolute top-2 left-3 w-6 h-4 bg-surface/80 rounded-full blur-[2px] transform rotate-[-45deg]" />
      </div>
    </div>
  )
}
