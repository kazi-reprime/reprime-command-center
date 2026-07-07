/**
 * Cross-System Workflows
 *
 * Orchestrates multi-system operations that span WhatsApp, Email, Zoom, and Nora.
 * Each workflow is a high-level operation that coordinates across the P0 systems.
 */

import { createServiceClient } from '@/lib/supabase/server'

// ── WhatsApp → Nora ────────────────────────────────────────────────────────────

/**
 * Process an inbound WhatsApp message through Nora for context + draft reply.
 * Used by the AI priority classifier in the webhook.
 */
export async function processWhatsAppThroughNora(params: {
  threadId: string
  contactName: string
  messageBody: string
  phone: string
  panel: '305' | '718'
}): Promise<{
  analysis: string
  suggestedReply: string | null
  priority: boolean
  actionItems: string[]
}> {
  try {
    const { gateway } = await import('@/lib/gateway')

    const result = await gateway.generateText({
      messages: [
        {
          role: 'system',
          content: `You are analyzing an inbound WhatsApp message for Gideon at RePrime Group.
Assess priority and suggest a reply if needed.
Respond in JSON: {"analysis":"...","suggestedReply":"...or null","priority":true/false,"actionItems":["..."]}`,
        },
        {
          role: 'user',
          content: `From: ${params.contactName} (${params.phone}, panel: ${params.panel})
Message: ${params.messageBody}`,
        },
      ],
      maxTokens: 500,
      temperature: 0.3,
    })

    const content = result.data?.content || ''
    try {
      const match = content.match(/\{[\s\S]*\}/)
      if (match) return JSON.parse(match[0])
    } catch { /* parse failed */ }

    return {
      analysis: content,
      suggestedReply: null,
      priority: false,
      actionItems: [],
    }
  } catch {
    return { analysis: 'Processing failed', suggestedReply: null, priority: false, actionItems: [] }
  }
}

// ── Email → Nora ───────────────────────────────────────────────────────────────

/**
 * Summarize and contextualize an inbound email for Nora.
 */
export async function processEmailThroughNora(params: {
  from: string
  fromName: string
  subject: string
  body: string
  threadId: string
}): Promise<{
  summary: string
  suggestedReply: string | null
  priority: 'high' | 'medium' | 'low'
  hasCalendarAction: boolean
}> {
  try {
    const { gateway } = await import('@/lib/gateway')

    const result = await gateway.generateText({
      messages: [
        {
          role: 'system',
          content: `Analyze this email for Gideon at RePrime Group. Respond in JSON:
{"summary":"2-3 sentences","suggestedReply":"reply draft or null","priority":"high|medium|low","hasCalendarAction":true/false}`,
        },
        {
          role: 'user',
          content: `From: ${params.fromName} <${params.from}>
Subject: ${params.subject}
Body: ${params.body.slice(0, 3000)}`,
        },
      ],
      maxTokens: 500,
      temperature: 0.3,
    })

    const content = result.data?.content || ''
    try {
      const match = content.match(/\{[\s\S]*\}/)
      if (match) return JSON.parse(match[0])
    } catch { /* parse failed */ }

    return { summary: content, suggestedReply: null, priority: 'medium', hasCalendarAction: false }
  } catch {
    return { summary: 'Processing failed', suggestedReply: null, priority: 'medium', hasCalendarAction: false }
  }
}

// ── Nora → Channels ────────────────────────────────────────────────────────────

/**
 * Execute a Nora instruction to send via the right channel.
 * "Send David a WhatsApp about tomorrow's meeting" → resolve → draft → queue for approval
 */
export async function noraToChannel(params: {
  instruction: string
  sessionId: string
}): Promise<{
  channel: 'whatsapp' | 'email' | 'zoom'
  draft: string
  recipient: string
  pendingActionId?: string
}> {
  const { gateway } = await import('@/lib/gateway')

  // Step 1: Classify channel and extract intent
  const classifyResult = await gateway.generateText({
    messages: [
      {
        role: 'system',
        content: `Classify this instruction. Respond in JSON:
{"channel":"whatsapp|email|zoom","recipient":"name or email","intent":"send|schedule|reply","draftBody":"the message to send"}`,
      },
      { role: 'user', content: params.instruction },
    ],
    maxTokens: 300,
    temperature: 0.2,
  })

  let classified = {
    channel: 'whatsapp' as const,
    recipient: '',
    intent: 'send',
    draftBody: '',
  }
  try {
    const match = (classifyResult.data?.content || '').match(/\{[\s\S]*\}/)
    if (match) classified = { ...classified, ...JSON.parse(match[0]) }
  } catch { /* use defaults */ }

  // Step 2: Queue as pending action
  const supabase = createServiceClient()
  const { data: action } = await supabase
    .from('nora_pending_actions')
    .insert({
      action_type: `${classified.channel}:send`,
      payload: {
        to: classified.recipient,
        body: classified.draftBody,
        subject: classified.intent === 'reply' ? `Re: ${classified.recipient}` : undefined,
      },
      status: 'pending',
    })
    .select('id')
    .single()

  return {
    channel: classified.channel as 'whatsapp' | 'email' | 'zoom',
    draft: classified.draftBody,
    recipient: classified.recipient,
    pendingActionId: (action as { id: string } | null)?.id,
  }
}

