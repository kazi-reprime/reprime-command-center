import { createServiceClient } from '@/lib/supabase/server'

// Shared email→board write logic, used by BOTH the Gmail push handler and the
// (legacy) email-watch cron, so they can't drift. Records an email onto the
// matching roster contact: inbound flags "awaiting you", outbound clears it,
// both append to the contact's thread so the secretary sees the full exchange.

export type EmailRC = { source_row: number; board_stage: string | null; last_reply_at: string | null; thread_json: string | null }

// Our own sending addresses — an email FROM one of these is OUTBOUND.
export const OURS = new Set(['g@reprime.com', 'g@floridastatetrust.com', 'g@reprime-terminal.com'])

export const fmtDate = (iso: string) => { try { return new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(iso)) } catch { return '' } }

export function pushThread(tj: string | null, who: string, text: string, at: string): string {
  let arr: Array<{ who: string; date: string; text: string; via?: string }> = []
  try { arr = tj ? JSON.parse(tj) : [] } catch { arr = [] }
  arr.push({ who, date: fmtDate(at), text: text.slice(0, 400), via: 'email' })
  if (arr.length > 40) arr = arr.slice(-40)
  return JSON.stringify(arr)
}

export async function loadRosterByEmail(service: ReturnType<typeof createServiceClient>): Promise<Map<string, EmailRC>> {
  const { data } = await service.from('roster').select('source_row, email, board_stage, last_reply_at, thread_json')
  const m = new Map<string, EmailRC>()
  for (const r of (data || []) as Array<EmailRC & { email: string | null }>) {
    if (r.email) m.set(r.email.toLowerCase().trim(), r)
  }
  return m
}

// Load the FULL tracked-address map from roster_emails (one person may own
// several addresses). Returns email → the person's board row. Multiple emails
// for the same person share ONE EmailRC reference, so newest-wins works across
// all of a person's addresses. This is the source of truth for gmail-push
// matching — it covers every address, not just roster.email.
export async function loadTrackedEmails(service: ReturnType<typeof createServiceClient>): Promise<Map<string, EmailRC>> {
  const { data: links } = await service.from('roster_emails').select('email, source_row')
  const rows = (links || []) as Array<{ email: string; source_row: number }>
  const m = new Map<string, EmailRC>()
  const srcRows = [...new Set(rows.map((l) => l.source_row))]
  if (!srcRows.length) return m
  const { data: rs } = await service.from('roster').select('source_row, board_stage, last_reply_at, thread_json').in('source_row', srcRows)
  const bySrc = new Map<number, EmailRC>()
  for (const r of (rs || []) as EmailRC[]) bySrc.set(r.source_row, r)
  for (const l of rows) {
    const rc = bySrc.get(l.source_row)
    if (rc && l.email) m.set(l.email.toLowerCase().trim(), rc)
  }
  return m
}

// Pull every email address out of a header value (To/Cc/From), whether wrapped
// in <angle brackets> with a display name or bare. Lowercased + de-duped.
export function extractAddresses(headerValue: string | undefined): string[] {
  if (!headerValue) return []
  const out = new Set<string>()
  const re = /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi
  let mm: RegExpExecArray | null
  while ((mm = re.exec(headerValue)) !== null) out.add(mm[0].toLowerCase())
  return [...out]
}

// Apply one email to the board. Mutates the in-memory RC (last_reply_at + thread)
// so a batch processes newest-wins correctly. Returns true if a row was updated.
// Matches the message against EVERY tracked address: inbound on From, outbound
// on every To/Cc recipient.
export async function applyEmailMessage(
  service: ReturnType<typeof createServiceClient>,
  byEmail: Map<string, EmailRC>,
  m: { fromAddr: string; recipients: string[]; text: string; at: string },
): Promise<boolean> {
  const nowIso = new Date().toISOString()
  const fromAddr = (m.fromAddr || '').toLowerCase().trim()
  const recips = (m.recipients || []).map((x) => (x || '').toLowerCase().trim()).filter(Boolean)
  const text = (m.text || '').slice(0, 500)
  const at = m.at || nowIso

  // OUTBOUND: sent from one of our own addresses. Clear "awaiting you" on every
  // tracked recipient (To + Cc) — one email can address several investors.
  if (OURS.has(fromAddr)) {
    let any = false
    const done = new Set<number>()
    for (const to of recips) {
      const rc = byEmail.get(to)
      if (!rc || done.has(rc.source_row)) continue
      done.add(rc.source_row)
      if (rc.last_reply_at && at <= rc.last_reply_at) continue
      const tj = pushThread(rc.thread_json, 'us', text, at)
      await service.from('roster').update({ awaiting_us: false, last_from: 'us', last_reply_text: text, last_reply_at: at, thread_json: tj, updated_at: nowIso }).eq('source_row', rc.source_row)
      rc.last_reply_at = at; rc.thread_json = tj
      any = true
    }
    return any
  }

  // INBOUND: sent from a tracked contact → flag "awaiting you".
  const r = byEmail.get(fromAddr)
  if (!r) return false
  if (r.last_reply_at && at <= r.last_reply_at) return false
  const tj = pushThread(r.thread_json, 'them', text, at)
  const upd: Record<string, unknown> = { awaiting_us: true, last_from: 'them', last_reply_text: text, last_reply_at: at, thread_json: tj, updated_at: nowIso }
  if (r.board_stage !== 'booked' && r.board_stage !== 'declined') upd.board_stage = 'replied'
  await service.from('roster').update(upd).eq('source_row', r.source_row)
  r.last_reply_at = at; r.thread_json = tj
  return true
}
