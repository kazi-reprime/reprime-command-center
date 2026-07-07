/**
 * Zoom Meeting Intelligence Pipeline
 *
 * Processes meeting recordings and transcripts to generate:
 * - AI summaries
 * - Action items
 * - Follow-up drafts
 * - Unanswered question detection
 * - Attendance verification
 */

import { createServiceClient } from '@/lib/supabase/server'

export interface MeetingIntelligence {
  meetingId: string
  topic: string
  summary: string
  actionItems: ActionItem[]
  followUps: FollowUp[]
  keyDecisions: string[]
  unansweredQuestions: string[]
  attendance: AttendanceRecord
}

export interface ActionItem {
  description: string
  assignee: string | null
  deadline: string | null
  priority: 'high' | 'medium' | 'low'
}

export interface FollowUp {
  contact: string
  channel: 'email' | 'whatsapp' | 'call'
  draft: string
  reason: string
}

export interface AttendanceRecord {
  expected: string[]
  attended: string[]
  noShow: string[]
  duration: number // minutes
}

/**
 * Process a meeting transcript and generate intelligence.
 */
export async function processMeetingIntelligence(params: {
  meetingId: string
  topic: string
  transcript: string
  attendees: string[]
  participants: Array<{ name: string; email?: string; duration?: number }>
}): Promise<MeetingIntelligence> {
  const { gateway } = await import('@/lib/gateway')

  // Generate AI summary + action items from transcript
  const aiResult = await gateway.generateText({
    messages: [
      {
        role: 'system',
        content: `You are analyzing a meeting transcript for Gideon Gratsiani at RePrime Group (commercial real estate investment). Extract:

1. **Summary**: 3-5 sentence overview of what was discussed
2. **Action Items**: Specific tasks with assignee if mentioned, formatted as JSON array
3. **Key Decisions**: Major decisions made
4. **Unanswered Questions**: Questions raised but not resolved
5. **Follow-up Suggestions**: Who to follow up with, via which channel, and a draft message

Respond in JSON format:
{
  "summary": "...",
  "actionItems": [{"description": "...", "assignee": "...", "deadline": null, "priority": "high|medium|low"}],
  "keyDecisions": ["..."],
  "unansweredQuestions": ["..."],
  "followUps": [{"contact": "...", "channel": "email|whatsapp|call", "draft": "...", "reason": "..."}]
}`,
      },
      {
        role: 'user',
        content: `Meeting: ${params.topic}\n\nTranscript:\n${params.transcript.slice(0, 12000)}`,
      },
    ],
    maxTokens: 2000,
    temperature: 0.3,
  })

  let parsed: Partial<MeetingIntelligence> = {}
  try {
    const content = aiResult.data?.content || ''
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/```json?\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
    }
  } catch {
    parsed = { summary: aiResult.data?.content || 'Processing failed' }
  }

  // Compute attendance
  const attendedNames = params.participants
    .filter(p => (p.duration || 0) > 60) // More than 1 minute
    .map(p => p.name)

  const attendance: AttendanceRecord = {
    expected: params.attendees,
    attended: attendedNames,
    noShow: params.attendees.filter(
      a => !attendedNames.some(n => n.toLowerCase().includes(a.split('@')[0].toLowerCase())),
    ),
    duration: Math.max(...params.participants.map(p => p.duration || 0), 0),
  }

  const intelligence: MeetingIntelligence = {
    meetingId: params.meetingId,
    topic: params.topic,
    summary: String(parsed.summary || ''),
    actionItems: Array.isArray(parsed.actionItems)
      ? parsed.actionItems.map((a: Partial<ActionItem>) => ({
          description: String(a.description || ''),
          assignee: a.assignee || null,
          deadline: a.deadline || null,
          priority: (['high', 'medium', 'low'].includes(String(a.priority))
            ? a.priority
            : 'medium') as 'high' | 'medium' | 'low',
        }))
      : [],
    followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
    keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions : [],
    unansweredQuestions: Array.isArray(parsed.unansweredQuestions) ? parsed.unansweredQuestions : [],
    attendance,
  }

  // Persist to database
  await saveMeetingIntelligence(intelligence)

  return intelligence
}

/**
 * Save meeting intelligence to Supabase.
 */
async function saveMeetingIntelligence(intel: MeetingIntelligence): Promise<void> {
  const supabase = createServiceClient()

  try {
    // Upsert meeting record
    await supabase.from('zoom_meetings').upsert(
      {
        zoom_id: intel.meetingId,
        topic: intel.topic,
        summary: intel.summary,
        action_items: intel.actionItems,
        key_decisions: intel.keyDecisions,
        unanswered_questions: intel.unansweredQuestions,
        follow_ups: intel.followUps,
        attendance: intel.attendance,
        processed_at: new Date().toISOString(),
      },
      { onConflict: 'zoom_id' },
    )

    // Create bucket items for action items
    for (const item of intel.actionItems.filter(a => a.priority === 'high')) {
      await supabase.from('bucket_items').insert({
        title: `[Meeting] ${item.description}`,
        priority: item.priority === 'high' ? 1 : 3,
        source_type: 'zoom',
        status: 'open',
      })
    }
  } catch (err) {
    console.error('[meeting-intelligence] save failed', (err as Error).message)
  }
}

/**
 * Generate a pre-meeting brief.
 */
export async function generatePreMeetingBrief(params: {
  topic: string
  attendees: string[]
  startTime: string
}): Promise<{
  brief: string
  attendeeContext: Array<{ email: string; name?: string; role?: string; lastInteraction?: string }>
}> {
  const supabase = createServiceClient()
  const attendeeContext: Array<{
    email: string
    name?: string
    role?: string
    lastInteraction?: string
  }> = []

  for (const email of params.attendees.slice(0, 8)) {
    // Look up in contacts
    const { data: contact } = await supabase
      .from('contacts')
      .select('name, company, is_investor')
      .eq('email', email)
      .single()

    if (contact) {
      const c = contact as { name: string; company: string | null; is_investor: boolean }
      attendeeContext.push({
        email,
        name: c.name,
        role: c.is_investor ? 'Investor' : (c.company || undefined),
      })
    } else {
      attendeeContext.push({ email })
    }

    // Check for prior meetings
    const { data: priorMeetings } = await supabase
      .from('zoom_meetings')
      .select('topic, summary, processed_at')
      .ilike('topic', `%${email.split('@')[0]}%`)
      .order('processed_at', { ascending: false })
      .limit(1)

    if (priorMeetings?.length) {
      const last = attendeeContext.find(a => a.email === email)
      if (last) {
        last.lastInteraction = (priorMeetings[0] as { processed_at: string }).processed_at
      }
    }
  }

  const brief = [
    `**Meeting**: ${params.topic}`,
    `**Time**: ${new Date(params.startTime).toLocaleString('en-US', { timeZone: 'America/Chicago' })}`,
    `**Attendees**: ${attendeeContext.map(a => a.name || a.email).join(', ')}`,
    '',
    attendeeContext
      .filter(a => a.name)
      .map(
        a =>
          `- **${a.name}** (${a.email}): ${a.role || 'Contact'}${a.lastInteraction ? `, last meeting: ${a.lastInteraction}` : ''}`,
      )
      .join('\n'),
  ].join('\n')

  return { brief, attendeeContext }
}
