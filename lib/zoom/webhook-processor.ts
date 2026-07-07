/**
 * Zoom Webhook Processor
 *
 * Processes real Zoom webhook events:
 * - meeting.ended → attendance check → intelligence pipeline
 * - recording.completed → fetch transcript → AI summary
 * - meeting.participant_joined/left → realtime tracking
 */

import { createServiceClient } from '@/lib/supabase/server'

interface ZoomParticipant {
  user_name?: string
  user_email?: string
  join_time?: string
  leave_time?: string
  duration?: number
  id?: string
}

interface ZoomRecordingFile {
  id?: string
  file_type?: string
  download_url?: string
  recording_start?: string
  recording_end?: string
  status?: string
}

interface ZoomMeetingPayload {
  id?: number | string
  uuid?: string
  topic?: string
  start_time?: string
  end_time?: string
  duration?: number
  host_email?: string
  host_id?: string
  type?: number
  participant?: ZoomParticipant
  recording_files?: ZoomRecordingFile[]
  download_token?: string
}

/**
 * Process a meeting.ended event.
 * Triggers attendance check and meeting intelligence.
 */
export async function processMeetingEnded(payload: ZoomMeetingPayload): Promise<void> {
  const meetingId = String(payload.id || payload.uuid || '')
  const topic = payload.topic || 'Untitled Meeting'
  const supabase = createServiceClient()

  console.log('[zoom-processor] meeting.ended', { meetingId, topic })

  // 1. Get attendance
  try {
    const { getPastMeetingAttendance } = await import('@/lib/zoom/client')
    const attendance = await getPastMeetingAttendance(meetingId)

    // Upsert meeting record with attendance
    await supabase.from('zoom_meetings').upsert(
      {
        zoom_id: meetingId,
        topic,
        start_time: payload.start_time || null,
        end_time: payload.end_time || null,
        duration: payload.duration || null,
        status: 'ended',
        host_email: payload.host_email || null,
        participant_count: attendance.participantCount,
        guest_count: attendance.guestCount,
        no_show: attendance.ok && attendance.guestCount === 0,
      },
      { onConflict: 'zoom_id' },
    )

    console.log('[zoom-processor] attendance saved', {
      meetingId,
      participants: attendance.participantCount,
      guests: attendance.guestCount,
      noShow: attendance.ok && attendance.guestCount === 0,
    })
  } catch (err) {
    console.error('[zoom-processor] attendance check failed', (err as Error).message)
  }
}

/**
 * Process a recording.completed event.
 * Downloads transcript and triggers AI summary pipeline.
 */
export async function processRecordingCompleted(payload: ZoomMeetingPayload): Promise<void> {
  const meetingId = String(payload.id || payload.uuid || '')
  const topic = payload.topic || 'Untitled Meeting'
  const supabase = createServiceClient()

  console.log('[zoom-processor] recording.completed', { meetingId, topic })

  // Find transcript file
  const transcriptFile = (payload.recording_files || []).find(
    f => f.file_type === 'TRANSCRIPT' || f.file_type === 'CC',
  )

  const recordingFile = (payload.recording_files || []).find(
    f => f.file_type === 'MP4' || f.file_type === 'M4A',
  )

  // Update meeting record
  await supabase.from('zoom_meetings').upsert(
    {
      zoom_id: meetingId,
      topic,
      recording_url: recordingFile?.download_url || null,
      transcript_url: transcriptFile?.download_url || null,
      recording_status: 'completed',
    },
    { onConflict: 'zoom_id' },
  )

  // If we have a transcript, trigger intelligence pipeline
  if (transcriptFile?.download_url && payload.download_token) {
    try {
      const transcriptRes = await fetch(
        `${transcriptFile.download_url}?access_token=${payload.download_token}`,
      )
      if (transcriptRes.ok) {
        const transcriptText = await transcriptRes.text()

        // Get meeting attendees from calendar
        const { getTodayEvents } = await import('@/lib/google/calendar')
        const events = await getTodayEvents()
        const matchingEvent = events.find(
          e => e.title.toLowerCase().includes(topic.toLowerCase()),
        )
        const attendees = matchingEvent?.attendees || []

        // Run intelligence pipeline
        const { processMeetingIntelligence } = await import('./meeting-intelligence')
        await processMeetingIntelligence({
          meetingId,
          topic,
          transcript: transcriptText,
          attendees,
          participants: [], // Will be populated from attendance data
        })

        console.log('[zoom-processor] intelligence pipeline completed', { meetingId })
      }
    } catch (err) {
      console.error('[zoom-processor] transcript processing failed', (err as Error).message)
    }
  }
}

/**
 * Process participant_joined / participant_left events.
 */
export async function processParticipantEvent(
  event: 'joined' | 'left',
  payload: ZoomMeetingPayload,
): Promise<void> {
  const meetingId = String(payload.id || payload.uuid || '')
  const participant = payload.participant

  if (!participant) return

  console.log('[zoom-processor] participant', {
    event,
    meetingId,
    name: participant.user_name,
    email: participant.user_email,
  })

  // Store participant event (for live tracking)
  const supabase = createServiceClient()
  try {
    await supabase.from('zoom_events').insert({
      event: `participant.${event}`,
      payload: {
        meeting_id: meetingId,
        participant_name: participant.user_name,
        participant_email: participant.user_email,
        join_time: participant.join_time,
        leave_time: participant.leave_time,
      },
    })
  } catch {
    // Non-fatal
  }
}
