import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/sendgrid/client'
import { recordOutboundAsk } from '@/lib/secretary/outbound-asks'
import { configuredAccounts } from '@/lib/google/gmail'

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type SendBody = {
  to?: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject?: string
  body?: string
  html?: string
  // Mailbox this reply belongs to (the account of the email being replied to).
  // The reply is sent "from" this mailbox when it is a configured account;
  // otherwise we fall back to the default configured mailbox.
  account?: string
}

// Pick the reply-from mailbox: the requested account when it's configured,
// else the first configured account, else the legacy default. Never throws.
function resolveReplyFrom(requested: string | undefined): string {
  const accounts = configuredAccounts()
  const want = (requested || '').trim().toLowerCase()
  if (want) {
    const match = accounts.find((a) => a.email.toLowerCase() === want)
    if (match) return match.email
  }
  if (accounts.length > 0) return accounts[0].email
  return ALLOWED_EMAIL
}

function dedupeEmails(value: string | string[] | undefined): string[] {
  if (!value) return []
  const arr = Array.isArray(value) ? value : value.split(/[,;\s]+/)
  return Array.from(
    new Set(arr.map((e) => (e || '').trim().toLowerCase()).filter(Boolean))
  )
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    // Kiosk mode: allow unauthenticated access for Command Center
  }

  // Roster lock 2026-05-05 / Wave 1 Track F:
  // Send-as is restricted to Gideon (`g@reprime.com`) in v1. The IdentityPicker
  // exposes 5 other team members as view-only; if any of them somehow reach
  // this endpoint, reject with 403 before SendGrid is touched. Default to
  // Gideon when the header is absent so legacy clients keep working.
  const activeIdentity = (
    request.headers.get('x-active-identity') || ALLOWED_EMAIL
  )
    .trim()
    .toLowerCase()
  console.log(`[email/send] X-Active-Identity=${activeIdentity}`)
  if (activeIdentity !== ALLOWED_EMAIL) {
    return NextResponse.json(
      { error: 'send-as locked to g@reprime.com in v1' },
      { status: 403 }
    )
  }

  let body: SendBody
  try { body = (await request.json()) as SendBody }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const to = dedupeEmails(body.to)
  if (to.length === 0) {
    return NextResponse.json({ error: 'to_required' }, { status: 400 })
  }
  const invalid = to.filter((e) => !EMAIL_RE.test(e))
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: 'invalid_email', message: `Bad email(s): ${invalid.join(', ')}` },
      { status: 400 }
    )
  }

  const subject = (body.subject || '').trim()
  if (!subject) {
    return NextResponse.json({ error: 'subject_required' }, { status: 400 })
  }

  const text = (body.body || '').trim()
  const html = body.html?.trim() || undefined
  if (!text && !html) {
    return NextResponse.json({ error: 'body_required' }, { status: 400 })
  }

  const cc = dedupeEmails(body.cc)
  const bcc = dedupeEmails(body.bcc)
  const from = process.env.SENDGRID_FROM_EMAIL || 'g@reprime-terminal.com'
  // Replies surface as coming from the mailbox the email belongs to (so a reply
  // to a g@floridastatetrust.com thread answers from that address). Falls back
  // to the configured default when the requested mailbox isn't configured.
  const replyTo = resolveReplyFrom(body.account)

  try {
    await sendEmail({
      to,
      cc: cc.length > 0 ? cc : undefined,
      bcc: bcc.length > 0 ? bcc : undefined,
      from,
      replyTo,
      subject,
      text: text || undefined,
      html,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'send_failed', message: (err as Error).message },
      { status: 502 }
    )
  }

  // Secretary: record one outbound ask per primary recipient. Email window=48h.
  // CC/BCC excluded — the ask is "to" the primary thread. Non-fatal.
  const askBody = subject ? `${subject}\n\n${text || ''}`.trim() : text || undefined
  await Promise.all(
    to.map((recipient) =>
      recordOutboundAsk({
        senderIdentity: activeIdentity,
        recipientIdentifier: recipient,
        channel: 'email',
        body: askBody,
      })
    )
  )

  return NextResponse.json({
    ok: true,
    sent_to: to,
    cc: cc.length > 0 ? cc : undefined,
    bcc: bcc.length > 0 ? bcc : undefined,
  })
}
