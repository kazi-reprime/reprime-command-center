'use client'

import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { href: string; label: string; icon: string; shortLabel: string }
type NavSection = { title: string; items: NavItem[] }

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { href: '/cockpit', label: 'Dashboard', icon: '📊', shortLabel: 'Home' },
    ],
  },
  {
    title: 'Deal Flow',
    items: [
      { href: '/cockpit/properties', label: 'Properties', icon: '🏢', shortLabel: 'Props' },
      { href: '/cockpit/pipeline', label: 'Pipeline', icon: '🎯', shortLabel: 'Pipeline' },
      { href: '/cockpit/investors', label: 'Investors', icon: '💰', shortLabel: 'Invest' },
      { href: '/cockpit/scores', label: 'Scores', icon: '⭐', shortLabel: 'Scores' },
      { href: '/cockpit/brokers', label: 'Brokers', icon: '🤝', shortLabel: 'Brokers' },
    ],
  },
  {
    title: 'Stealth',
    items: [
      { href: '/cockpit/automations', label: 'Automations', icon: '⚡', shortLabel: 'Auto' },
      { href: '/cockpit/loi', label: 'LOI Creator', icon: '📄', shortLabel: 'LOI' },
    ],
  },
  {
    title: 'Outreach',
    items: [
      { href: '/cockpit/campaigns', label: 'Campaigns', icon: '📡', shortLabel: 'Campaigns' },
    ],
  },
  {
    title: 'Communications',
    items: [
      { href: '/cockpit/comms', label: 'Unified Inbox', icon: '💬', shortLabel: 'Comms' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/cockpit/tasks', label: 'Tasks', icon: '✅', shortLabel: 'Tasks' },
      { href: '/cockpit/agents', label: 'AI Agents', icon: '🤖', shortLabel: 'Agents' },
      { href: '/cockpit/analytics', label: 'Analytics', icon: '📈', shortLabel: 'Data' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/cockpit/health', label: 'System Health', icon: '🏥', shortLabel: 'Health' },
      { href: '/cockpit/settings', label: 'Settings', icon: '⚙️', shortLabel: 'Config' },
    ],
  },
]

// Flatten for command palette search
const NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items)

