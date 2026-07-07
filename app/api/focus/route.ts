/**
 * Suggested Focus API
 * 
 * Returns aggregated focus data for NEXT UP, WHAT NEEDS YOU,
 * and NORA SUGGESTS sections in the TopStrip and dashboard.
 */

import { NextResponse } from 'next/server'
import { getSuggestedFocus } from '@/lib/center/suggested-focus'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const focus = await getSuggestedFocus()
    return NextResponse.json(focus)
  } catch (err) {
    console.error('[api/focus] failed:', (err as Error).message)
    return NextResponse.json(
      {
        nextUp: [],
        needsYou: [],
        noraSuggests: [],
        quickStats: {
          unreadMessages: 0,
          meetingsToday: 0,
          openTasks: 0,
          overdueItems: 0,
          coldInvestors: 0,
        },
      },
      { status: 200 }, // Degrade gracefully — never fail the dashboard
    )
  }
}
