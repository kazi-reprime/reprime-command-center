'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DashboardThread, Panel } from '@/lib/timelines/types'
import { useToast } from '@/lib/contexts/ToastContext'
import { PIPEDRIVE_FIELD_KEYS } from '@/lib/pipedrive/client'
import type {
  PipedriveActivity,
  PipedriveContactValue,
  PipedrivePerson,
} from '@/lib/pipedrive/client'

interface ResolvePayload {
  person: PipedrivePerson | null
  activities: PipedriveActivity[]
  fieldKeys?: { dashboard: string; tag: string }
}

interface InvitationRecord {
  id: string
  status: 'sent' | 'confirmed' | 'expired' | 'cancelled'
  meeting_type: 'terminal' | 'meeting' | null
  created_at: string
  expires_at: string | null
  confirmed_slot_iso: string | null
  view_count: number | null
  first_opened_at: string | null
  last_opened_at: string | null
}

function relativeTimeShort(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fmtSlot(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago',
  }).format(d) + ' CT'
}

interface Theme {
  bg: string
  surface: string
  border: string
  text: string
  muted: string
  accent: string
  inputBg: string
  inputText: string
  buttonBg: string
  buttonText: string
}

const themes: Record<Panel, Theme> = {
  '305': {
    bg: 'var(--rp-navy)',
    surface: 'var(--rp-surface)',
    border: 'var(--rp-border)',
    text: 'var(--rp-white)',
    muted: 'var(--rp-gold-lite)',
    accent: 'var(--rp-gold)',
    inputBg: 'rgba(14, 52, 112, 0.85)',
    inputText: '#FFFFFF',
    buttonBg: 'var(--rp-gold)',
    buttonText: 'var(--rp-navy)',
  },
  '718': {
    bg: 'var(--personal-bg)',
    surface: 'var(--personal-surface)',
    border: 'var(--personal-border)',
    text: 'var(--personal-text)',
    muted: 'var(--personal-muted)',
    accent: 'var(--personal-accent)',
    inputBg: '#FFFFFF',
    inputText: 'var(--personal-text)',
    buttonBg: 'var(--personal-accent)',
    buttonText: '#FFFFFF',
  },
}

function primaryFromList(list: PipedriveContactValue[] | null | undefined): string | null {
  if (!list || list.length === 0) return null
  const primary = list.find((x) => x.primary)
  return (primary ?? list[0]).value || null
}

