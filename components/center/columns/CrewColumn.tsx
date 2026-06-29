'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { CrewMemberRow } from '@/app/api/crew/route'

const REFETCH_MS = 60_000

interface CrewListResponse {
  crew: CrewMemberRow[]
}

// Stable per-email avatar tint, drawn from the meaning-based palette so the
// Crew column reuses the same color vocabulary as the rest of the kiosk.
const AVATAR_TINTS = [
  'var(--rp-gold)',         // Gideon — principal / brand
  'var(--c-channel-718)',   // green — team OK
  'var(--c-channel-305)',   // amber — RePrime business
  'var(--c-investor)',      // gold — investor-side
  'var(--c-live-now)',      // violet — live / motion
  'var(--c-warn)',          // amber-orange — heads-up
] as const

function tintFor(email: string, isPrincipal: boolean, investorSide: boolean): string {
  if (isPrincipal) return 'var(--rp-gold)'
  if (investorSide) return 'var(--c-investor)'
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % AVATAR_TINTS.length
  return AVATAR_TINTS[idx]
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function toLocalInputValue(date: Date): string {
  // datetime-local format: YYYY-MM-DDTHH:mm in *local* time
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

// ── Visual primitives ────────────────────────────────────────────────────────

const rowBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  background: 'var(--rp-surface)',
  border: '1px solid var(--rp-border)',
  borderRadius: 8,
  marginBottom: 8,
  cursor: 'pointer',
  fontSize: 14,
  color: 'var(--rp-white)',
  transition: 'border-color 120ms ease',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(14, 52, 112, 0.55)',
  border: '1px solid var(--rp-border)',
  color: 'var(--rp-white)',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--rp-gold-lite)',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  marginBottom: 4,
}

// ── Hook: column count for the kiosk header badge ───────────────────────────

/**
 * useColumnCount — exposes the active crew count for the kiosk header
 * badge ("Crew (6)"). Reuses the same React Query key as CrewColumn.
 */
