import { createServiceClient } from '@/lib/supabase/server'

export type OutboundAskChannel = 'email' | 'whatsapp' | 'imessage' | 'sms'

const REPLY_WINDOW_HOURS: Record<OutboundAskChannel, number> = {
  email: 48,
  whatsapp: 24,
  imessage: 24,
  sms: 24,
}

function clip(text: string | null | undefined, max = 280): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed) return null
  return trimmed.length > max ? trimmed.slice(0, max - 1) + '…' : trimmed
}

export interface RecordOutboundAskInput {
  senderIdentity?: string
  recipientIdentifier: string
  channel: OutboundAskChannel
  body?: string | null
  relatedThreadId?: string | null
  sentAt?: Date
  /** Override default reply window (hours from sentAt). */
  replyWindowHours?: number
}

/**
 * Insert one outbound_asks row. Non-fatal: any DB error is logged and
 * swallowed so the calling send path is never blocked by Secretary
 * bookkeeping.
 */
export async function recordOutboundAsk(input: RecordOutboundAskInput): Promise<void> {
  const sentAt = input.sentAt ?? new Date()
  const windowH = input.replyWindowHours ?? REPLY_WINDOW_HOURS[input.channel]
  const expected = new Date(sentAt.getTime() + windowH * 60 * 60 * 1000)

  try {
    const service = createServiceClient()
    const { error } = await service.from('outbound_asks').insert({
      sender_identity: input.senderIdentity ?? 'g@reprime.com',
      recipient_identifier: input.recipientIdentifier,
      channel: input.channel,
      body: clip(input.body),
      sent_at: sentAt.toISOString(),
      expected_reply_by: expected.toISOString(),
      related_thread_id: input.relatedThreadId ?? null,
      status: 'open',
    })
    if (error) {
      console.error('[secretary] insert outbound_ask failed', {
        channel: input.channel,
        recipient: input.recipientIdentifier,
        message: error.message,
      })
    }
  } catch (err) {
    console.error('[secretary] insert outbound_ask threw', {
      channel: input.channel,
      recipient: input.recipientIdentifier,
      message: (err as Error).message,
    })
  }
}

export interface MarkAskRepliedInput {
  channel: OutboundAskChannel
  recipientIdentifier: string
  responseMessageId?: string | null
  /** Window for matching open asks. Default 7 days. */
  lookbackDays?: number
}

/**
 * When an inbound message arrives, find the most recent open ask to the same
 * recipient on the same channel within the lookback window and mark it
 * replied. Non-fatal — webhook write must not depend on this.
 */
export async function markAskReplied(input: MarkAskRepliedInput): Promise<void> {
  const lookback = input.lookbackDays ?? 7
  const since = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000).toISOString()

  try {
    const service = createServiceClient()
    const { data: open, error: selErr } = await service
      .from('outbound_asks')
      .select('id')
      .eq('status', 'open')
      .eq('channel', input.channel)
      .eq('recipient_identifier', input.recipientIdentifier)
      .gte('sent_at', since)
      .order('sent_at', { ascending: false })
      .limit(1)

    if (selErr) {
      console.error('[secretary] match-on-reply select failed', {
        channel: input.channel,
        recipient: input.recipientIdentifier,
        message: selErr.message,
      })
      return
    }

    const target = open?.[0]
    if (!target) return

    const { error: updErr } = await service
      .from('outbound_asks')
      .update({
        status: 'replied',
        response_message_id: input.responseMessageId ?? null,
        closed_at: new Date().toISOString(),
      })
      .eq('id', target.id)

    if (updErr) {
      console.error('[secretary] mark-replied update failed', {
        ask_id: target.id,
        message: updErr.message,
      })
    }
  } catch (err) {
    console.error('[secretary] markAskReplied threw', {
      channel: input.channel,
      recipient: input.recipientIdentifier,
      message: (err as Error).message,
    })
  }
}
