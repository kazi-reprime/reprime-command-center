/**
 * useWhatsAppRealtime — Live WhatsApp thread updates via Supabase Realtime
 *
 * Subscribes to whatsapp_messages and whatsapp_threads for live updates.
 * Returns current threads, unread counts, and auto-refreshes on new messages.
 */

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface WhatsAppThread {
  id: string
  contact_name: string | null
  phone: string
  panel: '305' | '718'
  channel_type: string
  is_investor: boolean
  is_staff: boolean
  is_family: boolean
  unread_count: number
  last_message_at: string | null
  last_message_preview: string | null
  is_priority: boolean
}

interface UnreadCounts {
  '305': number
  '718': number
  investors: number
  total: number
}

export function useWhatsAppRealtime(panel?: '305' | '718') {
  const [threads, setThreads] = useState<WhatsAppThread[]>([])
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({
    '305': 0,
    '718': 0,
    investors: 0,
    total: 0,
  })
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())

  const fetchThreads = useCallback(async () => {
    const supabase = supabaseRef.current
    let query = supabase
      .from('whatsapp_threads')
      .select('id, contact_name, phone, panel, channel_type, is_investor, is_staff, is_family, unread_count, last_message_at, last_message_preview, is_priority')
      .order('last_message_at', { ascending: false })
      .limit(50)

    if (panel) {
      query = query.eq('panel', panel)
    }

    const { data, error } = await query
    if (!error && data) {
      setThreads(data as unknown as WhatsAppThread[])

      // Compute unread counts
      const counts: UnreadCounts = { '305': 0, '718': 0, investors: 0, total: 0 }
      for (const t of data as unknown as WhatsAppThread[]) {
        const uc = t.unread_count || 0
        if (t.is_investor && uc > 0) {
          counts.investors += uc
        } else if (t.panel === '305') {
          counts['305'] += uc
        } else if (t.panel === '718') {
          counts['718'] += uc
        }
      }
      counts.total = counts['305'] + counts['718'] + counts.investors
      setUnreadCounts(counts)
    }
    setLoading(false)
  }, [panel])

  useEffect(() => {
    fetchThreads()

    // Subscribe to real-time changes on whatsapp_messages
    const supabase = supabaseRef.current
    const channel = supabase
      .channel('whatsapp-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        () => {
          // Refresh threads when a new message arrives
          fetchThreads()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_threads',
        },
        () => {
          fetchThreads()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchThreads])

  const markRead = useCallback(async (threadId: string) => {
    const supabase = supabaseRef.current
    await supabase
      .from('whatsapp_threads')
      .update({ unread_count: 0 })
      .eq('id', threadId)
    fetchThreads()
  }, [fetchThreads])

  return {
    threads,
    unreadCounts,
    loading,
    refresh: fetchThreads,
    markRead,
  }
}
