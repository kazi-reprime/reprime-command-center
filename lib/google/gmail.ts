import { google, type gmail_v1 } from 'googleapis'

/**
 * Minimal Gmail wrapper that reuses the existing GOOGLE_REFRESH_TOKEN
 * established for Calendar (see lib/google/calendar.ts). Adding the
 * https://www.googleapis.com/auth/gmail.readonly scope to the existing
 * OAuth client is a one-time consent step Gideon performs in the Google
 * account chooser; if the API call returns 403/insufficient_scope the
 * caller surfaces "needs consent" to the UI.
 */

/**
 * Multi-account registry. Each mailbox maps to its real email and the env var
 * holding its refresh token. NEVER hardcode a token value — only the env var
 * NAME lives here. NOTE (verified 2026-06-24 via users.getProfile): the default
 * GOOGLE_REFRESH_TOKEN actually authenticates as **g@reprime.com** — the mailbox
 * that sent the 209 invitations — NOT g@floridastatetrust.com. The 'fst' key name
 * + email below are legacy/misleading; the token is reprime. GOOGLE_REFRESH_TOKEN_2
 * is currently UNSET, so the 'reprime' key resolves to an empty token — never use
 * the email-keyed lookup for reprime; use the default client (no account arg).
 */
export type GmailAccountKey = 'fst' | 'reprime'

export type GmailAccount = {
  key: GmailAccountKey
  email: string
  refreshTokenEnvVar: string
}

export const GMAIL_ACCOUNTS: Record<GmailAccountKey, GmailAccount> = {
  fst: {
    key: 'fst',
    email: 'g@floridastatetrust.com',
    refreshTokenEnvVar: 'GOOGLE_REFRESH_TOKEN',
  },
  reprime: {
    key: 'reprime',
    email: 'g@reprime.com',
    refreshTokenEnvVar: 'GOOGLE_REFRESH_TOKEN_2',
  },
}

// Backward-compatible default: the original single mailbox.
const DEFAULT_ACCOUNT_KEY: GmailAccountKey = 'fst'

/** Resolve an account from a key, an email, or undefined (→ default). */
function resolveAccount(account?: GmailAccountKey | string): GmailAccount {
  if (!account) return GMAIL_ACCOUNTS[DEFAULT_ACCOUNT_KEY]
  const byKey = GMAIL_ACCOUNTS[account as GmailAccountKey]
  if (byKey) return byKey
  const lower = account.toLowerCase()
  for (const acc of Object.values(GMAIL_ACCOUNTS)) {
    if (acc.email.toLowerCase() === lower) return acc
  }
  return GMAIL_ACCOUNTS[DEFAULT_ACCOUNT_KEY]
}

/**
 * Accounts whose refresh-token env var is set and non-empty. Used by the sync
 * route to loop only over mailboxes that are actually configured. When only
 * one token is present, behavior matches the original single-account flow.
 */
export function configuredAccounts(): GmailAccount[] {
  return Object.values(GMAIL_ACCOUNTS).filter((acc) => {
    const token = process.env[acc.refreshTokenEnvVar]
    return typeof token === 'string' && token.trim().length > 0
  })
}

function getAuthClient(account?: GmailAccountKey | string) {
  const acc = resolveAccount(account)
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  )
  auth.setCredentials({ refresh_token: process.env[acc.refreshTokenEnvVar] })
  return auth
}

/** Gmail API client bound to a specific mailbox (key or email; default 'fst'). */
export function client(account?: GmailAccountKey | string): gmail_v1.Gmail {
  return google.gmail({ version: 'v1', auth: getAuthClient(account) })
}

export type GmailListItem = {
  id: string
  threadId: string
}

/**
 * List recent message metadata for the active mailbox. days defaults to 7.
 * Returns the message + thread ids only — call getMessage for headers.
 */
