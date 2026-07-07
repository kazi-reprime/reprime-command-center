/**
 * Meeting Agent — Zoom + Calendar meeting operations
 *
 * Tools: list_meetings, create_meeting, get_meeting_brief, process_transcript
 * Handles pre-meeting briefs, post-meeting summaries, action items.
 */

import { type AgentDefinition, type AgentTool, registerAgent } from './types'

const listMeetings: AgentTool = {
  name: 'list_meetings',
  description: "List upcoming Zoom meetings. Returns meeting topic, time, join link.",
  parameters: {
    type: { type: 'string', description: "'upcoming' or 'past' (default: upcoming)" },
  },
  async execute(params) {
    try {
      const { zoomRequest } = await import('@/lib/zoom/client')
      const meetingType = params.type === 'past' ? 'previous_meetings' : 'upcoming'
      const data = await zoomRequest<{
        meetings: Array<{
          id: number
          topic: string
          start_time: string
          duration: number
          join_url: string
          status?: string
        }>
      }>(`/users/me/meetings?type=${meetingType}&page_size=20`)
      return JSON.stringify({
        count: data.meetings?.length || 0,
        meetings: (data.meetings || []).map(m => ({
          id: m.id,
          topic: m.topic,
          startTime: m.start_time,
          duration: m.duration,
          joinUrl: m.join_url,
          status: m.status,
        })),
      })
    } catch (err) {
      return JSON.stringify({ error: (err as Error).message })
    }
  },
}

const createMeeting: AgentTool = {
  name: 'create_zoom_meeting',
  description: 'Create a new Zoom meeting. ALWAYS get approval first. Returns join link.',
  parameters: {
    topic: { type: 'string', description: 'Meeting topic/title' },
    start_time: { type: 'string', description: 'Start time in ISO format' },
    duration: { type: 'number', description: 'Duration in minutes (default 30)' },
    agenda: { type: 'string', description: 'Meeting agenda (optional)' },
  },
  async execute(params) {
    const topic = String(params.topic || '').trim()
    if (!topic) return JSON.stringify({ error: 'topic required' })

    try {
      const { createMeeting: zoomCreate } = await import('@/lib/zoom/client')
      const meeting = await zoomCreate('me', {
        topic,
        start_time: String(params.start_time),
        duration: Number(params.duration) || 30,
        agenda: params.agenda as string | undefined,
      })
      return JSON.stringify({
        success: true,
        meetingId: meeting.id,
        joinUrl: meeting.join_url,
        password: meeting.password,
      })
    } catch (err) {
      return JSON.stringify({ error: (err as Error).message })
    }
  },
}

const getMeetingBrief: AgentTool = {
  name: 'get_meeting_brief',
  description: 'Generate a pre-meeting brief for an upcoming meeting. Includes attendee context and prior interactions.',
  parameters: {
    meeting_topic: { type: 'string', description: 'Meeting topic to search for' },
  },
  async execute(params) {
    const topic = String(params.meeting_topic || '').trim()

    try {
      // Get today's calendar events
      const { getTodayEvents } = await import('@/lib/google/calendar')
      const events = await getTodayEvents()

      // Find matching meeting
      const meeting = events.find(
        e => e.title.toLowerCase().includes(topic.toLowerCase()),
      )

      if (!meeting) {
        return JSON.stringify({
          message: `No meeting found matching "${topic}"`,
          allMeetings: events.map(e => e.title),
        })
      }

      // Build brief with attendee context
      const brief: Record<string, unknown> = {
        title: meeting.title,
        time: meeting.startTime,
        zoomLink: meeting.zoomLink,
        hangoutLink: meeting.hangoutLink,
        attendees: meeting.attendees,
      }

      // Look up attendees in contacts
      if (meeting.attendees.length > 0) {
        const { createServiceClient } = await import('@/lib/supabase/server')
        const supabase = createServiceClient()
        const attendeeContext: Record<string, unknown>[] = []

        for (const email of meeting.attendees.slice(0, 5)) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('name, company, is_investor')
            .eq('email', email)
            .single()

          if (contact) {
            attendeeContext.push({
              email,
              name: (contact as { name: string }).name,
              company: (contact as { company: string | null }).company,
              isInvestor: (contact as { is_investor: boolean }).is_investor,
            })
          } else {
            attendeeContext.push({ email, name: 'Unknown' })
          }
        }

        brief.attendeeContext = attendeeContext
      }

      return JSON.stringify(brief)
    } catch (err) {
      return JSON.stringify({ error: (err as Error).message })
    }
  },
}

const getMeetingAttendance: AgentTool = {
  name: 'get_meeting_attendance',
  description: 'Check who actually attended a past Zoom meeting. Distinguishes guests from internal team.',
  parameters: {
    meeting_id: { type: 'string', description: 'Zoom meeting ID' },
  },
  async execute(params) {
    const meetingId = String(params.meeting_id || '')
    if (!meetingId) return JSON.stringify({ error: 'meeting_id required' })

    try {
      const { getPastMeetingAttendance } = await import('@/lib/zoom/client')
      const attendance = await getPastMeetingAttendance(meetingId)
      return JSON.stringify({
        ok: attendance.ok,
        participantCount: attendance.participantCount,
        guestCount: attendance.guestCount,
        totalMinutes: attendance.totalMinutes,
        noShow: attendance.ok && attendance.guestCount === 0,
      })
    } catch (err) {
      return JSON.stringify({ error: (err as Error).message })
    }
  },
}

const meetingAgent: AgentDefinition = {
  id: 'meeting',
  name: 'Meeting Agent',
  description: 'Zoom meeting operations — create, list, briefs, attendance, summaries',
  systemPrompt: `You are Nora's Meeting specialist. You manage Gideon's Zoom meetings and meeting intelligence.

Your tools:
- list_meetings: Get upcoming or past Zoom meetings
- create_zoom_meeting: Create a new Zoom meeting (GET APPROVAL FIRST)
- get_meeting_brief: Generate a pre-meeting brief with attendee context
- get_meeting_attendance: Check who actually attended a past meeting

When answering about meetings:
1. Always check real data — never guess about meeting times
2. Include Zoom join links when available
3. For pre-meeting briefs, include attendee context (who they are, past interactions)
4. For post-meeting, report attendance (who showed vs no-shows)
5. Create action items from meeting outcomes when asked`,
  tools: [listMeetings, createMeeting, getMeetingBrief, getMeetingAttendance],
  canHandoffTo: ['orchestrator', 'calendar', 'tasks'],
  requiresApproval: true,
  maxToolRounds: 3,
}

registerAgent(meetingAgent)
export { meetingAgent }