function fmtActivityDate(a: PipedriveActivity): string {
  const raw = a.update_time || a.add_time || a.due_date || ''
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PipedriveCard({
  thread,
  panel,
}: {
  thread: DashboardThread
  panel: Panel
}) {
  const theme = themes[panel]
  const queryClient = useQueryClient()
  const { addToast } = useToast()
  const queryKey = ['pipedrive', 'resolve', thread.phone, panel] as const

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<ResolvePayload> => {
      const res = await fetch(
        `/api/pipedrive/resolve?phone=${encodeURIComponent(thread.phone)}&panel=${panel}`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as ResolvePayload
    },
    staleTime: 60_000,
  })

  const person = data?.person ?? null
  const activities = data?.activities ?? []

  // ── Terminal Invite tracking ───────────────────────────────────────────────
  const { data: inviteData } = useQuery({
    queryKey: ['invite-status', person?.id],
    enabled: !!person?.id,
    queryFn: async (): Promise<{ invitation: InvitationRecord | null }> => {
      const res = await fetch(`/api/invitations/by-contact?pipedrive_id=${person!.id}`, { cache: 'no-store' })
      if (!res.ok) return { invitation: null }
      return res.json() as Promise<{ invitation: InvitationRecord | null }>
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const invite = inviteData?.invitation ?? null

  const initialNote = useMemo(() => {
    if (!person) return ''
    const v = person[PIPEDRIVE_FIELD_KEYS.NOTES_FROM_DASHBOARD]
    return typeof v === 'string' ? v : ''
  }, [person])

  const tagValue = useMemo(() => {
    if (!person) return null
    const v = person[PIPEDRIVE_FIELD_KEYS.TAG]
    if (v == null) return null
    return typeof v === 'string' ? v : String(v)
  }, [person])

  const [note, setNote] = useState<string>(initialNote)
  useEffect(() => {
    setNote(initialNote)
  }, [initialNote])

  const saveNote = useMutation({
    mutationFn: async (value: string) => {
      if (!person) return
      const res = await fetch('/api/pipedrive/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: person.id,
          value,
          phone: thread.phone,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const onNoteBlur = () => {
    if (!person) return
    if (note === initialNote) return
    saveNote.mutate(note)
  }

  const orgName =
    typeof person?.org_id === 'object' && person?.org_id
      ? (person.org_id as { name?: string }).name ?? null
      : person?.org_name ?? null

  const primaryEmail = person?.primary_email ?? primaryFromList(person?.email)
  const primaryPhone = primaryFromList(person?.phone)

  const containerStyle: React.CSSProperties = {
    width: 300,
    flexShrink: 0,
    background: theme.surface,
    borderLeft: `1px solid ${theme.border}`,
    padding: '0.85rem',
    overflowY: 'auto',
    color: theme.text,
    fontSize: 13,
  }

  if (isLoading) {
    return (
      <aside style={containerStyle}>
        <div style={{ height: 14, width: '60%', background: theme.border, borderRadius: 3 }} />
        <div style={{ height: 12, width: '40%', background: theme.border, borderRadius: 3, marginTop: 10 }} />
        <div style={{ height: 12, width: '80%', background: theme.border, borderRadius: 3, marginTop: 6 }} />
        <div style={{ height: 12, width: '70%', background: theme.border, borderRadius: 3, marginTop: 6 }} />
      </aside>
    )
  }

  if (isError) {
    return (
      <aside style={containerStyle}>
        <p style={{ color: 'var(--rp-red)', margin: 0, fontSize: 12 }}>
          Pipedrive lookup failed: {(error as Error).message}
        </p>
      </aside>
    )
  }

  if (!person) {
    return (
      <aside style={containerStyle}>
        <p style={{ color: theme.muted, margin: '0 0 0.75rem', fontSize: 12 }}>
          No Pipedrive contact found.
        </p>
        <button
          type="button"
          onClick={() => addToast('Create-from-conversation: coming in V2.', 'info')}
          style={{
            background: theme.buttonBg,
            color: theme.buttonText,
            border: 'none',
            borderRadius: 4,
            padding: '0.55rem 0.75rem',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Create from this conversation
        </button>
      </aside>
    )
  }

  return (
    <aside style={containerStyle}>
      <header style={{ marginBottom: '0.75rem' }}>
        <h2
          style={{
            color: theme.accent,
            fontSize: '1rem',
            fontWeight: 600,
            margin: 0,
            wordBreak: 'break-word',
          }}
        >
          {person.name}
        </h2>
        {orgName && (
          <div style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>{orgName}</div>
        )}
      </header>

      <dl style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
        {primaryEmail && (
          <div style={{ marginBottom: 4 }}>
            <dt style={{ color: theme.muted, display: 'inline', marginRight: 6 }}>email</dt>
            <dd style={{ display: 'inline', margin: 0, wordBreak: 'break-all' }}>
              {primaryEmail}
            </dd>
          </div>
        )}
        {primaryPhone && (
          <div style={{ marginBottom: 4 }}>
            <dt style={{ color: theme.muted, display: 'inline', marginRight: 6 }}>phone</dt>
            <dd style={{ display: 'inline', margin: 0 }}>{primaryPhone}</dd>
          </div>
        )}
        {tagValue && (
          <div style={{ marginBottom: 4 }}>
            <dt style={{ color: theme.muted, display: 'inline', marginRight: 6 }}>tag</dt>
            <dd style={{ display: 'inline', margin: 0 }}>{tagValue}</dd>
          </div>
        )}
      </dl>

      <section style={{ marginTop: '0.85rem' }}>
        <h3
          style={{
            color: theme.muted,
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            margin: '0 0 0.4rem',
          }}
        >
          Recent activity
        </h3>
        {activities.length === 0 ? (
          <div style={{ color: theme.muted, fontSize: 12 }}>No recent activity.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {activities.map((a) => (
              <li
                key={a.id}
                style={{
                  fontSize: 12,
                  marginBottom: 6,
                  paddingBottom: 6,
                  borderBottom: `1px solid ${theme.border}`,
                }}
              >
                <div style={{ color: theme.muted, fontSize: 11 }}>
                  {fmtActivityDate(a)} · {a.type}
                </div>
                <div style={{ color: theme.text, wordBreak: 'break-word' }}>
                  {a.subject || '(no subject)'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Terminal Invite status ─────────────────────────────────────── */}
      {invite && (
        <section style={{ marginTop: '0.85rem' }}>
          <h3
            style={{
              color: theme.muted,
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              margin: '0 0 0.5rem',
            }}
          >
            Terminal Invite
          </h3>
          <div
            style={{
              background: 'rgba(255, 204, 51,0.06)',
              border: `1px solid rgba(255, 204, 51,0.2)`,
              borderRadius: 4,
              padding: '0.5rem 0.6rem',
              fontSize: 12,
              lineHeight: 1.55,
            }}
          >
            {/* Sent row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: theme.muted }}>Sent</span>
              <span style={{ color: theme.text }}>{fmtShortDate(invite.created_at)}</span>
            </div>

            {/* Open tracking */}
            {invite.status === 'sent' && (
              (invite.view_count ?? 0) > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ color: theme.muted }}>
                    Opened {invite.view_count}×
                  </span>
                  <span style={{ color: theme.text }}>{relativeTimeShort(invite.last_opened_at)}</span>
                </div>
              ) : (
                <div style={{ color: theme.muted, marginBottom: 3 }}>Not opened yet</div>
              )
            )}

            {/* Status badge */}
            <div style={{ marginTop: 4 }}>
              {invite.status === 'confirmed' && (
                <span
                  style={{
                    display: 'inline-block',
                    background: 'rgba(80,200,120,0.15)',
                    color: '#50C878',
                    border: '1px solid rgba(80,200,120,0.3)',
                    borderRadius: 3,
                    padding: '2px 6px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                  }}
                >
                  ✓ Confirmed
                </span>
              )}
              {invite.status === 'sent' && (
                <span
                  style={{
                    display: 'inline-block',
                    background: 'rgba(255, 204, 51,0.1)',
                    color: theme.accent,
                    border: `1px solid rgba(255, 204, 51,0.25)`,
                    borderRadius: 3,
                    padding: '2px 6px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                  }}
                >
                  {(invite.view_count ?? 0) > 0 ? '⏳ Opened · Not scheduled' : '⏳ Pending'}
                </span>
              )}
              {invite.status === 'expired' && (
                <span
                  style={{
                    display: 'inline-block',
                    background: 'rgba(255,100,100,0.1)',
                    color: '#FF6464',
                    border: '1px solid rgba(255,100,100,0.2)',
                    borderRadius: 3,
                    padding: '2px 6px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                  }}
                >
                  Expired
                </span>
              )}
              {invite.status === 'cancelled' && (
                <span style={{ color: theme.muted, fontSize: 11 }}>Cancelled</span>
              )}
            </div>

            {/* Confirmed slot */}
            {invite.status === 'confirmed' && invite.confirmed_slot_iso && (
              <div style={{ marginTop: 5, color: '#50C878', fontSize: 11 }}>
                {fmtSlot(invite.confirmed_slot_iso)}
              </div>
            )}
          </div>
        </section>
      )}

      <section style={{ marginTop: '0.85rem' }}>
        <h3
          style={{
            color: theme.muted,
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            margin: '0 0 0.4rem',
          }}
        >
          Notes from Dashboard
          {saveNote.isPending && (
            <span style={{ color: theme.muted, marginLeft: 6, fontWeight: 400 }}>· saving…</span>
          )}
          {saveNote.isError && (
            <span style={{ color: 'var(--rp-red)', marginLeft: 6, fontWeight: 400 }}>· save failed</span>
          )}
        </h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={onNoteBlur}
          placeholder="Add notes..."
          rows={4}
          style={{
            width: '100%',
            background: theme.inputBg,
            color: theme.inputText,
            border: `1px solid ${theme.border}`,
            borderRadius: 4,
            padding: '0.5rem',
            fontSize: 12,
            fontFamily: 'inherit',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </section>
    </aside>
  )
}
