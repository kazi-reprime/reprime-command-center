'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ReminderRow = {
  id: string
  bucket_item_id: string
  fire_at: string
  fired_at: string | null
  payload: { title?: string; body?: string } | null
}

type ToastEntry = {
  id: string
  reminder_id: string
  bucket_item_id: string
  title: string
  body: string
}

const AUTO_DISMISS_MS = 12_000
const SNOOZE_MS = 10 * 60 * 1000

/**
 * ReminderToast — bottom-right stack that surfaces fired reminders.
 *
 * Subscribes to UPDATEs on public.reminders and renders a toast for any row
 * whose fired_at flips from null to a timestamp. Three actions per toast:
 *
 *   Open       — dispatches `center:open-window` for target `bucket-item`,
 *                attaches the reminder id to the spawned window so a future
 *                workflow can resolve "the window I opened from this toast."
 *   Snooze 10m — POSTs a fresh reminder 10 minutes out and removes the toast.
 *   Dismiss    — removes the toast immediately.
 *
 * Toasts auto-dismiss after 12 seconds. NO Listen button: toasts surface
 * user-content notifications, not AI-written prose, and Speechify-friendly
 * audio is reserved for AI text per the dashboard standard.
 */
export default function ReminderToast() {
  const supabase = useMemo(() => createClient(), [])
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const seen = useRef<Set<string>>(new Set())

  const removeToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId))
  }, [])

  const pushFromRow = useCallback((row: ReminderRow) => {
    if (!row.fired_at) return
    if (seen.current.has(row.id)) return
    seen.current.add(row.id)

    const title =
      (row.payload && typeof row.payload.title === 'string' && row.payload.title) ||
      'Reminder'
    const body =
      (row.payload && typeof row.payload.body === 'string' && row.payload.body) ||
      ''

    setToasts((prev) => [
      ...prev,
      {
        id: `toast-${row.id}-${Date.now()}`,
        reminder_id: row.id,
        bucket_item_id: row.bucket_item_id,
        title,
        body,
      },
    ])
  }, [])

  // Realtime subscription. We listen to UPDATEs and gate on fired_at in the
  // handler — postgres_changes filter syntax is limited and the row volume
  // here is tiny.
  useEffect(() => {
    const channel = supabase
      .channel('center:reminders')
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'reminders' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload?.new as ReminderRow | undefined
          if (row) pushFromRow(row)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, pushFromRow])

  return (
    <div
      data-component="reminder-toast-stack"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 152,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <ToastCard
          key={t.id}
          toast={t}
          onDismiss={() => removeToast(t.id)}
        />
      ))}
    </div>
  )
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastEntry
  onDismiss: () => void
}) {
  const [busy, setBusy] = useState<'snooze' | null>(null)

  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const handleOpen = useCallback(() => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent('center:open-window', {
        detail: {
          target: 'bucket-item',
          opts: {
            id: `reminder-${toast.reminder_id}`,
            componentProps: {
              itemId: toast.bucket_item_id,
              title: toast.title,
            },
            attached_reminder_id: toast.reminder_id,
          },
        },
      }),
    )
    onDismiss()
  }, [toast, onDismiss])

  const handleSnooze = useCallback(async () => {
    setBusy('snooze')
    try {
      const fireAt = new Date(Date.now() + SNOOZE_MS).toISOString()
      const res = await fetch(
        `/api/bucket/${encodeURIComponent(toast.bucket_item_id)}/remind`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            fire_at: fireAt,
            payload: { title: toast.title, body: toast.body },
          }),
        },
      )
      if (!res.ok) {
        console.error('[ReminderToast] snooze failed', res.status, await res.text())
      }
    } catch (err) {
      console.error('[ReminderToast] snooze threw', err)
    } finally {
      onDismiss()
    }
  }, [toast, onDismiss])

  return (
    <div
      data-component="reminder-toast"
      data-reminder-id={toast.reminder_id}
      style={{
        pointerEvents: 'auto',
        width: 360,
        background: 'rgba(14, 52, 112, 0.96)',
        border: '1px solid var(--c-warn)',
        borderRadius: 8,
        padding: '12px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        color: '#F5EFD8',
        fontFamily: 'inherit',
        fontSize: 13,
        lineHeight: 1.45,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--c-warn)',
          }}
        >
          Reminder
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: 'transparent',
            border: 0,
            color: '#9DB3D6',
            fontSize: 16,
            lineHeight: 1,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#F5EFD8',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={toast.title}
      >
        {toast.title}
      </div>

      {toast.body ? (
        <div
          style={{
            fontSize: 12,
            color: '#C8D4E8',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {toast.body}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button
          type="button"
          onClick={handleOpen}
          style={primaryButtonStyle}
        >
          Open
        </button>
        <button
          type="button"
          onClick={handleSnooze}
          disabled={busy === 'snooze'}
          style={{
            ...secondaryButtonStyle,
            opacity: busy === 'snooze' ? 0.6 : 1,
          }}
        >
          {busy === 'snooze' ? 'Snoozing…' : 'Snooze 10m'}
        </button>
      </div>
    </div>
  )
}

const primaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  background: 'var(--rp-gold)',
  color: 'var(--rp-navy)',
  border: 0,
  borderRadius: 4,
  fontWeight: 600,
  fontSize: 12,
  fontFamily: 'inherit',
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  background: 'transparent',
  color: '#F5EFD8',
  border: '1px solid rgba(255, 204, 51, 0.35)',
  borderRadius: 4,
  fontWeight: 500,
  fontSize: 12,
  fontFamily: 'inherit',
  cursor: 'pointer',
}
