'use client'

import React from 'react'

// ─── Status Badge ─────────────────────────────────────────────────────────────

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'rgba(0, 169, 128, 0.15)', text: '#00A980', dot: '#00A980' },
  running: { bg: 'rgba(0, 169, 128, 0.15)', text: '#00A980', dot: '#00A980' },
  completed: { bg: 'rgba(0, 169, 128, 0.15)', text: '#00A980', dot: '#00A980' },
  done: { bg: 'rgba(0, 169, 128, 0.15)', text: '#00A980', dot: '#00A980' },
  won: { bg: 'rgba(0, 169, 128, 0.15)', text: '#00A980', dot: '#00A980' },
  paid: { bg: 'rgba(0, 169, 128, 0.15)', text: '#00A980', dot: '#00A980' },
  in_progress: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', dot: '#3B82F6' },
  onboarding: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', dot: '#3B82F6' },
  planning: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', dot: '#3B82F6' },
  configuring: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', dot: '#3B82F6' },
  paused: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', dot: '#F59E0B' },
  pending: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', dot: '#F59E0B' },
  todo: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', dot: '#F59E0B' },
  review: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', dot: '#F59E0B' },
  on_hold: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', dot: '#F59E0B' },
  idle: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', dot: '#94A3B8' },
  draft: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', dot: '#94A3B8' },
  new: { bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7', dot: '#A855F7' },
  error: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', dot: '#EF4444' },
  blocked: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', dot: '#EF4444' },
  lost: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', dot: '#EF4444' },
  overdue: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', dot: '#EF4444' },
  churned: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', dot: '#EF4444' },
  not_configured: { bg: 'rgba(107, 114, 128, 0.15)', text: '#6B7280', dot: '#6B7280' },
}

export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const colors = statusColors[status] || statusColors['idle']
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const px = size === 'md' ? '0.6rem 0.85rem' : '0.3rem 0.6rem'
  const fs = size === 'md' ? '0.75rem' : '0.65rem'

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      padding: px, borderRadius: 999, background: colors.bg,
      color: colors.text, fontSize: fs, fontWeight: 600,
      letterSpacing: '0.03em', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.dot }} />
      {label}
    </span>
  )
}

// ─── Priority Badge ───────────────────────────────────────────────────────────

const priorityConfig: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Critical', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  2: { label: 'High', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  3: { label: 'Medium', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  4: { label: 'Low', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
  5: { label: 'Minimal', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
}

export function PriorityBadge({ priority }: { priority: number }) {
  const cfg = priorityConfig[priority] || priorityConfig[3]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.3rem 0.6rem', borderRadius: 999, background: cfg.bg,
      color: cfg.color, fontSize: '0.65rem', fontWeight: 600,
      letterSpacing: '0.03em',
    }}>
      {cfg.label}
    </span>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

export function StatCard({ label, value, change, changeLabel, icon, color = '#FFCC33' }: {
  label: string; value: string | number; change?: number; changeLabel?: string;
  icon?: React.ReactNode; color?: string;
}) {
  return (
    <div style={{
      background: 'rgba(14, 52, 112, 0.5)',
      border: '1px solid rgba(255, 204, 51, 0.1)',
      borderRadius: 12, padding: '1.25rem',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'rgba(255,204,51,0.6)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
        {icon && <span style={{ color, opacity: 0.7, fontSize: '1.1rem' }}>{icon}</span>}
      </div>
      <span style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
      {(change !== undefined || changeLabel) && (
        <span style={{ fontSize: '0.7rem', color: change && change > 0 ? '#00A980' : change && change < 0 ? '#EF4444' : '#94A3B8' }}>
          {change !== undefined && (change > 0 ? '↑' : change < 0 ? '↓' : '→')} {changeLabel || `${Math.abs(change || 0)}% vs last month`}
        </span>
      )}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, title, action, noPad, style }: {
  children: React.ReactNode; title?: string; action?: React.ReactNode;
  noPad?: boolean; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: 'rgba(14, 52, 112, 0.4)',
      border: '1px solid rgba(255, 204, 51, 0.08)',
      borderRadius: 12, overflow: 'hidden', ...style,
    }}>
      {title && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,204,51,0.06)',
        }}>
          <h3 style={{ margin: 0, color: '#FFCC33', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</h3>
          {action}
        </div>
      )}
      <div style={noPad ? {} : { padding: '1.25rem' }}>{children}</div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, description, action }: {
  icon?: string; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '3rem 1.5rem', textAlign: 'center', minHeight: 200,
    }}>
      {icon && <span style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.5 }}>{icon}</span>}
      <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
      {description && <p style={{ margin: '0.5rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem', maxWidth: 320, lineHeight: 1.5 }}>{description}</p>}
      {action && <div style={{ marginTop: '1rem' }}>{action}</div>}
    </div>
  )
}

// ─── Loading State ────────────────────────────────────────────────────────────

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '3rem', minHeight: 200,
    }}>
      <div style={{
        width: 32, height: 32, border: '3px solid rgba(255,204,51,0.2)',
        borderTopColor: '#FFCC33', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ color: 'rgba(255,204,51,0.6)', fontSize: '0.8rem', marginTop: '0.75rem' }}>{message}</span>
    </div>
  )
}

// ─── Error State ──────────────────────────────────────────────────────────────

export function ErrorState({ message = 'Something went wrong', onRetry }: {
  message?: string; onRetry?: () => void;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '3rem', minHeight: 200,
    }}>
      <span style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</span>
      <span style={{ color: '#EF4444', fontSize: '0.85rem', fontWeight: 500 }}>{message}</span>
      {onRetry && (
        <button onClick={onRetry} style={{
          marginTop: '1rem', padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.15)',
          color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6,
          fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600,
        }}>Retry</button>
      )}
    </div>
  )
}

