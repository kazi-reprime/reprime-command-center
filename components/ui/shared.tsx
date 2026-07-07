'use client'

import React from 'react'

// ─── Status Badge ─────────────────────────────────────────────────────────────

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-success/15', text: 'text-success', dot: 'bg-success' },
  running: { bg: 'bg-success/15', text: 'text-success', dot: 'bg-success' },
  completed: { bg: 'bg-success/15', text: 'text-success', dot: 'bg-success' },
  done: { bg: 'bg-success/15', text: 'text-success', dot: 'bg-success' },
  won: { bg: 'bg-success/15', text: 'text-success', dot: 'bg-success' },
  paid: { bg: 'bg-success/15', text: 'text-success', dot: 'bg-success' },
  in_progress: { bg: 'bg-info/15', text: 'text-info', dot: 'bg-info' },
  onboarding: { bg: 'bg-info/15', text: 'text-info', dot: 'bg-info' },
  planning: { bg: 'bg-info/15', text: 'text-info', dot: 'bg-info' },
  configuring: { bg: 'bg-info/15', text: 'text-info', dot: 'bg-info' },
  paused: { bg: 'bg-warning/15', text: 'text-warning', dot: 'bg-warning' },
  pending: { bg: 'bg-warning/15', text: 'text-warning', dot: 'bg-warning' },
  todo: { bg: 'bg-warning/15', text: 'text-warning', dot: 'bg-warning' },
  review: { bg: 'bg-warning/15', text: 'text-warning', dot: 'bg-warning' },
  on_hold: { bg: 'bg-warning/15', text: 'text-warning', dot: 'bg-warning' },
  idle: { bg: 'bg-text-muted/15', text: 'text-text-muted', dot: 'bg-text-muted' },
  draft: { bg: 'bg-text-muted/15', text: 'text-text-muted', dot: 'bg-text-muted' },
  new: { bg: 'bg-accent/15', text: 'text-accent', dot: 'bg-accent' },
  error: { bg: 'bg-error/15', text: 'text-error', dot: 'bg-error' },
  blocked: { bg: 'bg-error/15', text: 'text-error', dot: 'bg-error' },
  lost: { bg: 'bg-error/15', text: 'text-error', dot: 'bg-error' },
  overdue: { bg: 'bg-error/15', text: 'text-error', dot: 'bg-error' },
  churned: { bg: 'bg-error/15', text: 'text-error', dot: 'bg-error' },
  not_configured: { bg: 'bg-text-muted/15', text: 'text-text-muted', dot: 'bg-text-muted' },
}

export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const colors = statusColors[status] || statusColors['idle']
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const px = size === 'md' ? 'px-3 py-1.5' : 'px-2 py-1'
  const fs = size === 'md' ? 'text-xs' : 'text-[0.65rem]'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide whitespace-nowrap ${colors.bg} ${colors.text} ${px} ${fs}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {label}
    </span>
  )
}

// ─── Priority Badge ───────────────────────────────────────────────────────────

const priorityConfig: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Critical', color: 'text-error', bg: 'bg-error/15' },
  2: { label: 'High', color: 'text-warning', bg: 'bg-warning/15' },
  3: { label: 'Medium', color: 'text-info', bg: 'bg-info/15' },
  4: { label: 'Low', color: 'text-text-muted', bg: 'bg-text-muted/15' },
  5: { label: 'Minimal', color: 'text-text-muted', bg: 'bg-text-muted/15' },
}

