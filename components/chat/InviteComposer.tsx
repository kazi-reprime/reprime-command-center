'use client'
import { useEffect, useMemo, useState } from 'react'
import type { DashboardThread, Panel } from '@/lib/timelines/types'
import {
  pickThreeSlots,
  detectLocale,
  type Slot,
  type SlotGroup,
} from '@/lib/scheduling/pick-three-slots'

type Props = {
  panel: Panel
  thread: DashboardThread
  onClose: () => void
  onSent?: () => void
}

function deriveFirstName(contactName: string | null, phone: string): string {
  if (contactName && contactName.trim()) {
    const parts = contactName.trim().split(/\s+/)
    return parts[0] || contactName.trim()
  }
  return phone
}

export default function InviteComposer({ panel, thread, onClose, onSent }: Props) {
  const initialFirstName = deriveFirstName(thread.contact_name, thread.phone)
  const initialFullName = thread.contact_name || initialFirstName

  const [firstName, setFirstName] = useState(initialFirstName)
  const [fullName, setFullName] = useState(initialFullName)
  const [personalMessage, setPersonalMessage] = useState(
    `${initialFirstName} — this is Gideon. I've been building something privately and you're one of the first people I want to show it to. Please select a time below — 20 minutes, just us.`
  )
  const [slotGroups, setSlotGroups] = useState<SlotGroup[]>([])
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Locale auto-detected from the WhatsApp thread phone. +972 → IL.
  const locale = useMemo(
    () => detectLocale(thread.phone, fullName || firstName),
    [thread.phone, fullName, firstName]
  )

  // Recompute 3 picks whenever locale or slot groups change.
  const slots: Slot[] = useMemo(
    () => pickThreeSlots(slotGroups, locale),
    [slotGroups, locale]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Fetch + pick 3 suggested slots on open so Gideon previews exactly what
  // the recipient will see (and what the parallel SendGrid email will list).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/bookings/available-slots', { cache: 'no-store' })
        if (!res.ok) throw new Error(`available-slots ${res.status}`)
        const { slots: groups } = (await res.json()) as { slots: SlotGroup[] }
        if (!cancelled) {
          setSlotGroups(groups ?? [])
          setSlotsLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setSlotsError((err as Error).message || 'Failed to load slots')
          setSlotsLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const slotPreview = useMemo(() => slots.map((s) => s.display), [slots])

  const send = async () => {
    if (submitting) return
    const msg = personalMessage.trim()
    if (!msg) {
      setError('Personal message is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // Step 1: create the invitation row in Supabase. Pass the 3 suggested
      // slots so the parallel SendGrid email at mint time has concrete times
      // to render as clickable buttons. Cookie auth (g@reprime.com) → no
      // captain token needed from the client.
      const inviteRes = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contact_first_name: firstName.trim() || null,
          contact_name: fullName.trim() || null,
          contact_phone: thread.phone,
          contact_pipedrive_id: thread.pipedrive_contact_id,
          meeting_type: 'terminal',
          proposed_slots: slots,
          locale,
        }),
      })
      if (!inviteRes.ok) {
        const txt = await inviteRes.text().catch(() => '')
        throw new Error(`invitation create failed: ${inviteRes.status} ${txt.slice(0, 200)}`)
      }
      const { invite_url } = (await inviteRes.json()) as { invite_url: string }

      // Step 2: send WhatsApp message: personal message + URL on its own line.
      // WhatsApp will auto-unfurl the URL into the OG card on the recipient side.
      const wireText = `${msg}\n\n${invite_url}`
      const sendRes = await fetch('/api/whatsapp/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          panel,
          thread_id: thread.id,
          body: wireText,
        }),
      })
      if (!sendRes.ok) {
        const txt = await sendRes.text().catch(() => '')
        throw new Error(`whatsapp send failed: ${sendRes.status} ${txt.slice(0, 200)}`)
      }

      onSent?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setSubmitting(false)
    }
  }

  const charCount = personalMessage.length

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(7,16,30,0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        fontFamily: 'var(--rp-font-body)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          background: 'rgba(14, 52, 112, 0.85)',
          color: '#fff',
          border: '1px solid rgba(14, 52, 112, 0.70)',
          borderRadius: 10,
          padding: '1.25rem 1.5rem 1.5rem',
          boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ color: 'rgba(255, 204, 51,0.7)', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600 }}>
              Terminal Invitation
            </div>
            <h2 style={{ margin: '0.2rem 0 0', fontSize: '1.05rem', color: '#FFCC33', fontWeight: 600 }}>
              Send to {thread.contact_name || thread.phone}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            style={{
              background: 'transparent',
              color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              padding: '0.25rem 0.5rem',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            âœ•
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'rgba(255, 204, 51,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              First name (in OG card)
            </span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={{
                background: '#0E3470',
                color: '#fff',
                border: '1px solid rgba(14, 52, 112, 0.70)',
                borderRadius: 5,
                padding: '0.45rem 0.6rem',
                fontFamily: 'inherit',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'rgba(255, 204, 51,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Full name (hero on card)
            </span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{
                background: '#0E3470',
                color: '#fff',
                border: '1px solid rgba(14, 52, 112, 0.70)',
                borderRadius: 5,
                padding: '0.45rem 0.6rem',
                fontFamily: 'inherit',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </label>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: '0.75rem' }}>
          <span style={{ fontSize: 11, color: 'rgba(255, 204, 51,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Personal message (green WhatsApp bubble above the card)
          </span>
          <textarea
            value={personalMessage}
            onChange={(e) => setPersonalMessage(e.target.value)}
            rows={5}
            placeholder="Hand-written line or two for this person…"
            style={{
              background: '#0E3470',
              color: '#fff',
              border: '1px solid rgba(14, 52, 112, 0.70)',
              borderRadius: 5,
              padding: '0.55rem 0.7rem',
              fontFamily: 'inherit',
              fontSize: 13,
              lineHeight: 1.45,
              resize: 'vertical',
              outline: 'none',
              minHeight: 110,
            }}
          />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', alignSelf: 'flex-end' }}>
            {charCount} chars
          </span>
        </label>

        {/* Suggested time slots — fetched from /api/bookings/available-slots
            and previewed here so Gideon sees exactly what the recipient will
            see in WhatsApp + email before he hits send. */}
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ fontSize: 11, color: 'rgba(255, 204, 51, 0.7)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Suggested times (sent in WhatsApp + email)
          </div>
          {slotsLoading ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
              Loading from your calendar…
            </div>
          ) : slotsError ? (
            <div style={{ fontSize: 12, color: '#FF7474' }}>
              Couldn&apos;t load slots — {slotsError}. Will send without suggested times (recipient picks on the booking page).
            </div>
          ) : slots.length === 0 ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' }}>
              No open slots in your calendar window. Recipient will pick on the booking page.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {slotPreview.map((s, i) => (
                <li key={i} style={{ fontSize: 13, color: '#FFCC33', fontFamily: 'Georgia, serif' }}>
                  · {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.65rem 0.85rem',
            background: 'rgba(0,0,0,0.25)',
            border: '1px dashed rgba(255, 204, 51,0.25)',
            borderRadius: 6,
            fontSize: 12,
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.5,
          }}
        >
          Sends to <strong style={{ color: '#FFCC33' }}>{thread.phone}</strong> via the {panel === '305' ? '305 RePrime' : '718 Personal'} WhatsApp line. The recipient sees your personal message, then a gold Terminal card with their name. If we have their email on file, a parallel SendGrid email lands at the same time with the suggested slots as clickable buttons.
        </div>

        {error && (
          <div style={{ marginTop: '0.6rem', color: '#FF7474', fontSize: 12 }}>
            âœ— {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 6,
              padding: '0.5rem 0.9rem',
              fontSize: 13,
              fontFamily: 'inherit',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={submitting || !personalMessage.trim()}
            style={{
              background: submitting || !personalMessage.trim() ? 'rgba(14, 52, 112, 0.70)' : '#FFCC33',
              color: submitting || !personalMessage.trim() ? 'rgba(255,255,255,0.5)' : '#0E3470',
              border: 'none',
              borderRadius: 6,
              padding: '0.5rem 1.1rem',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: submitting || !personalMessage.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Sending…' : 'Send invitation'}
          </button>
        </div>
      </div>
    </div>
  )
}
