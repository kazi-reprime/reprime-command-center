/**
 * Nora Context Builder — Centralized context for every Nora interaction.
 *
 * Every Nora UI surface (NoraFloating, NoraDeskColumn, VoiceShell, Command
 * Palette) calls `buildNoraContext()` to construct a consistent context
 * payload that is sent alongside the user message to /api/nora/chat.
 *
 * This ensures Nora always knows:
 * - What page/route the user is on
 * - What thread/email/meeting is selected
 * - Current notification & unread counts
 * - Language preference
 * - Active tasks
 */

import { useStore } from '@/lib/store/useStore'

const MAX_CONTEXT_BYTES = 4096

export interface NoraContext {
  /** Current route path */
  route: string
  /** Active page in the cockpit sidebar */
  activeTab: string
  /** Currently selected WhatsApp thread (if any) */
  selectedThread: {
    id: string
    contactName?: string
    phone?: string
    panel?: string
  } | null
  /** Language preference */
  language: 'EN' | 'HE'
  /** Unread counts */
  unreads: {
    whatsapp: number
    email: number
    notifications: number
  }
  /** Active tasks summary */
  activeTasks: number
  /** Current time (ISO) */
  timestamp: string
  /** Calendar alert (Shabbat, Yom Tov, etc.) */
  hebcalAlert: string | null
}

/**
 * Build Nora's live context from the shared Zustand store + browser state.
 * Called client-side before every Nora API call.
 */
export function buildNoraContext(): NoraContext {
  const state = useStore.getState()

  // Get selected thread details
  let selectedThread: NoraContext['selectedThread'] = null
  if (state.selectedThreadId) {
    const thread = state.threads.find(t => t.id === state.selectedThreadId)
    if (thread) {
      selectedThread = {
        id: thread.id,
        contactName: thread.contactName,
        phone: thread.contactPhone,
        panel: thread.panel,
      }
    }
  }

  // Count unreads
  const whatsappUnreads = Object.values(state.unreadCounts).reduce((a, b) => a + b, 0)
  const unreadNotifications = state.notifications.filter(n => !n.read).length
  const unreadEmails = state.emails.length // Email type doesn't track read status

  // Count active tasks
  const activeTasks = state.tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length

  const context: NoraContext = {
    route: typeof window !== 'undefined' ? window.location.pathname : '/cockpit',
    activeTab: state.activeTab,
    selectedThread,
    language: state.language,
    unreads: {
      whatsapp: whatsappUnreads,
      email: unreadEmails,
      notifications: unreadNotifications,
    },
    activeTasks,
    timestamp: new Date().toISOString(),
    hebcalAlert: state.hebcalAlert,
  }

  return context
}

/**
 * Serialize context for the API, truncating to stay within budget.
 */
export function serializeNoraContext(context: NoraContext): string {
  const json = JSON.stringify(context)
  if (json.length > MAX_CONTEXT_BYTES) {
    return json.slice(0, MAX_CONTEXT_BYTES)
  }
  return json
}