export function PriorityBadge({ priority }: { priority: number }) {
  const cfg = priorityConfig[priority] || priorityConfig[3]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-semibold text-[0.65rem] tracking-wide ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

export function StatCard({ label, value, change, changeLabel, icon, color = 'var(--accent)' }: {
  label: string; value: string | number; change?: number; changeLabel?: string;
  icon?: React.ReactNode; color?: string;
}) {
  return (
    <div className="glass-card flex flex-col gap-2.5 p-5 rounded-2xl min-w-0 relative overflow-hidden group">
      {/* Ambient glow orb */}
      <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full blur-3xl opacity-40 group-hover:opacity-60 group-hover:scale-125 transition-all duration-700" style={{ background: color }} />
      <div className="absolute -left-8 -bottom-8 w-24 h-24 rounded-full blur-3xl opacity-10" style={{ background: color }} />
      <div className="flex justify-between items-center relative z-10">
        <span className="text-text-secondary text-[0.65rem] font-bold uppercase tracking-[0.15em]">{label}</span>
        {icon && (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-sm" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
            {icon}
          </div>
        )}
      </div>
      <span className="text-text-primary text-3xl font-black tracking-tight mt-1 relative z-10">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {(change !== undefined || changeLabel) && (
        <span className={`text-xs font-semibold relative z-10 flex items-center gap-1.5 mt-1 ${change && change > 0 ? 'text-success' : change && change < 0 ? 'text-error' : 'text-text-secondary'}`}>
          <span className={`px-2 py-0.5 rounded-lg text-[0.65rem] font-bold ${change && change > 0 ? 'bg-success/10' : change && change < 0 ? 'bg-error/10' : 'bg-surface-raised'}`}>
            {change !== undefined && (change > 0 ? '↑' : change < 0 ? '↓' : '→')} {Math.abs(change || 0)}%
          </span>
          <span className="text-text-muted font-medium">{changeLabel || 'vs last month'}</span>
        </span>
      )}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, title, action, noPad, style, className }: {
  children: React.ReactNode; title?: string; action?: React.ReactNode;
  noPad?: boolean; style?: React.CSSProperties; className?: string;
}) {
  return (
    <div className={`glass-card rounded-2xl overflow-hidden flex flex-col ${className || ''}`} style={style}>
      {title && (
        <div className="relative flex justify-between items-center px-6 py-4 border-b border-border/60">
          {/* Gradient accent line at top */}
          <div className="absolute top-0 left-6 right-6 h-[2px] rounded-full" style={{ background: 'var(--gradient-primary)', opacity: 0.5 }} />
          <h3 className="m-0 text-text-primary text-[0.8rem] font-bold uppercase tracking-[0.12em]">{title}</h3>
          {action}
        </div>
      )}
      <div className={`${noPad ? '' : 'p-6'} flex-1`}>{children}</div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, description, action }: {
  icon?: string; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center min-h-[200px]">
      {icon && (
        <div className="w-16 h-16 mb-4 rounded-2xl bg-surface-raised border border-border flex items-center justify-center text-3xl shadow-sm opacity-80">
          {icon}
        </div>
      )}
      <h3 className="m-0 text-text-primary text-base font-bold">{title}</h3>
      {description && <p className="mt-2 text-text-secondary text-sm max-w-[320px] leading-relaxed">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

// ─── Loading State ────────────────────────────────────────────────────────────

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[200px]">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-[3px] border-accent/10" />
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-accent animate-spin" style={{ animationDuration: '0.8s' }} />
        <div className="absolute inset-1 rounded-full border-[2px] border-transparent border-b-accent/40 animate-spin" style={{ animationDuration: '1.2s', animationDirection: 'reverse' }} />
      </div>
      <span className="text-text-secondary text-sm mt-4 font-medium tracking-wide">{message}</span>
    </div>
  )
}

// ─── Error State ──────────────────────────────────────────────────────────────

export function ErrorState({ message = 'Something went wrong', onRetry }: {
  message?: string; onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[200px]">
      <span className="text-3xl mb-3">⚠️</span>
      <span className="text-error text-sm font-medium">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 px-4 py-2 bg-error/10 text-error border border-error/30 rounded-md text-xs font-semibold cursor-pointer hover:bg-error/20 transition-colors">
          Retry
        </button>
      )}
    </div>
  )
}

// ─── Setup Required State ─────────────────────────────────────────────────────

export function SetupRequiredState({ service, description }: {
  service: string; description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[180px] text-center">
      <span className="text-3xl mb-3">🔧</span>
      <span className="text-warning text-sm font-semibold">{service} — Setup Required</span>
      {description && <p className="text-warning/70 text-xs mt-2 max-w-[280px] leading-relaxed">{description}</p>}
      <span className="text-warning/50 text-[10px] mt-3">Configure in Settings → Integrations</span>
    </div>
  )
}

// ─── Action Button ────────────────────────────────────────────────────────────

