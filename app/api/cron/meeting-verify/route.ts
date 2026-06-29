import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getPastMeetingAttendance } from '@/lib/zoom/client'
import { notifyGroup } from '@/lib/center/notify'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// "Did the booked meeting actually happen?" verifier. People say they'll come
// and don't — so we don't assume. ~30 min after the fact this checks Zoom for
// who ACTUALLY joined each just-passed Terminal meeting and stamps the
// invitation: attended or no_show. On each result it nudges the "Terminal
// invitations" WhatsApp group so a no-show gets a same-day follow-up.
//
// Scope of each run (keep it tight so it can't thrash old rows):
//   status = 'confirmed'              (booking went through)
//   confirmed_slot_iso is not null    (we know when)
//   zoom_meeting_id is not null       (we have a meeting to check)
//   meeting_status is null            (not already verified)
//   slot ended ≥45 min ago AND ≤24h ago (long enough to be real, recent enough)

// Reuse the exact cron-auth pattern from /api/cron/dispatch-alerts:
// no CRON_SECRET set → allow; set → require Bearer.
function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return true
  const header = request.headers.get('authorization') || ''
  return header === `Bearer ${expected}`
}

interface VerifyRow {
  id: string
  contact_first_name: string | null
  contact_name: string | null
  confirmed_slot_iso: string | null
  zoom_meeting_id: string | null
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const cutoffPastIso = new Date(nowMs - 45 * 60 * 1000).toISOString() // slot ≥45 min old
  const cutoffRecentIso = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString() // within last 24h

  const { data, error } = await supabase
    .from('invitations')
    .select('id, contact_first_name, contact_name, confirmed_slot_iso, zoom_meeting_id')
    .eq('status', 'confirmed')
    .is('meeting_status', null)
    .not('confirmed_slot_iso', 'is', null)
    .not('zoom_meeting_id', 'is', null)
    .lte('confirmed_slot_iso', cutoffPastIso)
    .gte('confirmed_slot_iso', cutoffRecentIso)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data || []) as VerifyRow[]
  const results: Array<{ id: string; status: string }> = []
  const errors: string[] = []
  let attended = 0
  let noShow = 0

  for (const row of rows) {
    // Belt-and-suspenders: the query already filtered nulls, but a static-fallback
    // booking can carry zoom_meeting_id = 'static' (no real meeting to check).
    const meetingId = row.zoom_meeting_id
    if (!meetingId || meetingId === 'static') continue

    const firstName = row.contact_first_name || row.contact_name || 'Someone'
    const slotDisplay = formatSlot(row.confirmed_slot_iso)

    try {
      const att = await getPastMeetingAttendance(meetingId)

      // CRITICAL: if Zoom never answered (every feed 404'd / scope error), we
      // CANNOT read attendance — do NOT call that a no-show. Mark it
      // 'unverifiable' and ask a human to check, so a real meeting that simply
      // couldn't be read is never falsely flagged as a no-show.
      if (!att.ok) {
        const { error: updErr } = await supabase
          .from('invitations')
          .update({ meeting_status: 'unverifiable', meeting_checked_at: nowIso })
          .eq('id', row.id)
        if (updErr) throw new Error(updErr.message)
        results.push({ id: row.id, status: 'unverifiable' })
        try {
          await notifyGroup(`⚠ Couldn't confirm ${firstName}'s Terminal meeting (${slotDisplay}) — Zoom attendance unavailable, check manually.`)
        } catch (e) {
          errors.push(`alert ${row.id}: ${(e as Error).message.slice(0, 80)}`)
        }
        continue
      }

      // A real meeting needs the INVITED GUEST to join — our own team (Gideon,
      // Steve, Tahisa…) waiting in an empty room is still a no-show.
      const didAttend = att.guestCount >= 1
      const meetingStatus = didAttend ? 'attended' : 'no_show'

      const { error: updErr } = await supabase
        .from('invitations')
        .update({ meeting_status: meetingStatus, meeting_checked_at: nowIso })
        .eq('id', row.id)
      if (updErr) throw new Error(updErr.message)

      results.push({ id: row.id, status: meetingStatus })
      if (didAttend) attended++
      else noShow++

      // Alert per result. Wrap so one failed nudge can't stop the batch.
      try {
        const text = didAttend
          ? `✅ ${firstName} attended the Terminal meeting.`
          : `⚠ ${firstName} did NOT show for the Terminal meeting (${slotDisplay}). Follow up.`
        await notifyGroup(text)
      } catch (e) {
        errors.push(`alert ${row.id}: ${(e as Error).message.slice(0, 80)}`)
      }
    } catch (e) {
      errors.push(`verify ${row.id}: ${(e as Error).message.slice(0, 80)}`)
    }
  }

  return NextResponse.json({
    candidates: rows.length,
    attended,
    noShow,
    results,
    errors,
  })
}

// Central-time display for the no-show follow-up nudge.
function formatSlot(iso: string | null): string {
  if (!iso) return 'the slot'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  }).format(d)
}
