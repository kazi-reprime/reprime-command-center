'use client'

import React, { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  Home, Activity, MessageSquare, Mail, Calendar, Users, Briefcase, 
  CheckSquare, FileText, Bell, Search, Plus, Mic, Settings, 
  ChevronLeft, ChevronRight, Menu, Hexagon, UserCircle
} from 'lucide-react'
import { ThreeDLogo } from '@/components/ui/ThreeDLogo'

type NavItem = { href: string; label: string; icon: React.ReactNode }
type NavSection = { title: string; items: NavItem[] }

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Core',
    items: [
      { href: '/center', label: 'Command Center', icon: <Hexagon className="w-5 h-5" /> },
      { href: '/cockpit', label: 'Dashboard', icon: <Home className="w-5 h-5" /> },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { href: '/cockpit/pipeline', label: 'Pipeline', icon: <Activity className="w-5 h-5" /> },
      { href: '/cockpit/investors', label: 'Investors', icon: <Users className="w-5 h-5" /> },
      { href: '/cockpit/properties', label: 'Properties', icon: <Briefcase className="w-5 h-5" /> },
    ],
  },
  {
    title: 'Communications',
    items: [
      { href: '/cockpit/comms', label: 'WhatsApp', icon: <MessageSquare className="w-5 h-5" /> },
      { href: '/cockpit/email', label: 'Gmail', icon: <Mail className="w-5 h-5" /> },
      { href: '/cockpit/calendar', label: 'Calendar', icon: <Calendar className="w-5 h-5" /> },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/cockpit/tasks', label: 'Tasks', icon: <CheckSquare className="w-5 h-5" /> },
      { href: '/cockpit/notes', label: 'Notes', icon: <FileText className="w-5 h-5" /> },
      { href: '/cockpit/health', label: 'System Health', icon: <Activity className="w-5 h-5" /> },
      { href: '/cockpit/settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
    ],
  },
]

const NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items)

