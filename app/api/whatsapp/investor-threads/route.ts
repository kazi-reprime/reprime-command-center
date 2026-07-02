import { NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import type { ChannelType, Panel } from '@/lib/timelines/types'

export const dynamic = 'force-dynamic'

const MESSAGE_LIMIT = 200
const PER_GROUP_MAX = 5

export type InvestorMessage = {
  id: string
  thread_id: string
  panel: Panel
  channel_type: ChannelType
  direction: 'in' | 'out'
  body: string | null
  sent_at: string | null
  status: string | null
  is_unread: boolean
}

export type InvestorGroup = {
  phone: string
  contact_name: string | null
  panel: Panel
  channel_type: ChannelType
  messages: InvestorMessage[]
}

type ThreadRow = {
  id: string
  panel: Panel
  channel_type: ChannelType
  phone: string
  contact_name: string | null
  last_message_at: string | null
}

type MessageRow = {
  id: string
  thread_id: string
  direction: 'in' | 'out'
  body: string | null
  sent_at: string | null
  status: string | null
}

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== 'g@reprime.com') {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  const service = createServiceClient()

  // Find threads tagged with any is_investor tag.
  const { data: tagJoins, error: joinErr } = await service
    .from('thread_tags')
    .select('thread_id, tags!inner(is_investor)')
    .eq('tags.is_investor', true)

  if (joinErr) {
    return NextResponse.json(
      { error: 'db_join_failed', message: joinErr.message },
      { status: 500 }
    )
  }

  const investorThreadIds = Array.from(
    new Set(((tagJoins as { thread_id: string }[] | null) || []).map((r) => r.thread_id))
  )

  if (investorThreadIds.length === 0) {
    return NextResponse.json({ groups: [] as InvestorGroup[] })
  }

  const { data: threadRows, error: threadErr } = await service
    .from('whatsapp_threads')
    .select('id, panel, channel_type, phone, contact_name, last_message_at')
    .in('id', investorThreadIds)

  if (threadErr) {
    return NextResponse.json(
      { error: 'db_select_threads_failed', message: threadErr.message },
      { status: 500 }
    )
  }

  const threads = (threadRows as ThreadRow[] | null) || []
  if (threads.length === 0) {
    return NextResponse.json({ groups: [] as InvestorGroup[] })
  }
  const threadById = new Map(threads.map((t) => [t.id, t]))

  const { data: messageRows, error: msgErr } = await service
    .from('whatsapp_messages')
    .select('id, thread_id, direction, body, sent_at, status')
    .in('thread_id', investorThreadIds)
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(MESSAGE_LIMIT)

  if (msgErr) {
    return NextResponse.json(
      { error: 'db_select_messages_failed', message: msgErr.message },
      { status: 500 }
    )
  }

  const messages = (messageRows as MessageRow[] | null) || []

  // Group by phone (cross-channel aggregation), capping per-group preview length.
  const byPhone = new Map<string, InvestorGroup>()

  for (const m of messages) {
    const t = threadById.get(m.thread_id)
    if (!t) continue
    const phone = t.phone
    let group = byPhone.get(phone)
    if (!group) {
      group = {
        phone,
        contact_name: t.contact_name,
        panel: t.panel,
        channel_type: t.channel_type,
        messages: [],
      }
      byPhone.set(phone, group)
    }
    if (group.messages.length < PER_GROUP_MAX) {
      const isUnread =
        m.direction === 'in' && (m.status === null || m.status?.toLowerCase() !== 'read')
      group.messages.push({
        id: m.id,
        thread_id: m.thread_id,
        panel: t.panel,
        channel_type: t.channel_type,
        direction: m.direction,
        body: m.body,
        sent_at: m.sent_at,
        status: m.status,
        is_unread: isUnread,
      })
    }
  }

  // For groups whose threads exist but have no recent messages, still include the group.
  for (const t of threads) {
    if (!byPhone.has(t.phone)) {
      byPhone.set(t.phone, {
        phone: t.phone,
        contact_name: t.contact_name,
        panel: t.panel,
        channel_type: t.channel_type,
        messages: [],
      })
    }
  }

  const groups = Array.from(byPhone.values()).sort((a, b) => {
    const aLast = a.messages[0]?.sent_at ? new Date(a.messages[0].sent_at).getTime() : 0
    const bLast = b.messages[0]?.sent_at ? new Date(b.messages[0].sent_at).getTime() : 0
    return bLast - aLast
  })

  return NextResponse.json({ groups })
}
