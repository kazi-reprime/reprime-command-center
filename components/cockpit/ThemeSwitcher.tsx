'use client'

import { useTheme } from 'next-themes'
import { useState, useEffect, useRef } from 'react'

const THEMES = [
  {
    id: 'light',
    name: 'Executive Light',
    description: 'Premium warm white',
    swatch: 'bg-white border-blue-200',
    preview: ['#fdfdfd', '#3b82f6', '#0f172a'],
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Premium dark mode',
    swatch: 'bg-slate-900 border-blue-500',
    preview: ['#0b1120', '#3b82f6', '#f8fafc'],
  },
  {
    id: 'aurora',
    name: 'Glass Aurora',
    description: 'Glassmorphic lavender',
    swatch: 'bg-violet-100 border-violet-400',
    preview: ['#f3f0ff', '#6366f1', '#1e1b4b'],
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'Maximum clarity',
    swatch: 'bg-white border-black border-2',
    preview: ['#ffffff', '#0000ea', '#000000'],
  },
  {
    id: 'slate',
    name: 'Slate Professional',
    description: 'Enterprise neutral',
    swatch: 'bg-slate-200 border-slate-500',
    preview: ['#f1f5f9', '#0f172a', '#0f172a'],
  },
] as const

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  if (!mounted) return (
    <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border animate-pulse" />
  )

  const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-raised border border-border hover:bg-surface-hover transition-all cursor-pointer"
        aria-label={`Current theme: ${currentTheme.name}. Click to change theme.`}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Change theme"
      >
        {/* Swatch */}
        <div className="flex gap-0.5">
          {currentTheme.preview.map((color, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full border border-border" style={{ backgroundColor: color }} />
          ))}
        </div>
        <span className="text-xs font-semibold text-text-secondary hidden sm:inline">
          {currentTheme.name}
        </span>
        <svg className={`w-3 h-3 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-64 bg-surface border border-border rounded-2xl shadow-lg overflow-hidden z-[9999] animate-in fade-in slide-in-from-top-2 duration-150"
          role="listbox"
          aria-label="Theme selection"
        >
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Appearance</span>
          </div>
          {THEMES.map((t) => {
            const isSelected = theme === t.id
            return (
              <button
                key={t.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => { setTheme(t.id); setOpen(false) }}
                className={`w-full px-3 py-2.5 flex items-center gap-3 transition-all cursor-pointer border-none text-left ${
                  isSelected
                    ? 'bg-accent/10'
                    : 'hover:bg-surface-hover'
                }`}
              >
                {/* Preview dots */}
                <div className="flex gap-0.5 shrink-0">
                  {t.preview.map((color, i) => (
                    <div key={i} className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: color }} />
                  ))}
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${isSelected ? 'text-accent' : 'text-text-primary'}`}>
                    {t.name}
                  </div>
                  <div className="text-[11px] text-text-muted">{t.description}</div>
                </div>

                {isSelected && (
                  <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