export default function CockpitShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')

  const [dateStr, setDateStr] = useState('')
  const [greeting, setGreeting] = useState('Good Morning')

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }))
    const hour = new Date().getHours()
    setGreeting(hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening')
  }, [])

  // Keyboard shortcut for command palette
  useEffect(() => {
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

  const sidebarWidth = collapsed ? 80 : 260;

  return (
    <div className="flex min-h-screen w-full bg-background text-text-primary font-sans relative">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-surface/20 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Rail */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col glass-panel transition-all duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: sidebarWidth, borderRight: '1px solid var(--border)' }}
      >
        {/* Logo Area */}
        <div className={`flex items-center h-24 ${collapsed ? 'justify-center' : 'px-6'} shrink-0 pt-4`}>
          <div className="shrink-0 w-12 h-12 flex items-center justify-center">
            <ThreeDLogo className="scale-50 transform origin-center" />
          </div>
          {!collapsed && (
            <div className="ml-3 overflow-hidden">
              <div className="text-base font-bold tracking-tight text-text-primary whitespace-nowrap">RePrime</div>
              <div className="text-[0.65rem] font-bold tracking-widest text-text-muted uppercase">Command</div>
            </div>
          )}
        </div>

        {/* Collapse Toggle */}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-24 w-6 h-6 bg-surface border border-border rounded-full flex items-center justify-center text-text-secondary hover:text-accent shadow-sm z-50 hidden lg:flex cursor-pointer"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 flex flex-col gap-6 custom-scrollbar">
          {NAV_SECTIONS.map((section, idx) => (
            <div key={idx} className="flex flex-col gap-1">
              {!collapsed && (
                <div className="px-3 pb-2 text-[0.65rem] font-bold tracking-widest text-text-muted uppercase">
                  {section.title}
                </div>
              )}
              {collapsed && idx !== 0 && (
                <div className="h-px bg-border mx-3 my-2" />
              )}
              
              {section.items.map((item) => {
                const isActive = item.href === '/cockpit' ? pathname === '/cockpit' : pathname.startsWith(item.href)
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`relative flex items-center h-10 rounded-xl transition-all duration-200 group ${
                      collapsed ? 'justify-center w-10 mx-auto' : 'px-3'
                    } ${
                      isActive 
                        ? 'bg-accent/10 text-accent font-semibold' 
                        : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary font-medium'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-accent rounded-r-md" />
                    )}
                    <div className={`${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'} transition-opacity`}>
                      {item.icon}
                    </div>
                    {!collapsed && <span className="ml-3 whitespace-nowrap text-sm">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-border shrink-0">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-9 h-9 rounded-full bg-surface-raised flex items-center justify-center text-text-secondary shrink-0">
              <UserCircle className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <div className="text-sm font-semibold text-text-primary truncate">Gideon Prime</div>
                <div className="text-xs font-medium text-text-muted truncate">Administrator</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div 
        className="flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out w-full"
      >
        {/* Top Executive Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-20 px-4 lg:px-8 glass-panel border-b border-border" style={{ marginLeft: sidebarWidth }}>
          
          {/* Left section: Mobile menu & Greeting */}
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-text-secondary hover:text-text-primary"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-text-primary">{greeting}, Gideon.</h1>
              <p className="text-xs font-medium text-text-muted">{dateStr} • APEX Priority: Normal</p>
            </div>
          </div>

          {/* Right section: Search, Actions, Nora */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setCommandOpen(true); setCommandQuery('') }}
              className="hidden md:flex items-center gap-3 h-10 px-4 bg-surface-raised hover:bg-surface-hover rounded-full text-text-secondary text-sm font-medium transition-colors border border-transparent hover:border-border-strong"
            >
              <Search className="w-4 h-4" />
              <span>Command Palette...</span>
              <kbd className="hidden lg:inline-flex items-center h-5 px-1.5 bg-surface rounded border border-border text-[10px] font-semibold text-text-muted">⌘K</kbd>
            </button>

            <button
              onClick={() => router.push('/cockpit/inbox')}
              className="w-10 h-10 rounded-full bg-surface-raised hover:bg-surface-hover flex items-center justify-center text-text-secondary transition-colors relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-surface" />
            </button>

            <button
              onClick={() => { setCommandOpen(true); setCommandQuery(''); }}
              className="h-10 px-4 rounded-full bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
              title="New Action"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Action</span>
            </button>

            <button
              onClick={() => window.open('/center', '_blank')}
              className="w-10 h-10 rounded-full bg-surface-raised hover:bg-surface-hover border border-border flex items-center justify-center text-accent transition-all shadow-sm group cursor-pointer"
              title="Voice Command Center"
            >
              <Mic className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </header>

        {/* Page Content Container */}
        {/* We use flex-1 and no overflow restrictions to let the body scroll naturally, fixing scroll traps */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 lg:p-8" style={{ marginLeft: sidebarWidth }}>
          <div>
            {children}
          </div>
        </main>
      </div>

      {/* Command Palette Modal */}
      {commandOpen && (
        <div
          onClick={() => setCommandOpen(false)}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-surface/20 backdrop-blur-md"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-[90%] max-w-2xl bg-surface/90 backdrop-blur-xl border border-border rounded-3xl overflow-hidden shadow-[0_32px_64px_-12px_rgba(15,23,42,0.15)] animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
              <Search className="w-5 h-5 text-accent" />
              <input
                autoFocus
                value={commandQuery}
                onChange={e => setCommandQuery(e.target.value)}
                placeholder="Where to, Gideon?"
                className="flex-1 bg-transparent border-none text-lg font-semibold text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
              {filteredNav.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setCommandOpen(false)}
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-surface-hover text-text-secondary hover:text-accent transition-colors group"
                >
                  <div className="p-2 rounded-xl bg-surface-raised group-hover:bg-surface shadow-sm transition-colors">
                    {item.icon}
                  </div>
                  <span className="font-semibold text-text-primary">{item.label}</span>
                  <span className="ml-auto text-[10px] font-bold tracking-widest text-text-muted group-hover:text-accent uppercase">Return to open</span>
                </Link>
              ))}
              {filteredNav.length === 0 && (
                <div className="py-12 text-center text-text-muted">
                  <Search className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-sm">No matching commands found.</p>
                </div>
              )}
            </div>
            
            <div className="px-6 py-3 bg-surface-raised border-t border-border flex items-center justify-between text-[10px] font-bold tracking-widest text-text-muted uppercase">
              <div className="flex gap-4">
                <span>ESC to close</span>
                <span>Enter to select</span>
              </div>
              <span className="text-accent">RePrime OS</span>
            </div>
          </div>
        </div>
      )}

      {/* Responsive Styles Injection */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(15, 23, 42, 0.2); }
        
        @media (max-width: 1024px) {
          header, main { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  )
}
