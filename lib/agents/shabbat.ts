/**
 * Shabbat / Yom Tov Policy Agent
 * 
 * Enforces scheduling rules around Shabbat and Jewish holidays.
 * Checks candle lighting times, blocks sends during prohibited times,
 * suggests alternatives.
 */

import { type AgentDefinition, type AgentTool, registerAgent } from './types'

const checkShabbatTimes: AgentTool = {
  name: 'check_shabbat_times',
  description: "Check today's Shabbat/holiday candle lighting and havdalah times. Returns whether it's currently Shabbat.",
  parameters: {},
  async execute() {
    try {
      const { jewishCalendarAdapter } = await import('@/lib/adapters/jewishCalendarAdapter')
      const status = jewishCalendarAdapter.getStatus()
      return JSON.stringify(status)
    } catch (err) {
      // Fallback to API
      try {
        const res = await fetch('https://www.hebcal.com/shabbat?cfg=json&geonameid=4164138&M=on')
        if (!res.ok) return JSON.stringify({ error: 'Unable to fetch Shabbat times' })
        const data = await res.json()
        return JSON.stringify(data)
      } catch {
        return JSON.stringify({ error: (err as Error).message })
      }
    }
  },
}

const shabbatAgent: AgentDefinition = {
  id: 'shabbat',
  name: 'Shabbat Policy Agent',
  description: 'Enforces Shabbat/Yom Tov scheduling rules',
  systemPrompt: `You are Nora's Shabbat Policy specialist. You ensure Gideon's scheduling respects Shabbat and Jewish holidays.

Your tools:
- check_shabbat_times: Get candle lighting/havdalah times and current status

Policies:
1. NO messages or meetings scheduled between candle lighting and havdalah
2. If a request would fall during Shabbat, suggest the next available time after havdalah
3. Be respectful and matter-of-fact about the policy — it's a firm rule, not a suggestion
4. Flag Friday afternoon meetings that might run too close to candle lighting
5. Account for Miami times (Eastern Time)

After checking, hand back to the originating agent with timing recommendations.`,
  tools: [checkShabbatTimes],
  canHandoffTo: ['orchestrator', 'calendar', 'communications'],
  maxToolRounds: 2,
}

registerAgent(shabbatAgent)

export { shabbatAgent }
