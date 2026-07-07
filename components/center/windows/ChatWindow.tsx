'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import MessageView from '@/components/chat/MessageView'
import ReplyBox from '@/components/chat/ReplyBox'
import type { DashboardMessage, DashboardThread, Panel } from '@/lib/timelines/types'

type Props = {
  threadId: string
  panel?: Panel
  name?: string
}

/**
 * ChatWindow — WindowManager renderer for general contact chats.
 * 
 * Fetches thread details and messages for a given threadId, allowing
 * Gideon to communicate with non-investor contacts (staff, family)
 * inside the Command Center's windowing system.
 */
export default function ChatWindow({ threadId, panel = '305' }: Props) {
  const queryClient = useQueryClient()
  const [thread, setThread] = useState<DashboardThread | null>(null)

  // 1. Fetch thread details if not provided or to ensure fresh data
  const { data: threadsData, isLoading: loadingThreads } = useQuery({
    queryKey: ['chat-threads', panel],
    queryFn: async (): Promise<DashboardThread[]> => {
      const res = await fetch(`/api/whatsapp/threads?panel=${panel}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      return json.threads || []
    },
    staleTime: 60_000,
  })

  useEffect(() => {
    if (threadsData) {
      const match = threadsData.find(t => t.id === threadId)
      if (match) setThread(match)
    }
  }, [threadsData, threadId])

  // 2. Fetch messages for this thread
  const { data: messages } = useQuery({
    queryKey: ['messages', threadId],
    enabled: !!threadId,
    queryFn: async (): Promise<DashboardMessage[]> => {
      const res = await fetch(`/api/whatsapp/messages?thread_id=${threadId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      return json.messages || []
    },
    refetchInterval: 10_000, // Frequent refresh for active chat
  })

  // Optimistic message handling
  const onOptimistic = useCallback((m: DashboardMessage) => {
    queryClient.setQueryData<DashboardMessage[]>(['messages', threadId], (prev) => [
      ...(prev || []),
      m,
    ])
  }, [queryClient, threadId])

  const onStatus = useCallback((tempId: string, status: 'ok' | 'fail', real?: DashboardMessage) => {
    queryClient.setQueryData<DashboardMessage[]>(['messages', threadId], (prev) => {
      if (!prev) return prev
      if (status === 'ok' && real) return prev.map((m) => (m.id === tempId ? real : m))
      return prev.map((m) => (m.id === tempId ? { ...m, status: 'Failed' } : m))
    })
    if (status === 'ok') {
      queryClient.invalidateQueries({ queryKey: ['chat-threads', panel] })
    }
  }, [queryClient, threadId, panel])

  if (loadingThreads && !thread) {
    return (
      <div style={{ padding: 24, color: '#9DB3D6', fontSize: 12, textAlign: 'center' }}>
        Initialising secure channel...
      </div>
    )
  }

  if (!thread) {
    // If we can't find the thread in the panel list, try a fallback stub
    return (
      <div style={{ padding: 24, color: '#9DB3D6', fontSize: 12 }}>
        <div style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>Channel not found</div>
        Thread ID: {threadId}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <MessageView thread={thread} messages={messages || []} />
      </div>
      <div style={{ padding: '0 24px 24px', background: '#fff' }}>
        <ReplyBox 
          panel={thread.panel} 
          threadId={thread.id} 
          threadHistory={messages || []}
          contact={{ name: thread.contact_name, phone: thread.phone }}
          onOptimistic={onOptimistic}
          onStatus={onStatus}
        />
      </div>
    </div>
  )
}
