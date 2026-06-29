import { NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { createServiceClient } from '@/lib/supabase/server'
import { client as gmailClient, getMessage, parseFromHeader } from '@/lib/google/gmail'
import { loadTrackedEmails, applyEmailMessage, extractAddresses } from '@/lib/center/email-apply'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Gmail push receiver. Google Pub/Sub POSTs here when g@reprime.com changes.
// IMPORTANT: g@reprime.com is the DEFAULT refresh token (GOOGLE_REFRESH_TOKEN);
// gmail.ts mis-maps the 'g@reprime.com' KEY to the empty GOOGLE_REFRESH_TOKEN_2,
// so every Gmail call here uses the default client (no account arg).
const oauth = new OAuth2Client()

export async function POST(request: Request) {
  // 1) Only Google may call this: verify the OIDC bearer + audience.
  const idToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!idToken) return NextResponse.json({ error: 'no token' }, { status: 401 })
  const audience = process.env.GMAIL_PUSH_AUDIENCE || 'https://project-7e87w.vercel.app/api/center/gmail-push'
  try {
    const ticket = await oauth.verifyIdToken({ idToken, audience })
    const iss = ticket.getPayload()?.iss || ''
    if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') return NextResponse.json({ error: 'bad iss' }, { status: 401 })
  } catch { return NextResponse.json({ error: 'bad token' }, { status: 401 }) }

  // 2) Decode the Pub/Sub envelope → { emailAddress, historyId }.
  let pushedHistoryId: string | null = null
  let emailAddress = 'g@reprime.com'
  try {
    const body = (await request.json()) as { message?: { data?: string } }
    if (body?.message?.data) {
      const d = JSON.parse(Buffer.from(body.message.data, 'base64').toString('utf8')) as { emailAddress?: string; historyId?: string | number }
      if (d.emailAddress) emailAddress = d.emailAddress
      if (d.historyId != null) pushedHistoryId = String(d.historyId)
    }
  } catch { /* keep defaults */ }

  const service = createServiceClient()
  try {
    // 3) Resume from the last processed history id.
    const { data: st } = await service.from('gmail_watch_state').select('history_id').eq('email', emailAddress).limit(1)
    const startHistoryId = st && st[0] && st[0].history_id != null ? String(st[0].history_id) : null
    if (!startHistoryId) {
      if (pushedHistoryId) await service.from('gmail_watch_state').upsert({ email: emailAddress, history_id: pushedHistoryId, updated_at: new Date().toISOString() }, { onConflict: 'email' })
      return NextResponse.json({ ok: true, baseline: pushedHistoryId })
    }

    // 4) Pull the delta (messages added since then). DEFAULT client = reprime.
    const gmail = gmailClient()
    const ids = new Set<string>()
    let pageToken: string | undefined
    try {
      for (let i = 0; i < 10; i++) {
        const res = await gmail.users.history.list({ userId: 'me', startHistoryId, historyTypes: ['messageAdded'], maxResults: 500, pageToken })
        for (const h of res.data.history || []) for (const ma of h.messagesAdded || []) if (ma.message?.id) ids.add(ma.message.id)
        if (!res.data.nextPageToken) break
        pageToken = res.data.nextPageToken
      }
    } catch (e) {
      // 404 → startHistoryId expired (>7d) → re-baseline and move on.
      if ((e as { code?: number }).code === 404) {
        if (pushedHistoryId) await service.from('gmail_watch_state').upsert({ email: emailAddress, history_id: pushedHistoryId, updated_at: new Date().toISOString() }, { onConflict: 'email' })
        return NextResponse.json({ ok: true, rebaselined: true })
      }
      throw e
    }

    // 5) Write each new message touching a roster contact onto the board.
    let applied = 0
    if (ids.size) {
      const byEmail = await loadTrackedEmails(service)
      for (const id of ids) {
        try {
          const msg = await getMessage(id)
          const fromAddr = parseFromHeader(msg.headers['from']).address
          // Match every recipient across To + Cc against the tracked set.
          const recipients = extractAddresses(`${msg.headers['to'] || ''},${msg.headers['cc'] || ''}`)
          const text = ((msg.headers['subject'] ? msg.headers['subject'] + ' — ' : '') + (msg.snippet || '')).slice(0, 500)
          if (await applyEmailMessage(service, byEmail, { fromAddr, recipients, text, at: msg.receivedAt })) applied++
        } catch { /* skip a bad message */ }
      }
    }

    // 6) Advance the cursor to the pushed history id.
    await service.from('gmail_watch_state').upsert({ email: emailAddress, history_id: pushedHistoryId || startHistoryId, updated_at: new Date().toISOString() }, { onConflict: 'email' })
    return NextResponse.json({ ok: true, changed: ids.size, applied })
  } catch (e) {
    // Always 200 so Pub/Sub doesn't retry-storm a transient failure.
    console.error('[gmail-push] error', (e as Error).message)
    return NextResponse.json({ ok: true, error: (e as Error).message.slice(0, 140) })
  }
}
