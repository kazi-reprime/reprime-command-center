/**
 * Nora Session Manager — Persistent Conversations
 *
 * - Loads/saves conversation sessions to Supabase
 * - Manages conversation memory via vector search
 * - Contact-specific memory recall
 * - Session history trimming for context window management
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { AgentMessage } from './types'

export interface NoraSession {
  sessionId: string
  messages: AgentMessage[]
  contactContext?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

const MAX_HISTORY_TURNS = 20

/**
 * Load a session from the database, or create a new one.
 */
export async function loadSession(sessionId: string): Promise<NoraSession> {
  const supabase = createServiceClient()

  // Load recent chat messages for this session
  const { data: messages } = await supabase
    .from('nora_chat_messages')
    .select('role, content, language, created_at')
    .order('created_at', { ascending: true })
    .limit(MAX_HISTORY_TURNS * 2) // user + assistant pairs

  const history: AgentMessage[] = (messages || []).map(
    (m: { role: string; content: string; created_at: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.created_at,
    }),
  )

  return {
    sessionId,
    messages: history.slice(-MAX_HISTORY_TURNS * 2),
    createdAt: history[0]?.timestamp || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Save a conversation turn to the session.
 */
export async function saveSessionTurn(
  sessionId: string,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  const supabase = createServiceClient()
  const HEBREW_RE = /[א-ת]/
  const userLang = HEBREW_RE.test(userMessage) ? 'he' : 'en'
  const replyLang = HEBREW_RE.test(assistantReply) ? 'he' : 'en'

  try {
    await supabase.from('nora_chat_messages').insert([
      { role: 'user', content: userMessage, language: userLang },
      { role: 'assistant', content: assistantReply, language: replyLang },
    ])
  } catch (err) {
    console.error('[session] save turn failed', (err as Error).message)
  }

  // Persist to vector memory (best-effort)
  try {
    const { getEmbedding } = await import('@/lib/embeddings')
    const embedding = await getEmbedding(`${userMessage}\n\nAssistant: ${assistantReply}`)
    const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'
    await supabase.from('nora_memory').insert({
      org_id: DEFAULT_ORG_ID,
      content: `User: ${userMessage}\nAssistant: ${assistantReply}`,
      embedding,
    })
  } catch {
    // Memory persistence is best-effort
  }
}

/**
 * Recall relevant memories for a given query using vector search.
 */
export async function recallMemory(query: string, limit = 5): Promise<string[]> {
  try {
    const { getEmbedding } = await import('@/lib/embeddings')
    const embedding = await getEmbedding(query)
    const supabase = createServiceClient()

    const { data } = await supabase.rpc('match_nora_memory', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: limit,
    })

    return (data || []).map(
      (m: { content: string; similarity: number }) => m.content,
    )
  } catch {
    return []
  }
}

/**
 * Get context about a specific contact from past interactions.
 */
export async function getContactMemory(
  contactName: string,
): Promise<{ memories: string[]; lastInteraction: string | null }> {
  try {
    const memories = await recallMemory(`conversation with ${contactName}`, 3)
    return {
      memories: memories.filter(m =>
        m.toLowerCase().includes(contactName.toLowerCase()),
      ),
      lastInteraction: null, // Could query nora_chat_messages
    }
  } catch {
    return { memories: [], lastInteraction: null }
  }
}