export function ActionButton({ label, icon, onClick, variant = 'default', size = 'sm', disabled }: {
  label: string; icon?: string; onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'ghost'; size?: 'sm' | 'md'; disabled?: boolean;
}) {
  const styles: Record<string, string> = {
    default: 'btn-glass text-accent border-accent/20 hover:border-accent',
    primary: 'btn-primary',
    danger: 'bg-error/10 text-error border border-error/20 hover:bg-error/20 hover:shadow-[0_0_16px_var(--error-glow)]',
    ghost: 'btn-ghost',
  }
  const pad = size === 'md' ? 'px-5 py-2.5 text-sm' : 'px-3.5 py-2 text-xs'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl font-semibold tracking-wide transition-all ${pad} ${styles[variant]} ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
    >
      {icon && <span>{icon}</span>}
      {label}
    </button>
  )
}

// ─── Data Table ───────────────────────────────────────────────────────────────

export function DataTable<T extends Record<string, unknown>>({ data, columns, onRowClick, emptyMessage = 'No data' }: {
  data: T[];
  columns: { key: string; label: string; render?: (row: T) => React.ReactNode; width?: string }[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  if (!data.length) {
    return <EmptyState icon="📋" title={emptyMessage} />
  }
  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={{ width: col.width }} className="text-left p-3 text-text-muted font-semibold text-[0.65rem] tracking-wider uppercase border-b border-border">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-border/40 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-surface-hover' : ''}`}
            >
              {columns.map(col => (
                <td key={col.key} className="p-3 text-text-primary">
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Search Input ─────────────────────────────────────────────────────────────

export function SearchInput({ value, onChange, placeholder = 'Search...' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">🔍</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 bg-surface-raised border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus transition-all placeholder-text-muted"
      />
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

export function ProgressBar({ value, max = 100, color, height = 6 }: {
  value: number; max?: number; color?: string; height?: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="w-full bg-border overflow-hidden" style={{ height, borderRadius: height }}>
      <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, background: color || 'var(--accent)', borderRadius: height }} />
    </div>
  )
}

// ─── Tab Group ────────────────────────────────────────────────────────────────

export function TabGroup({ tabs, active, onChange }: {
  tabs: { key: string; label: string; count?: number }[];
  active: string; onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 bg-surface-raised border border-border rounded-lg p-1">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
            active === tab.key
              ? 'bg-surface text-accent shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[0.6rem] ${
              active === tab.key ? 'bg-accent/10 text-accent' : 'bg-border text-text-muted'
            }`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function Modal({ isOpen, onClose, title, children, width = 560 }: {
  isOpen: boolean; onClose: () => void; title: string;
  children: React.ReactNode; width?: number;
}) {
  if (!isOpen) return null
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-background/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full glass-card-elevated rounded-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95"
        style={{ maxWidth: width }}
      >
        <div className="relative flex justify-between items-center px-6 py-4 border-b border-border/60">
          <div className="absolute top-0 left-6 right-6 h-[2px] rounded-full" style={{ background: 'var(--gradient-primary)', opacity: 0.6 }} />
          <h2 className="m-0 text-text-primary text-base font-bold tracking-wide">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-surface-raised/60 border border-border/40 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-error/10 hover:border-error/20 hover:text-error transition-all cursor-pointer text-sm">
            ✕
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

// ─── Form Input ───────────────────────────────────────────────────────────────

export function FormInput({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="mb-4">
      <label className="block text-text-secondary text-xs font-semibold tracking-wider uppercase mb-1.5">
        {label} {required && <span className="text-error">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 bg-surface border border-border rounded-md text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus transition-all placeholder-text-muted"
      />
    </div>
  )
}

export function FormSelect({ label, value, onChange, options, required }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div className="mb-4">
      <label className="block text-text-secondary text-xs font-semibold tracking-wider uppercase mb-1.5">
        {label} {required && <span className="text-error">*</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 bg-surface border border-border rounded-md text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus transition-all"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function FormTextarea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <div className="mb-4">
      <label className="block text-text-secondary text-xs font-semibold tracking-wider uppercase mb-1.5">
        {label}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 bg-surface border border-border rounded-md text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus transition-all placeholder-text-muted resize-y"
      />
    </div>
  )
}
