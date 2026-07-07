/**
 * Zoom Meeting Sync
 *
 * Syncs upcoming Zoom meetings to the local database.
 * Called by cron or manually to keep the meeting list fresh.
 */

import { createServiceClient } from '@/lib/supabase/server'

/**
 * Sync upcoming meetings from Zoom to local DB.
 */
export async function syncUpcomingMeetings(): Promise<{
  synced: number
  errors: string[]
}> {
  const { gateway } = await import('@/lib/gateway')
  const supabase = createServiceClient()
  let synced = 0
  const errors: string[] = []

  try {
    const result = await gateway.listMeetings({ type: 'upcoming' })
    if (!result.success || !result.data) {
      return { synced: 0, errors: [result.error || 'Failed to fetch meetings'] }
    }

    for (const meeting of result.data.meetings) {
      try {
        const { error } = await supabase.from('zoom_meetings').upsert(
          {
            zoom_id: String(meeting.id),
            topic: meeting.topic,
            start_time: meeting.startTime,
            duration: meeting.duration,
            join_url: meeting.joinUrl,
            status: meeting.status || 'scheduled',
          },
          { onConflict: 'zoom_id' },
        )

        if (error) {
          errors.push(`Meeting ${meeting.id}: ${error.message}`)
        } else {
          synced++
        }
      } catch (err) {
        errors.push(`Meeting ${meeting.id}: ${(err as Error).message}`)
      }
    }
  } catch (err) {
    errors.push(`Sync failed: ${(err as Error).message}`)
  }

  return { synced, errors }
}

/**
 * Get locally stored meetings (faster than API call).
 */
export async function getLocalMeetings(opts?: {
  status?: string
  limit?: number
  upcoming?: boolean
}): Promise<Array<Record<string, unknown>>> {
  const supabase = createServiceClient()
  let query = supabase
    .from('zoom_meetings')
    .select('*')
    .order('start_time', { ascending: true })
    .limit(opts?.limit || 20)

  if (opts?.status) {
    query = query.eq('status', opts.status)
  }

  if (opts?.upcoming) {
    query = query.gte('start_time', new Date().toISOString())
  }

  const { data } = await query
  return (data || []) as Array<Record<string, unknown>>
}