// ─── Setup Required State ─────────────────────────────────────────────────────

export function SetupRequiredState({ service, description }: {
  service: string; description?: string;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', minHeight: 180, textAlign: 'center',
    }}>
      <span style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔧</span>
      <span style={{ color: '#F59E0B', fontSize: '0.85rem', fontWeight: 600 }}>{service} — Setup Required</span>
      {description && <p style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.75rem', marginTop: '0.5rem', maxWidth: 280, lineHeight: 1.5 }}>{description}</p>}
      <span style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.65rem', marginTop: '0.75rem' }}>Configure in Settings → Integrations</span>
    </div>
  )
}

// ─── Action Button ────────────────────────────────────────────────────────────

export function ActionButton({ label, icon, onClick, variant = 'default', size = 'sm', disabled }: {
  label: string; icon?: string; onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'ghost'; size?: 'sm' | 'md'; disabled?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: 'rgba(255,204,51,0.1)', color: '#FFCC33', border: '1px solid rgba(255,204,51,0.2)' },
    primary: { background: '#FFCC33', color: '#0E3470', border: '1px solid #FFCC33' },
    danger: { background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' },
    ghost: { background: 'transparent', color: 'rgba(255,204,51,0.7)', border: '1px solid transparent' },
  }
  const pad = size === 'md' ? '0.6rem 1.2rem' : '0.4rem 0.8rem'
  const fs = size === 'md' ? '0.8rem' : '0.7rem'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        padding: pad, borderRadius: 6, fontSize: fs, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex',
        alignItems: 'center', gap: '0.35rem', letterSpacing: '0.03em',
        opacity: disabled ? 0.4 : 1, transition: 'all 150ms ease',
        fontFamily: 'inherit',
      }}
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
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={{
                textAlign: 'left', padding: '0.75rem 0.6rem',
                color: 'rgba(255,204,51,0.5)', fontWeight: 600, fontSize: '0.65rem',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                borderBottom: '1px solid rgba(255,204,51,0.08)',
                width: col.width,
              }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              style={{
                cursor: onRowClick ? 'pointer' : 'default',
                borderBottom: '1px solid rgba(255,204,51,0.04)',
                transition: 'background 100ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,204,51,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {columns.map(col => (
                <td key={col.key} style={{ padding: '0.7rem 0.6rem', color: '#e2e8f0' }}>
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
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,204,51,0.4)', fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.2rem',
          background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,204,51,0.12)',
          borderRadius: 8, color: '#fff', fontSize: '0.8rem',
          outline: 'none', fontFamily: 'inherit',
        }}
      />
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

export function ProgressBar({ value, max = 100, color = '#FFCC33', height = 6 }: {
  value: number; max?: number; color?: string; height?: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div style={{ width: '100%', height, background: 'rgba(255,255,255,0.08)', borderRadius: height, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: height, transition: 'width 300ms ease' }} />
    </div>
  )
}

// ─── Tab Group ────────────────────────────────────────────────────────────────

export function TabGroup({ tabs, active, onChange }: {
  tabs: { key: string; label: string; count?: number }[];
  active: string; onChange: (key: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: '0.2rem' }}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            padding: '0.45rem 0.85rem', borderRadius: 6, fontSize: '0.75rem',
            fontWeight: 600, border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', letterSpacing: '0.02em', transition: 'all 150ms',
            background: active === tab.key ? 'rgba(255,204,51,0.15)' : 'transparent',
            color: active === tab.key ? '#FFCC33' : 'rgba(255,204,51,0.5)',
          }}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span style={{
              marginLeft: '0.4rem', padding: '0.1rem 0.4rem', borderRadius: 999,
              background: active === tab.key ? 'rgba(255,204,51,0.2)' : 'rgba(255,255,255,0.06)',
              fontSize: '0.6rem',
            }}>{tab.count}</span>
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
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: width, maxHeight: '85vh',
          background: '#0A1F44', border: '1px solid rgba(255,204,51,0.15)',
          borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,204,51,0.08)',
        }}>
          <h2 style={{ margin: 0, color: '#FFCC33', fontSize: '1rem', fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'rgba(255,204,51,0.5)',
            fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem',
          }}>✕</button>
        </div>
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>{children}</div>
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
    <div style={{ marginBottom: '1rem' }}>
      <label style={{
        display: 'block', color: 'rgba(255,204,51,0.7)', fontSize: '0.7rem',
        fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
        marginBottom: '0.35rem',
      }}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%', padding: '0.65rem 0.85rem',
          background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,204,51,0.12)',
          borderRadius: 6, color: '#fff', fontSize: '0.85rem',
          outline: 'none', fontFamily: 'inherit',
        }}
      />
    </div>
  )
}

export function FormSelect({ label, value, onChange, options, required }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{
        display: 'block', color: 'rgba(255,204,51,0.7)', fontSize: '0.7rem',
        fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
        marginBottom: '0.35rem',
      }}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        style={{
          width: '100%', padding: '0.65rem 0.85rem',
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,204,51,0.12)',
          borderRadius: 6, color: '#fff', fontSize: '0.85rem',
          outline: 'none', fontFamily: 'inherit',
        }}
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
    <div style={{ marginBottom: '1rem' }}>
      <label style={{
        display: 'block', color: 'rgba(255,204,51,0.7)', fontSize: '0.7rem',
        fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
        marginBottom: '0.35rem',
      }}>{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%', padding: '0.65rem 0.85rem',
          background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,204,51,0.12)',
          borderRadius: 6, color: '#fff', fontSize: '0.85rem',
          outline: 'none', fontFamily: 'inherit', resize: 'vertical',
        }}
      />
    </div>
  )
}
