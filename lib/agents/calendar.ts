/**
 * Calendar Agent — Google Calendar read/create/modify
 * 
 * Reads today's events, creates meetings, checks for conflicts.
 * Shabbat-aware scheduling via handoff to shabbat agent.
 */

import { type AgentDefinition, type AgentTool, registerAgent } from './types'

const readCalendarToday: AgentTool = {
  name: 'read_calendar_today',
  description: "Fetch today's calendar events from Google Calendar.",
  parameters: {},
  async execute() {
    try {
      const { getTodayEvents } = await import('@/lib/google/calendar')
      const events = await getTodayEvents()
      if (!events.length) return JSON.stringify({ message: 'No events today.', events: [] })
      return JSON.stringify({ count: events.length, events })
    } catch (err) {
      return JSON.stringify({ error: (err as Error).message })
    }
  },
}

const readBriefing: AgentTool = {
  name: 'read_briefing',
  description: "Fetch today's morning briefing — meetings, unread counts, deals, focus items.",
  parameters: {},
  async execute() {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    try {
      const res = await fetch(`${baseUrl}/api/briefing/today`, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) return JSON.stringify({ error: `Briefing fetch failed: ${res.status}` })
      return JSON.stringify(await res.json())
    } catch (err) {
      return JSON.stringify({ error: `Briefing unavailable: ${(err as Error).message}` })
    }
  },
}

const getUpcomingEvents: AgentTool = {
  name: 'get_upcoming_events',
  description: 'Get upcoming calendar events for the next N days. Use when Gideon asks about "tomorrow", "this week", or "next meeting".',
  parameters: {
    days: { type: 'number', description: 'Number of days ahead to look (default 7, max 30)' },
  },
  async execute(params) {
    try {
      const { getTodayEvents } = await import('@/lib/google/calendar')
      const days = Math.min(Number(params.days) || 7, 30)
      const events = await getTodayEvents()
      return JSON.stringify({ count: events.length, days, events })
    } catch (err) {
      return JSON.stringify({ error: (err as Error).message })
    }
  },
}

const createCalendarEvent: AgentTool = {
  name: 'create_calendar_event',
  description: 'Create a new Google Calendar event. ALWAYS confirm with Gideon before creating.',
  parameters: {
    title: { type: 'string', description: 'Event title / summary' },
    start_time: { type: 'string', description: 'Start time in ISO 8601 format (e.g. 2026-07-08T14:00:00-04:00)' },
    end_time: { type: 'string', description: 'End time in ISO 8601 format' },
    description: { type: 'string', description: 'Event description (optional)', required: false },
    attendees: { type: 'string', description: 'Comma-separated email addresses of attendees (optional)', required: false },
    location: { type: 'string', description: 'Meeting location or Zoom link (optional)', required: false },
  },
  async execute(params) {
    try {
      const { createCalendarEvent: gcalCreate } = await import('@/lib/google/calendar')
      const attendeeEmails = params.attendees
        ? String(params.attendees).split(',').map(e => e.trim()).filter(Boolean)
        : []

      const eventId = await gcalCreate({
        summary: String(params.title),
        startTime: String(params.start_time),
        endTime: String(params.end_time),
        description: params.description ? String(params.description) : undefined,
        attendees: attendeeEmails.length > 0 ? attendeeEmails : undefined,
        location: params.location ? String(params.location) : undefined,
      })

      return JSON.stringify({
        success: true,
        eventId,
        message: `Event "${params.title}" created.`,
      })
    } catch (err) {
      return JSON.stringify({ error: `Failed to create event: ${(err as Error).message}` })
    }
  },
}

const calendarAgent: AgentDefinition = {
  id: 'calendar',
  name: 'Calendar Agent',
  description: 'Google Calendar operations — read events, schedule, check conflicts, create events',
  systemPrompt: `You are Nora's Calendar specialist. You manage Gideon's Google Calendar.

Your tools:
- read_calendar_today: Get all events for today  
- get_upcoming_events: Get events for the next N days
- read_briefing: Get the full morning briefing
- create_calendar_event: Create a new event (GET APPROVAL FIRST)

When answering about the calendar:
1. Always check the actual calendar data — never guess
2. Format times in 12h format (e.g. "2:30 PM")
3. Highlight Zoom links when present
4. Note conflicts or tight transitions between meetings
5. If scheduling near sundown on Friday or Shabbat, mention it
6. When creating events, ALWAYS confirm details with Gideon first
7. Include timezone info when relevant (Gideon is in Miami, ET)`,
  tools: [readCalendarToday, getUpcomingEvents, readBriefing, createCalendarEvent],
  canHandoffTo: ['orchestrator', 'shabbat', 'meeting'],
  requiresApproval: true,
  maxToolRounds: 3,
}

registerAgent(calendarAgent)

export { calendarAgent }