export default function CockpitShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')

  const toggleSidebar = useCallback(() => setCollapsed(c => !c), [])

  // Keyboard shortcut for command palette
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen(o => !o)
        setCommandQuery('')
      }
      if (e.key === 'Escape') setCommandOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const filteredNav = commandQuery
    ? NAV_ITEMS.filter(i => i.label.toLowerCase().includes(commandQuery.toLowerCase()))
    : NAV_ITEMS

  const sidebarWidth = collapsed ? 64 : 220

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#08224d', color: '#F5EFD8', fontFamily: 'inherit' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
          className="lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          background: 'linear-gradient(180deg, rgba(14,52,112,0.95) 0%, rgba(8,30,64,0.98) 100%)',
          borderRight: '1px solid rgba(255,204,51,0.08)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 200ms ease, min-width 200ms ease',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
          transform: mobileOpen ? 'translateX(0)' : undefined,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
        className={`sidebar-desktop ${mobileOpen ? 'sidebar-mobile-open' : ''}`}
      >
        {/* Logo */}
        <div style={{
          padding: collapsed ? '1rem 0.5rem' : '1.25rem 1rem',
          borderBottom: '1px solid rgba(255,204,51,0.06)',
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #FFCC33, #F0B400)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.85rem', fontWeight: 700, color: '#0E3470',
            flexShrink: 0,
          }}>
            RC
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: '#FFCC33', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>Command Center</div>
              <div style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>RePrime Group</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', overflowY: 'auto' }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.title}>
              {!collapsed && (
                <div style={{
                  padding: '0.6rem 0.75rem 0.2rem',
                  color: 'rgba(255,204,51,0.25)',
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}>
                  {section.title}
                </div>
              )}
              {collapsed && section.title !== 'Overview' && (
                <div style={{ height: 1, background: 'rgba(255,204,51,0.06)', margin: '0.3rem 0.5rem' }} />
              )}
              {section.items.map(item => {
                const isActive = item.href === '/cockpit'
                  ? pathname === '/cockpit'
                  : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.65rem',
                      padding: collapsed ? '0.5rem' : '0.4rem 0.75rem',
                      borderRadius: 8, textDecoration: 'none', transition: 'all 150ms',
                      background: isActive ? 'rgba(255,204,51,0.12)' : 'transparent',
                      color: isActive ? '#FFCC33' : 'rgba(255,204,51,0.55)',
                      fontSize: '0.78rem', fontWeight: isActive ? 600 : 500,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      position: 'relative',
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    {isActive && (
                      <div style={{
                        position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3,
                        background: '#FFCC33', borderRadius: '0 3px 3px 0',
                      }} />
                    )}
                    <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{item.icon}</span>
                    {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div style={{
          padding: '0.75rem', borderTop: '1px solid rgba(255,204,51,0.06)',
          display: 'flex', justifyContent: 'center',
        }}>
          <button
            onClick={toggleSidebar}
            style={{
              background: 'rgba(255,204,51,0.08)', border: 'none', color: 'rgba(255,204,51,0.5)',
              width: 32, height: 32, borderRadius: 6, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', transition: 'transform 200ms',
              transform: collapsed ? 'rotate(180deg)' : 'none',
            }}
            aria-label="Toggle sidebar"
          >
            ◀
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{
        flex: 1,
        marginLeft: sidebarWidth,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        transition: 'margin-left 200ms ease',
      }}
      className="main-content"
      >
        {/* Top Bar */}
        <header style={{
          height: 56,
          borderBottom: '1px solid rgba(255,204,51,0.06)',
          display: 'flex', alignItems: 'center', padding: '0 1.25rem',
          gap: '1rem', background: 'rgba(14,52,112,0.3)',
          position: 'sticky', top: 0, zIndex: 30,
          backdropFilter: 'blur(12px)',
        }}>
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="mobile-menu-btn"
            style={{
              display: 'none', background: 'none', border: 'none',
              color: '#FFCC33', fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem',
            }}
            aria-label="Open menu"
          >
            ☰
          </button>

          {/* Breadcrumb */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.75rem', letterSpacing: '0.04em' }}>
              {NAV_ITEMS.find(i => i.href === '/cockpit' ? pathname === '/cockpit' : pathname.startsWith(i.href))?.label || 'Dashboard'}
            </span>
          </div>

          {/* Command Palette Trigger */}
          <button
            onClick={() => { setCommandOpen(true); setCommandQuery('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 0.85rem', background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,204,51,0.1)', borderRadius: 8,
              color: 'rgba(255,204,51,0.4)', fontSize: '0.75rem', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span>🔍</span>
            <span>Search...</span>
            <kbd style={{
              padding: '0.1rem 0.35rem', background: 'rgba(255,204,51,0.08)',
              borderRadius: 4, fontSize: '0.6rem', color: 'rgba(255,204,51,0.5)',
              border: '1px solid rgba(255,204,51,0.1)', fontFamily: 'inherit',
            }}>⌘K</kbd>
          </button>

          {/* Center link */}
          <Link
            href="/center"
            style={{
              color: 'rgba(255,204,51,0.5)', fontSize: '0.7rem', textDecoration: 'none',
              padding: '0.35rem 0.6rem', borderRadius: 6,
              border: '1px solid rgba(255,204,51,0.1)',
            }}
          >
            Kiosk ↗
          </Link>
        </header>

        {/* Page Content */}
        <main style={{
          flex: 1, padding: '1.5rem', overflowY: 'auto',
          maxWidth: 1440, width: '100%', margin: '0 auto',
        }}>
          {children}
        </main>
      </div>

      {/* Command Palette Modal */}
      {commandOpen && (
        <div
          onClick={() => setCommandOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: '15vh',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 520,
              background: '#0A1F44', border: '1px solid rgba(255,204,51,0.15)',
              borderRadius: 14, overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid rgba(255,204,51,0.06)' }}>
              <input
                autoFocus
                value={commandQuery}
                onChange={e => setCommandQuery(e.target.value)}
                placeholder="Search modules, actions..."
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  color: '#fff', fontSize: '1rem', outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {filteredNav.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setCommandOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.7rem 1rem', textDecoration: 'none',
                    color: 'rgba(255,204,51,0.7)', fontSize: '0.85rem',
                    borderBottom: '1px solid rgba(255,204,51,0.03)',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,204,51,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
              {filteredNav.length === 0 && (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'rgba(255,204,51,0.3)', fontSize: '0.8rem' }}>
                  No results found
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 1024px) {
          .sidebar-desktop { transform: translateX(-100%); }
          .sidebar-mobile-open { transform: translateX(0) !important; }
          .main-content { margin-left: 0 !important; }
          .mobile-menu-btn { display: flex !important; }
        }
        @media (max-width: 640px) {
          .main-content > main { padding: 0.75rem !important; }
        }
      `}</style>
    </div>
  )
}
