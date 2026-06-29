'use client'

import { useState } from 'react'
import { EMBED_TABS, type EmbedKey } from '@/lib/center/v2/embeds'
import BrowserChip from './BrowserChip'

/**
 * BrowserSurface — band 5 of /center/v2.
 *
 * Collapsed: 36-px chip strip. Expanded: 600-px iframe inline above the
 * chips. CoStar and Inforuptcy are X-Frame-Options blocked, so their
 * chips dispatch open-in-new-tab via window.open instead of expanding.
 *
 * Re-uses the WindowManager's iframe rendering convention (same sandbox
 * defaults) but renders inline in the dock so Gideon doesn't have to
 * place a window.
 */
export default function BrowserSurface() {
  const [active, setActive] = useState<EmbedKey | null>(null)

  function selectChip(key: EmbedKey) {
    const tab = EMBED_TABS.find((t) => t.key === key)
    if (!tab) return
    if (tab.externalOnly) {
      if (typeof window !== 'undefined') {
        window.open(tab.url, '_blank', 'noopener,noreferrer')
      }
      return
    }
    setActive((prev) => (prev === key ? null : key))
  }

  const activeTab = EMBED_TABS.find((t) => t.key === active) ?? null

  return (
    <div
      data-component="browser-surface-v2"
      style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(14, 52, 112, 0.78)',
        borderTop: '1px solid rgba(255, 204, 51, 0.18)',
        fontFamily: 'inherit',
      }}
    >
      {activeTab && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: 600,
            background: '#fff',
            borderBottom: '1px solid rgba(255, 204, 51, 0.18)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 14px',
              background: 'rgba(14, 52, 112, 0.96)',
              color: '#FFCC33',
              borderBottom: '1px solid rgba(255, 204, 51, 0.22)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.08em',
            }}
          >
            <span style={{ flex: 1 }}>{activeTab.label}</span>
            <a
              href={activeTab.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#FFCC33',
                textDecoration: 'none',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              ↗ open in tab
            </a>
            <button
              type="button"
              onClick={() => setActive(null)}
              style={{
                background: 'transparent',
                color: '#FFCC33',
                border: '1px solid rgba(255, 204, 51, 0.45)',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 700,
                padding: '2px 8px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              aria-label="Collapse browser surface"
            >
              –
            </button>
          </div>
          <iframe
            key={activeTab.key}
            src={activeTab.url}
            title={activeTab.label}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            style={{ flex: 1, width: '100%', border: 0, background: '#fff' }}
          />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          minHeight: 36,
          overflowX: 'auto',
        }}
      >
        <span
          style={{
            color: 'rgba(255, 204, 51, 0.55)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            flexShrink: 0,
            marginRight: 4,
          }}
        >
          Browser
        </span>
        {EMBED_TABS.map((tab) => (
          <BrowserChip
            key={tab.key}
            label={tab.label}
            active={active === tab.key}
            externalOnly={tab.externalOnly}
            onClick={() => selectChip(tab.key)}
          />
        ))}
      </div>
    </div>
  )
}
