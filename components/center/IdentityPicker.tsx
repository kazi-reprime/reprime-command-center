'use client'

import { useEffect, useRef, useState } from 'react'
import {
  IDENTITIES,
  type Identity,
  getIdentityByEmail,
  setActiveIdentity,
  useActiveIdentity,
} from '@/lib/identity'

/**
 * IdentityPicker — Wave 1 / Track F
 *
 * Persistent picker that lives in the TopStrip's IdentityPickerSlot
 * (mounted post-merge). Shows the full roster (Gideon + 5 team members);
 * only Gideon is selectable as send-as in v1. The other five appear with
 * a lock badge and tooltip "Send-as locked to Gideon in v1".
 *
 * Width is sized for the ~280px slot on the kiosk top strip.
 */

const SLOT_WIDTH = 280

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function IdentityRow({
  identity,
  active,
  selectable,
  onClick,
}: {
  identity: Identity
  active: boolean
  selectable: boolean
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  const isGideon = identity.email === 'g@reprime.com'

  const bg = active
    ? 'rgba(255, 204, 51, 0.12)'
    : hover && selectable
    ? 'rgba(255, 204, 51, 0.06)'
    : 'transparent'

  const borderLeft = active
    ? '3px solid var(--rp-gold)'
    : '3px solid transparent'

  return (
    <button
      type="button"
      onClick={selectable ? onClick : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={
        selectable
          ? `Switch to ${identity.displayName}`
          : 'Send-as locked to Gideon in v1'
      }
      aria-label={
        selectable
          ? `Switch active identity to ${identity.displayName}`
          : `${identity.displayName} (view-only — send-as locked in v1)`
      }
      aria-disabled={!selectable}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 12px',
        background: bg,
        borderLeft,
        border: 'none',
        borderTop: '1px solid rgba(255, 204, 51, 0.10)',
        textAlign: 'left',
        cursor: selectable ? 'pointer' : 'not-allowed',
        opacity: selectable ? 1 : 0.55,
        font: 'inherit',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: isGideon ? 'var(--rp-gold)' : 'rgba(255, 204, 51, 0.18)',
          color: isGideon ? 'var(--rp-navy)' : '#F5EFD8',
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {initials(identity.displayName)}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#F5EFD8',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {identity.displayName}
        </span>
        <span
          style={{
            fontSize: 10,
            color: '#8C8771',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {identity.role}
        </span>
      </span>
      {!selectable && (
        <span
          aria-label="View-only"
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#8C8771',
            background: 'rgba(140, 135, 113, 0.18)',
            padding: '3px 6px',
            borderRadius: 3,
            flexShrink: 0,
          }}
        >
          {/* Padlock glyph + label. Visual lock badge per Track F spec. */}
          <span aria-hidden="true" style={{ marginRight: 4 }}>
            &#x1F512;
          </span>
          View
        </span>
      )}
    </button>
  )
}

export function IdentityPicker() {
  const activeEmail = useActiveIdentity()
  const active = getIdentityByEmail(activeEmail)
  const others = IDENTITIES.filter((i) => i.email !== active.email)

  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handlePick = (email: string) => {
    setActiveIdentity(email)
    setOpen(false)
  }

  const isGideon = active.email === 'g@reprime.com'

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: SLOT_WIDTH,
        fontFamily: 'var(--rp-font-body)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Active identity: ${active.displayName}. Click to switch.`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '4px 10px',
          height: 28,
          background: 'rgba(14, 52, 112, 0.85)',
          border: `1px solid ${isGideon ? 'var(--rp-gold)' : 'var(--rp-border)'}`,
          borderRadius: 4,
          color: '#F5EFD8',
          font: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: isGideon ? 'var(--rp-gold)' : 'rgba(255, 204, 51, 0.18)',
            color: isGideon ? 'var(--rp-navy)' : '#F5EFD8',
            fontSize: 9,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials(active.displayName)}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: isGideon ? 'var(--rp-gold)' : '#F5EFD8',
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {active.displayName}
        </span>
        <span
          aria-hidden="true"
          style={{ fontSize: 10, color: '#8C8771', flexShrink: 0 }}
        >
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Identity picker"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: SLOT_WIDTH,
            background: 'var(--rp-navy)',
            border: '1px solid var(--rp-border)',
            borderRadius: 4,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.40)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          {/* Active row at top */}
          <IdentityRow
            identity={active}
            active
            selectable={active.sendAsAllowed}
            onClick={() => handlePick(active.email)}
          />
          {/* Locked rows below */}
          {others.map((id) => (
            <IdentityRow
              key={id.email}
              identity={id}
              active={false}
              selectable={id.sendAsAllowed}
              onClick={() => handlePick(id.email)}
            />
          ))}
          <div
            style={{
              padding: '8px 12px',
              borderTop: '1px solid rgba(255, 204, 51, 0.10)',
              fontSize: 10,
              color: '#8C8771',
              lineHeight: 1.4,
            }}
          >
            v1 send-as locked to Gideon. Team identities expand in v2.
          </div>
        </div>
      )}
    </div>
  )
}

export default IdentityPicker