// ── Conversation → Meeting ─────────────────────────────────────────────────────

/**
 * When someone says "let's set up a call", check calendar and propose times.
 */
export async function conversationToMeeting(params: {
  contactName: string
  contactEmail?: string
  context: string
}): Promise<{
  availableSlots: string[]
  suggestedDuration: number
  agenda: string
}> {
  try {
    const { getBusyTimes } = await import('@/lib/google/calendar')

    // Check next 5 business days
    const now = new Date()
    const fiveDaysLater = new Date(now.getTime() + 5 * 86400000)
    const busy = await getBusyTimes(now.toISOString(), fiveDaysLater.toISOString())

    // Generate slots (simplified — 30-min slots from 9am-5pm CT)
    const slots: string[] = []
    for (let d = 1; d <= 5; d++) {
      const day = new Date(now.getTime() + d * 86400000)
      if (day.getDay() === 0 || day.getDay() === 6) continue // Skip weekends

      for (let h = 9; h < 17; h++) {
        const slotStart = new Date(day)
        slotStart.setHours(h, 0, 0, 0)
        const slotEnd = new Date(slotStart.getTime() + 30 * 60000)

        const isBusy = busy.some(
          b => slotStart.getTime() < b.end && slotEnd.getTime() > b.start,
        )
        if (!isBusy) {
          slots.push(slotStart.toISOString())
          if (slots.length >= 6) break
        }
      }
      if (slots.length >= 6) break
    }

    return {
      availableSlots: slots,
      suggestedDuration: 30,
      agenda: `Meeting with ${params.contactName}: ${params.context.slice(0, 200)}`,
    }
  } catch {
    return { availableSlots: [], suggestedDuration: 30, agenda: '' }
  }
}

// ── Meeting → Tasks ────────────────────────────────────────────────────────────

/**
 * Convert meeting action items into bucket tasks.
 */
export async function meetingToTasks(params: {
  meetingId: string
  topic: string
  actionItems: Array<{ description: string; assignee?: string; priority?: string }>
}): Promise<{ created: number; taskIds: string[] }> {
  const supabase = createServiceClient()
  const taskIds: string[] = []

  for (const item of params.actionItems) {
    const priority = item.priority === 'high' ? 1 : item.priority === 'low' ? 5 : 3
    const { data, error } = await supabase
      .from('bucket_items')
      .insert({
        title: `[${params.topic}] ${item.description}`,
        priority,
        source_type: 'zoom',
        status: 'open',
      })
      .select('id')
      .single()

    if (!error && data) {
      taskIds.push((data as { id: string }).id)
    }
  }

  return { created: taskIds.length, taskIds }
}

// ── Zoom → Follow-ups ──────────────────────────────────────────────────────────

/**
 * After a meeting ends, generate and queue follow-up drafts.
 */
export async function meetingToFollowUps(params: {
  meetingId: string
  topic: string
  summary: string
  attendees: string[]
}): Promise<{ queued: number }> {
  if (!params.attendees.length || !params.summary) return { queued: 0 }

  const { gateway } = await import('@/lib/gateway')

  const result = await gateway.generateText({
    messages: [
      {
        role: 'system',
        content: `Generate follow-up email drafts for each attendee after this meeting.
Return JSON array: [{"to":"email","subject":"...","body":"..."}]`,
      },
      {
        role: 'user',
        content: `Meeting: ${params.topic}\nSummary: ${params.summary}\nAttendees: ${params.attendees.join(', ')}`,
      },
    ],
    maxTokens: 1500,
    temperature: 0.5,
  })

  let drafts: Array<{ to: string; subject: string; body: string }> = []
  try {
    const content = result.data?.content || ''
    const match = content.match(/\[[\s\S]*\]/)
    if (match) drafts = JSON.parse(match[0])
  } catch { /* parse failed */ }

  // Queue as pending actions
  const supabase = createServiceClient()
  for (const draft of drafts) {
    await supabase.from('nora_pending_actions').insert({
      action_type: 'email:send',
      payload: draft,
      status: 'pending',
    })
  }

  return { queued: drafts.length }
}
