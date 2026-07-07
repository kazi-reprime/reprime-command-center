'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Palette, Check } from 'lucide-react';

const themes = [
  { name: 'Light', value: 'light', color: '#fdfdfd' },
  { name: 'Midnight', value: 'midnight', color: '#0b1120' },
  { name: 'Aurora', value: 'aurora', color: '#f3f0ff' },
  { name: 'High Contrast', value: 'high-contrast', color: '#ffffff' },
  { name: 'Slate', value: 'slate', color: '#f1f5f9' },
];

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-8 h-8 rounded-full bg-surface-glass border border-border animate-pulse" />;
  }

  const currentTheme = themes.find(t => t.value === theme) || themes[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-surface hover:bg-surface-hover border border-border text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-focus"
        aria-label="Toggle theme"
        title={`Current theme: ${currentTheme.name}`}
      >
        <Palette className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 py-2 bg-surface-raised border border-border rounded-xl shadow-glass-elevated z-50">
          <div className="px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
            Select Theme
          </div>
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setTheme(t.value);
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-4 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full border border-border-strong" 
                  style={{ backgroundColor: t.color }}
                />
                <span>{t.name}</span>
              </div>
              {theme === t.value && <Check className="w-4 h-4 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
