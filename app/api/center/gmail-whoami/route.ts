import { NextResponse } from 'next/server'
import { centerAuthed } from '@/lib/center/auth'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

// Read-only check: which mailbox does each refresh-token env var actually
// authenticate as? Settles the GOOGLE_REFRESH_TOKEN vs _2 mislabel before we
// arm a Gmail watch on the wrong account.
async function whoFor(envVar: string) {
  const token = process.env[envVar]
  if (!token || !token.trim()) return { envVar, set: false, email: null }
  try {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET)
    auth.setCredentials({ refresh_token: token })
    const gmail = google.gmail({ version: 'v1', auth })
    const r = await gmail.users.getProfile({ userId: 'me' })
    return { envVar, set: true, email: r.data.emailAddress || null, historyId: r.data.historyId || null }
  } catch (e) { return { envVar, set: true, email: null, error: (e as Error).message.slice(0, 140) } }
}

export async function GET(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const [t1, t2] = await Promise.all([whoFor('GOOGLE_REFRESH_TOKEN'), whoFor('GOOGLE_REFRESH_TOKEN_2')])
  return NextResponse.json({ GOOGLE_REFRESH_TOKEN: t1, GOOGLE_REFRESH_TOKEN_2: t2 })
}