export function useColumnCount(): number {
  const crewQuery = useQuery({
    queryKey: ['crew', 'active'],
    queryFn: async (): Promise<CrewMemberRow[]> => {
      const res = await fetch('/api/crew', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as CrewListResponse
      return json.crew
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })
  return crewQuery.data?.length ?? 0
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * CrewColumn — Track D / Wave 2.
 *
 * Lists active crew (principal first, then alphabetical) and lets Gideon
 * delegate a bucket item with one big primary action per row. Counts of
 * open bucket items per assignee live-update via Supabase Realtime.
 *
 * Roster lock 2026-05-05 — the migration owns the seed; this component
 * never writes to crew_members. Adir Yonasi is investor-side only and is
 * surfaced with a permanent tag to keep him off broker-facing delegations.
 *
 * Click badge → emits `center:scroll-to-bucket` window event so the
 * BucketColumn (Track B) can scroll to that assignee's slice.
 */
export default function CrewColumn() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  const crewQuery = useQuery({
    queryKey: ['crew', 'active'],
    queryFn: async (): Promise<CrewMemberRow[]> => {
      const res = await fetch('/api/crew', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as CrewListResponse
      return json.crew
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })

  const emails = useMemo(
    () => (crewQuery.data ?? []).map((c) => c.email),
    [crewQuery.data]
  )

  const countsQuery = useQuery({
    queryKey: ['crew', 'open-counts', emails.join(',')],
    enabled: emails.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bucket_items')
        .select('assigned_to')
        .eq('status', 'open')
        .in('assigned_to', emails)
      if (error) throw new Error(error.message)
      const counts: Record<string, number> = {}
      for (const row of (data ?? []) as { assigned_to: string | null }[]) {
        const key = row.assigned_to
        if (!key) continue
        counts[key] = (counts[key] ?? 0) + 1
      }
      return counts
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })

  const counts = countsQuery.data ?? {}

  // Realtime — re-fetch counts when bucket_items changes for any roster email.
  useEffect(() => {
    if (emails.length === 0) return
    const filter = `assigned_to=in.(${emails.join(',')})`
    const channel = supabase
      .channel(`crew_bucket_counts:${emails.join(',')}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bucket_items', filter },
        () => {
          queryClient.invalidateQueries({ queryKey: ['crew', 'open-counts'] })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [emails, supabase, queryClient])

  return (
    <div data-component="crew-column" style={{ paddingBottom: 8 }}>
      {crewQuery.isLoading && (
        <div style={{ color: 'var(--rp-gold-lite)', fontSize: 13 }}>Loading crew…</div>
      )}
      {crewQuery.isError && (
        <div style={{ color: 'var(--c-fail)', fontSize: 13 }}>
          Crew failed: {(crewQuery.error as Error).message}
        </div>
      )}
      {!crewQuery.isLoading && !crewQuery.isError && (crewQuery.data ?? []).length === 0 && (
        <div style={{ color: 'var(--rp-gold-lite)', fontSize: 13 }}>No active crew</div>
      )}
      {(crewQuery.data ?? []).map((member) => (
        <CrewRow
          key={member.email}
          member={member}
          openCount={counts[member.email] ?? 0}
          onDelegated={() => {
            queryClient.invalidateQueries({ queryKey: ['crew', 'open-counts'] })
          }}
        />
      ))}
    </div>
  )
}

// ── Row ──────────────────────────────────────────────────────────────────────

function CrewRow({
  member,
  openCount,
  onDelegated,
}: {
  member: CrewMemberRow
  openCount: number
  onDelegated: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const tint = tintFor(member.email, member.is_principal, member.is_investor_side_only)
  const initials = initialsFor(member.display_name)

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
        style={{
          ...rowBase,
          borderColor: expanded ? tint : 'var(--rp-border)',
        }}
      >
        <div
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(14, 52, 112, 0.85)',
            border: `2px solid ${tint}`,
            color: tint,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{member.display_name}</div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--rp-gold-lite)',
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <span>{member.role}</span>
            {member.is_investor_side_only && (
              <span
                style={{
                  background: 'rgba(255, 204, 51, 0.12)',
                  color: 'var(--c-investor)',
                  border: '1px solid var(--c-investor)',
                  borderRadius: 4,
                  padding: '1px 6px',
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                investor-side only
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (typeof window === 'undefined') return
            window.dispatchEvent(
              new CustomEvent('center:scroll-to-bucket', {
                detail: { assigned_to: member.email },
              })
            )
          }}
          aria-label={`Show bucket items assigned to ${member.display_name}`}
          style={{
            minWidth: 44,
            height: 32,
            padding: '0 12px',
            background: openCount > 0 ? tint : 'transparent',
            color: openCount > 0 ? 'var(--rp-navy)' : 'var(--rp-gold-lite)',
            border: `1px solid ${openCount > 0 ? tint : 'var(--rp-border)'}`,
            borderRadius: 16,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {openCount}
        </button>
      </div>

      {expanded && (
        <DelegateForm
          member={member}
          onClose={() => setExpanded(false)}
          onDelegated={onDelegated}
        />
      )}
    </div>
  )
}

// ── Delegate form ────────────────────────────────────────────────────────────

function DelegateForm({
  member,
  onClose,
  onDelegated,
}: {
  member: CrewMemberRow
  onClose: () => void
  onDelegated: () => void
}) {
  const [title, setTitle] = useState('')
  const [remindAt, setRemindAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minRemind = useMemo(() => toLocalInputValue(new Date()), [])

  const submit = async () => {
    setError(null)
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Add a title first.')
      return
    }
    setBusy(true)
    try {
      const remindIso = remindAt ? new Date(remindAt).toISOString() : undefined
      const res = await fetch('/api/crew/delegate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to_email: member.email,
          title: trimmed,
          remind_at: remindIso,
        }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
        throw new Error(json.message || json.error || `HTTP ${res.status}`)
      }
      setTitle('')
      setRemindAt('')
      onDelegated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        background: 'rgba(14, 52, 112, 0.45)',
        border: '1px solid var(--rp-border)',
        borderRadius: 8,
        padding: 12,
        marginTop: -6,
        marginBottom: 8,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle} htmlFor={`crew-title-${member.email}`}>
          Task for {member.display_name}
        </label>
        <input
          id={`crew-title-${member.email}`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          style={inputStyle}
          autoFocus
          disabled={busy}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle} htmlFor={`crew-remind-${member.email}`}>
          Remind (optional)
        </label>
        <input
          id={`crew-remind-${member.email}`}
          type="datetime-local"
          value={remindAt}
          min={minRemind}
          onChange={(e) => setRemindAt(e.target.value)}
          style={inputStyle}
          disabled={busy}
        />
      </div>

      {error && (
        <div style={{ color: 'var(--c-fail)', fontSize: 12, marginBottom: 8 }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          style={{
            flex: 1,
            background: 'var(--rp-gold)',
            color: 'var(--rp-navy)',
            border: 'none',
            borderRadius: 6,
            padding: '10px 14px',
            fontWeight: 700,
            fontSize: 14,
            fontFamily: 'inherit',
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Delegating…' : 'Delegate'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          style={{
            background: 'transparent',
            color: 'var(--rp-gold-lite)',
            border: '1px solid var(--rp-border)',
            borderRadius: 6,
            padding: '10px 14px',
            fontWeight: 600,
            fontSize: 13,
            fontFamily: 'inherit',
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
