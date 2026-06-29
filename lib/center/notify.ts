import { sendChatMessage } from '@/lib/timelines/client'

// One place to push a short nudge to the "Terminal invitations" WhatsApp group.
// Best-effort: a failed nudge must never break the action that triggered it.
const ALERT_CHAT_ID = Number(process.env.CENTER_ALERT_CHAT_ID || '56184407')

export async function notifyGroup(text: string): Promise<void> {
  try {
    await sendChatMessage(ALERT_CHAT_ID, text)
  } catch (e) {
    console.warn('[center.notify] group nudge failed:', (e as Error).message)
  }
}