export async function listRecent(
  accountEmail?: GmailAccountKey | string,
  days = 7,
): Promise<GmailListItem[]> {
  const gmail = client(accountEmail)
  const after = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)
  // Skip Trash/Spam; everything else (Inbox + categories) is fair game.
  const q = `after:${after} -in:trash -in:spam`
  const out: GmailListItem[] = []
  let pageToken: string | undefined
  // Cap at 500 messages per sync to keep cron under Vercel's 60s budget.
  const MAX = 500
  for (let safety = 0; safety < 10 && out.length < MAX; safety++) {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults: 100,
      pageToken,
    })
    const msgs = res.data.messages ?? []
    for (const m of msgs) {
      if (m.id && m.threadId) out.push({ id: m.id, threadId: m.threadId })
    }
    if (!res.data.nextPageToken) break
    pageToken = res.data.nextPageToken
  }
  return out.slice(0, MAX)
}

export type GmailMessage = {
  id: string
  threadId: string
  /** Lowercase header name → first value. */
  headers: Record<string, string>
  snippet: string
  /** Gmail's internalDate as ISO. */
  receivedAt: string
  /** True when Gmail labels include IMPORTANT. */
  important: boolean
  /** True when Gmail labels include UNREAD. */
  unread: boolean
  /** Best-effort detection of an attached calendar invite. */
  hasICS: boolean
}

function lowerHeaderMap(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const h of headers ?? []) {
    if (!h.name || !h.value) continue
    const k = h.name.toLowerCase()
    // First occurrence wins; matches the typical "first header" convention.
    if (!(k in out)) out[k] = h.value
  }
  return out
}

function detectICS(payload: gmail_v1.Schema$MessagePart | undefined): boolean {
  if (!payload) return false
  const mt = (payload.mimeType || '').toLowerCase()
  if (mt.startsWith('text/calendar') || mt === 'application/ics') return true
  if (payload.filename && /\.ics$/i.test(payload.filename)) return true
  for (const p of payload.parts ?? []) {
    if (detectICS(p)) return true
  }
  return false
}

/** Fetch one message's headers + flags. Uses metadata format for speed. */
export async function getMessage(
  messageId: string,
  accountEmail?: GmailAccountKey | string,
): Promise<GmailMessage> {
  const gmail = client(accountEmail)
  // Need full to detect ICS in parts. metadata-format omits parts.
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  })
  const data = res.data
  const headers = lowerHeaderMap(data.payload?.headers)
  const labels = data.labelIds ?? []
  const internalDateMs = data.internalDate ? Number(data.internalDate) : Date.now()
  return {
    id: data.id || messageId,
    threadId: data.threadId || messageId,
    headers,
    snippet: data.snippet || '',
    receivedAt: new Date(internalDateMs).toISOString(),
    important: labels.includes('IMPORTANT'),
    unread: labels.includes('UNREAD'),
    hasICS: detectICS(data.payload || undefined),
  }
}

/**
 * Parse a "From" header (`"Name" <addr@host>` or just `addr@host`) into
 * { name, address }. Lowercases the address.
 */
export function parseFromHeader(value: string | undefined): {
  name: string
  address: string
} {
  if (!value) return { name: '', address: '' }
  const angle = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (angle) {
    return {
      name: angle[1].trim(),
      address: angle[2].trim().toLowerCase(),
    }
  }
  return { name: '', address: value.trim().toLowerCase() }
}

/** Standard "insufficient scope" detection. */
export function isInsufficientScopeError(err: unknown): boolean {
  const e = err as { code?: number; message?: string; errors?: Array<{ reason?: string }> }
  if (!e) return false
  if (e.code === 403 || e.code === 401) {
    const msg = (e.message || '').toLowerCase()
    if (msg.includes('insufficient') || msg.includes('scope')) return true
  }
  for (const it of e.errors ?? []) {
    if ((it.reason || '').toLowerCase() === 'insufficientpermissions') return true
  }
  return false
}
