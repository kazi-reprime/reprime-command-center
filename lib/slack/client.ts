/**
 * Minimal Slack incoming-webhook poster.
 *
 * Reads SLACK_WEBHOOK_URL from env. If absent, postSlack returns
 * { sent: false, reason: 'no_webhook' } so callers can no-op cleanly
 * without throwing.
 *
 * Used by /api/cron/slack-digest to drop the 8am CT daily digest into
 * Gideon's Slack. Webhook URL is treated as a secret — never logged,
 * never returned in API responses.
 */

export interface SlackPostResult {
  sent: boolean
  reason?: string
  status?: number
}

export interface SlackPayload {
  text: string
  /** Optional Block Kit blocks. If provided, Slack renders these and `text` becomes the fallback. */
  blocks?: unknown[]
  /** Optional display username override (not always honored — depends on workspace settings). */
  username?: string
  /** Optional emoji icon override. */
  icon_emoji?: string
}

export async function postSlack(payload: SlackPayload): Promise<SlackPostResult> {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) {
    return { sent: false, reason: 'no_webhook' }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      return { sent: false, reason: `http_${res.status}`, status: res.status }
    }
    return { sent: true, status: res.status }
  } catch (err) {
    return { sent: false, reason: `fetch_failed: ${(err as Error).message}` }
  }
}
