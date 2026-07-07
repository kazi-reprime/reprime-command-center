/**
 * Suggested Focus — Real data aggregation for NEXT UP, WHAT NEEDS YOU, NORA SUGGESTS
 * 
 * Drives the TopStrip live counters and the SuggestedFocus component
 * with real data from calendar, WhatsApp, tasks, and email.
 */

import { createServiceClient } from '@/lib/supabase/server'

export interface FocusItem {
  id: string
  type: 'meeting' | 'unread' | 'task' | 'email' | 'overdue' | 'follow_up'
  title: string
  subtitle?: string
  urgency: 'critical' | 'high' | 'normal' | 'low'
  actionUrl?: string
  timestamp?: string
}

export interface SuggestedFocusData {
  nextUp: FocusItem[]
  needsYou: FocusItem[]
  noraSuggests: string[]
  quickStats: {
    unreadMessages: number
    meetingsToday: number
    openTasks: number
    overdueItems: number
    coldInvestors: number
  }
}

export async function getSuggestedFocus(): Promise<SuggestedFocusData> {
  const supabase = createServiceClient()
  const now = new Date()

  const results = await Promise.allSettled([
    // 1. Unread WhatsApp counts
    supabase
      .from('whatsapp_threads')
      .select('panel, unread_count, contact_name, is_investor')
      .gt('unread_count', 0),

    // 2. Open tasks
    supabase
      .from('bucket_items')
      .select('id, title, priority, status, created_at')
      .eq('status', 'open')
      .order('priority', { ascending: true })
      .limit(10),

    // 3. High-priority emails
    supabase
      .from('email_scores')
      .select('from_address, subject, score, reasons')
      .gte('score', 7)
      .order('score', { ascending: false })
      .limit(5),

    // 4. Today's meetings (from briefing API - best effort)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/briefing/today`, {
      cache: 'no-store',
    }).then(r => r.ok ? r.json() : null).catch(() => null),

    // 5. Cold investors
    supabase
      .from('whatsapp_threads')
      .select('contact_name, last_message_at')
      .eq('is_investor', true)
      .lt('last_message_at', new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  // Parse results
  const unreadResult = results[0].status === 'fulfilled' ? results[0].value.data ?? [] : []
  const tasksResult = results[1].status === 'fulfilled' ? results[1].value.data ?? [] : []
  const emailsResult = results[2].status === 'fulfilled' ? results[2].value.data ?? [] : []
  const briefingResult = results[3].status === 'fulfilled' ? results[3].value as Record<string, unknown> : null
  const coldInvestorsResult = results[4].status === 'fulfilled' ? results[4].value.data ?? [] : []

  // Build focus items
  const nextUp: FocusItem[] = []
  const needsYou: FocusItem[] = []
  const noraSuggests: string[] = []

  // Meetings → NEXT UP
  const meetings = (briefingResult as { meetings?: { items?: unknown[] } })?.meetings?.items ?? []
  for (const m of meetings as { id: string; title: string; startTime: string; zoomLink?: string }[]) {
    nextUp.push({
      id: `meeting-${m.id}`,
      type: 'meeting',
      title: m.title,
      subtitle: new Date(m.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      urgency: new Date(m.startTime).getTime() - now.getTime() < 30 * 60_000 ? 'critical' : 'normal',
      actionUrl: m.zoomLink,
      timestamp: m.startTime,
    })
  }

  // Unread messages → WHAT NEEDS YOU
  const totalUnread = (unreadResult as { unread_count: number }[]).reduce((sum, t) => sum + (t.unread_count || 0), 0)
  const unreadInvestors = (unreadResult as { is_investor: boolean; contact_name: string; unread_count: number }[])
    .filter(t => t.is_investor && t.unread_count > 0)
  
  for (const inv of unreadInvestors.slice(0, 3)) {
    needsYou.push({
      id: `unread-inv-${inv.contact_name}`,
      type: 'unread',
      title: `${inv.contact_name} — ${inv.unread_count} unread`,
      urgency: 'high',
    })
  }

  // High-priority emails → WHAT NEEDS YOU
  for (const e of emailsResult as { from_address: string; subject: string; score: number }[]) {
    needsYou.push({
      id: `email-${e.from_address}-${e.subject}`,
      type: 'email',
      title: `${e.subject}`,
      subtitle: `from ${e.from_address} (score: ${e.score})`,
      urgency: e.score >= 9 ? 'critical' : 'high',
    })
  }

  // Overdue tasks → WHAT NEEDS YOU
  const overdueTasks = (tasksResult as { id: string; title: string; priority: number; created_at: string }[])
    .filter(t => t.priority <= 2)
  for (const t of overdueTasks.slice(0, 3)) {
    needsYou.push({
      id: `task-${t.id}`,
      type: 'task',
      title: t.title,
      urgency: t.priority === 1 ? 'critical' : 'high',
    })
  }

  // NORA SUGGESTS
  if (coldInvestorsResult.length > 0) {
    noraSuggests.push(`${coldInvestorsResult.length} investors haven't heard from you in 2+ weeks`)
  }
  if (totalUnread > 10) {
    noraSuggests.push(`You have ${totalUnread} unread messages — want me to summarize?`)
  }
  if (overdueTasks.length > 0) {
    noraSuggests.push(`${overdueTasks.length} high-priority tasks need attention`)
  }
  if (nextUp.length === 0) {
    noraSuggests.push('Clear calendar today — good time for deep work or investor outreach')
  }

  return {
    nextUp,
    needsYou,
    noraSuggests,
    quickStats: {
      unreadMessages: totalUnread,
      meetingsToday: meetings.length,
      openTasks: tasksResult.length,
      overdueItems: overdueTasks.length,
      coldInvestors: coldInvestorsResult.length,
    },
  }
}
