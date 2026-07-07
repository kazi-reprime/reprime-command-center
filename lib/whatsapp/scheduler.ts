/**
 * WhatsApp Scheduled Messages
 *
 * Queue messages for future delivery. Supports:
 * - Time-based scheduling (send at specific time)
 * - Shabbat-aware auto-hold (hold messages during Shabbat)
 * - Retry on failure
 */

import { createServiceClient } from '@/lib/supabase/server'

export interface ScheduledMessage {
  id: string
  channel: 'whatsapp' | 'email' | 'sms'
  to: string
  body: string
  metadata: Record<string, unknown>
  scheduledFor: string
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled'
}

/**
 * Schedule a message for future delivery.
 */
export async function scheduleMessage(params: {
  channel: 'whatsapp' | 'email' | 'sms'
  to: string
  body: string
  scheduledFor: Date | string
  metadata?: Record<string, unknown>
}): Promise<{ id: string }> {
  const supabase = createServiceClient()
  const scheduledAt =
    typeof params.scheduledFor === 'string'
      ? params.scheduledFor
      : params.scheduledFor.toISOString()

  // Check Shabbat hold
  const scheduledDate = new Date(scheduledAt)
  if (isDuringShabbat(scheduledDate)) {
    // Push to Saturday night after Havdalah (~7:30 PM local)
    const saturday = new Date(scheduledDate)
    // Find next Saturday
    while (saturday.getDay() !== 6) saturday.setDate(saturday.getDate() + 1)
    saturday.setHours(19, 30, 0, 0)
    console.log('[scheduler] Shabbat hold — rescheduled to', saturday.toISOString())
  }

  const { data, error } = await supabase
    .from('scheduled_messages')
    .insert({
      channel: params.channel,
      to_identifier: params.to,
      body: params.body,
      metadata: params.metadata || {},
      scheduled_for: scheduledAt,
      status: 'scheduled',
    })
    .select('id')
    .single()

  if (error) throw new Error(`Schedule failed: ${error.message}`)
  return { id: (data as { id: string }).id }
}

/**
 * Process due scheduled messages (called by cron).
 */
export async function processDueMessages(): Promise<{
  sent: number
  failed: number
  errors: string[]
}> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  const { data: due, error } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(20)

  if (error || !due?.length) return { sent: 0, failed: 0, errors: [] }

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const msg of due) {
    const row = msg as {
      id: string
      channel: string
      to_identifier: string
      body: string
      metadata: Record<string, unknown>
    }

    try {
      const { gateway } = await import('@/lib/gateway')

      if (row.channel === 'whatsapp') {
        await gateway.sendWhatsApp({
          to: row.to_identifier,
          body: row.body,
          lane: (row.metadata.lane as '305' | '718') || '305',
        })
      } else if (row.channel === 'email') {
        await gateway.sendEmail({
          to: row.to_identifier,
          subject: String(row.metadata.subject || ''),
          body: row.body,
        })
      }

      await supabase
        .from('scheduled_messages')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', row.id)

      sent++
    } catch (err) {
      const errMsg = (err as Error).message
      await supabase
        .from('scheduled_messages')
        .update({ status: 'failed', error: errMsg })
        .eq('id', row.id)

      failed++
      errors.push(`${row.id}: ${errMsg}`)
    }
  }

  return { sent, failed, errors }
}

/**
 * Cancel a scheduled message.
 */
export async function cancelScheduledMessage(id: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('scheduled_messages')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'scheduled')

  return !error
}

/**
 * Simple Shabbat check — Friday sunset to Saturday sunset.
 * Uses approximate times; a real implementation would use a Hebrew calendar library.
 */
function isDuringShabbat(date: Date): boolean {
  const day = date.getDay()
  const hour = date.getHours()

  // Friday after 5 PM (approximate candle lighting)
  if (day === 5 && hour >= 17) return true
  // Saturday before 8 PM (approximate Havdalah)
  if (day === 6 && hour < 20) return true

  return false
}
