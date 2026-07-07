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

const calendarAgent: AgentDefinition = {
  id: 'calendar',
  name: 'Calendar Agent',
  description: 'Google Calendar operations — read events, schedule, check conflicts',
  systemPrompt: `You are Nora's Calendar specialist. You manage Gideon's Google Calendar.

Your tools:
- read_calendar_today: Get all events for today  
- read_briefing: Get the full morning briefing

When answering about the calendar:
1. Always check the actual calendar data — never guess
2. Format times in 12h format (e.g. "2:30 PM")
3. Highlight Zoom links when present
4. Note conflicts or tight transitions between meetings
5. If scheduling near sundown on Friday or Shabbat, mention it`,
  tools: [readCalendarToday, readBriefing],
  canHandoffTo: ['orchestrator', 'shabbat'],
  maxToolRounds: 2,
}

registerAgent(calendarAgent)

export { calendarAgent }
