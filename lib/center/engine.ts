// Command Center send engine. Ports the proven _batch_send.cjs pipeline:
// fresh day-spread slots -> mint/refresh invite -> WhatsApp (305, dedup) ->
// email (Gmail g@reprime.com, dedup) -> result. Used by the cron drain.
import { google } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/server'
import { emailLikelyWrongPerson } from '@/lib/center/email-name-check'

const ACCT_305 = '+13057784861'
const VIDEO = 'https://youtu.be/1tFycgsst1c'
// Per-recipient tracked video link → /v/<inviteId> logs the watch then 302s to
// the video. Served on the branded domain (excluded from the reprime.com
// redirect in vercel.json, same as /invite).
const videoLink = (inviteId: string) => `https://reprime-terminal.com/v/${inviteId}`
const TL = () => process.env.TIMELINES_API_KEY!
const APP = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://project-7e87w.vercel.app').replace(/\/$/, '')
const INVITE_BASE = 'https://reprime-terminal.com/invite/'

export interface Slot { iso: string; display: string; label: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function tlFetch(url: string, opts: RequestInit): Promise<Response> {
  const waits = [20000, 40000, 70000]
  for (let i = 0; i <= waits.length; i++) {
    const r = await fetch(url, opts)
    if (r.status !== 429) return r
    if (i === waits.length) return r
    await sleep(waits[i])
  }
  return fetch(url, opts)
}

export function firstName(name: string): string {
  const n = (name || '').trim()
  if (/capital|group|partners|office|fund|holdings|prizma/i.test(n) && !/ /.test(n.split(' ')[0])) return ''
  const t = n.split(/[ &(]/)[0]
  return t && t.length > 1 ? t : ''
}

// 3 suggested slots spread across 3 distinct non-Friday days, varied times.
export async function daySpreadSlots(): Promise<Slot[]> {
  const j = await (await fetch(`${APP()}/api/bookings/available-slots`, { cache: 'no-store' })).json()
  const groups = (j.slots || []).filter((g: { label: string; times: unknown[] }) => !/Friday/.test(g.label) && g.times.length)
  const wants = ['5:', '7:', '8:']
  const picks: Slot[] = []
  for (let i = 0; i < groups.length && picks.length < 3; i++) {
    const g = groups[i]
    const w = wants[picks.length]
    const t = g.times.find((x: { display: string }) => x.display.startsWith(w)) || g.times[Math.floor(g.times.length / 2)]
    picks.push({ iso: t.iso, display: t.display, label: g.label })
  }
  return picks
}

function noteText(greet: string, xref: string): string {
  return greet + ', כאן גדעון גרציאני מאיווה. נפגשנו בישראל. אני והצוות שלי ב‑RePrime בנינו יחד משהו שאני מאמין שיחולל מהפכה בנדל״ן המסחרי בארה״ב. אשמח להראות לך. שלחתי לך הזמנה אישית — בחר מועד שנוח לך לזום.' + xref
}

export function inviteEmailHtml(name: string, link: string, slots: Slot[], videoUrl: string = VIDEO): string {
  const greet = firstName(name) ? 'היי ' + firstName(name) : 'שלום'
  const note = noteText(greet, ' שלחתי לך גם הודעה בוואטסאפ.')
  const slotRow = (s: Slot) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr><td style="border:1px solid #6b5a1f; padding:14px 20px; text-align:center;"><a href="${link}?slot=${encodeURIComponent(s.iso)}" style="text-decoration:none; display:block;"><span style="font-family:'Playfair Display',Georgia,serif; font-size:19px; color:#FFCC33;">${s.label}</span><br><span style="font-family:'Poppins',Arial,sans-serif; font-size:14px; color:#FFCC33; letter-spacing:1px;">${s.display}</span></a></td></tr></table>`
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Poppins:wght@400;600&family=Cinzel:wght@600&family=EB+Garamond:ital@1&display=swap" rel="stylesheet"></head><body style="margin:0; padding:0; background:#DDD9D2;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#DDD9D2;"><tr><td align="center" style="padding:40px 20px;"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px; max-width:560px; background:#0E3470; border:1px solid #6b5a1f;"><tr><td style="padding:24px 48px; text-align:center; border-bottom:1px solid #5a4d22;"><div style="height:2px; background:#FFCC33; width:70%; margin:0 auto 14px;"></div><div style="font-family:'Cinzel',Georgia,serif; font-size:26px; letter-spacing:5px; color:#FFCC33; font-weight:600;">TERMINAL</div><div style="height:2px; background:#FFCC33; width:70%; margin:14px auto 0;"></div></td></tr><tr><td style="padding:34px 48px 22px; text-align:center;"><div style="font-family:'Poppins',Arial,sans-serif; font-size:10px; letter-spacing:4px; color:#FFCC33; font-weight:600; text-transform:uppercase;">PRIVATE&nbsp;&nbsp;INTRODUCTION</div><div style="font-family:'Playfair Display',Georgia,serif; font-size:46px; color:#FFCC33; font-weight:600; line-height:1.05; padding-top:14px;">${name}</div></td></tr><tr><td style="padding:0 48px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3E9CC; border:1px solid #d8c79a;"><tr><td style="padding:24px 28px; text-align:center;"><div style="font-family:'Playfair Display',Georgia,serif; font-size:13px; font-style:italic; color:#7A5A30; padding-bottom:12px;">A personal note from <span style="font-weight:600; color:#5A3F18;">Gideon Gratsiani</span></div><div dir="rtl" style="font-family:Arial,'Helvetica Neue',sans-serif; font-size:16px; color:#0E3470; line-height:1.85;">${note}</div><div style="padding-top:16px;"><a href="${videoUrl}" style="font-family:'Poppins',Arial,sans-serif; font-size:12px; letter-spacing:1px; color:#5A3F18; text-decoration:underline; font-weight:600;">&#9658;&nbsp;A short look from the inside &middot; 4 min</a></div></td></tr></table></td></tr><tr><td style="padding:24px 48px; text-align:center; border-top:1px solid #5a4d22; border-bottom:1px solid #5a4d22;"><div style="font-family:'Playfair Display',Georgia,serif; font-size:26px; font-style:italic; color:#FFCC33;">Private Membership</div><div style="width:5px; height:5px; background:#FFCC33; border-radius:50%; margin:13px auto; font-size:0; line-height:0;">&nbsp;</div><div style="font-family:'Playfair Display',Georgia,serif; font-size:34px; font-style:italic; color:#FFCC33;">By Invitation Only</div></td></tr><tr><td style="padding:28px 48px 0;"><div style="font-family:'Poppins',Arial,sans-serif; font-size:11px; letter-spacing:3px; color:#FFCC33; text-transform:uppercase; font-weight:600; text-align:center; padding-bottom:16px;">SUGGESTED TIMES &mdash; ISRAEL &amp; CENTRAL</div>${slots.map(slotRow).join('')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border:1px solid #6b5a1f; padding:14px 20px; text-align:center;"><a href="${link}/choose" style="text-decoration:none; display:block;"><span style="font-family:'Poppins',Arial,sans-serif; font-size:11px; letter-spacing:2px; color:#FFCC33; text-transform:uppercase; font-weight:600;">DIFFERENT TIME?</span><br><span style="font-family:'Playfair Display',Georgia,serif; font-size:24px; color:#FFCC33;">Choose your own date and time &rarr;</span></a></td></tr></table></td></tr><tr><td style="padding:18px 48px 26px; text-align:center;"><div style="font-family:'Poppins',Arial,sans-serif; font-size:11px; color:#d9c071; line-height:1.8;">One click schedules your Zoom &middot; Bring anyone from your side</div></td></tr><tr><td style="padding:22px 48px; text-align:center; border-top:1px solid #5a4d22;"><div style="font-family:'Playfair Display',Georgia,serif; font-size:16px; color:#FFCC33; font-weight:600; letter-spacing:2px;">TERMINAL</div><div style="font-family:'EB Garamond',Georgia,serif; font-style:italic; font-size:13px; color:#d9c071; padding-top:4px;">by RePrime</div></td></tr></table></td></tr></table></body></html>`
}

function gmail() {
  const a = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET)
  a.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth: a })
}
const b64url = (b: string | Buffer) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const encSub = (s: string) => '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?='

async function emailAlreadySent(email: string): Promise<boolean> {
  try {
    const r = await gmail().users.messages.list({ userId: 'me', q: `to:${email} subject:"Terminal Introduction" newer_than:3d in:sent`, maxResults: 1 })
    return (r.data.resultSizeEstimate || 0) > 0 || !!(r.data.messages && r.data.messages.length > 0)
  } catch { return false }
}

async function emailSend(name: string, email: string, link: string, slots: Slot[], videoUrl: string): Promise<string> {
  const cc = 'shirel@reprime.com, tahisa@reprime.com'
  const headers = [`From: Gideon Gratsiani <g@reprime.com>`, `To: ${email}`, `Cc: ${cc}`, `Subject: ${encSub('Terminal Introduction — ' + (firstName(name) || name))}`, 'MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64'].join('\r\n')
  const raw = b64url(headers + '\r\n\r\n' + Buffer.from(inviteEmailHtml(name, link, slots, videoUrl), 'utf8').toString('base64'))
  const r = await gmail().users.messages.send({ userId: 'me', requestBody: { raw } })
  return r.data.id || 'sent'
}

async function waAlreadyIntroduced(phone: string): Promise<boolean> {
  const cr = await tlFetch(`https://app.timelines.ai/integrations/api/chats?phone=${encodeURIComponent(phone)}&whatsapp_account_phone=${encodeURIComponent(ACCT_305)}`, { headers: { Authorization: 'Bearer ' + TL() } })
  const cj = await cr.json()
  const dig = phone.replace(/\D/g, '').slice(-9)
  const chat = ((cj.data && cj.data.chats) || []).find((c: { phone?: string }) => (c.phone || '').replace(/\D/g, '').includes(dig))
  if (!chat) return false
  const mr = await tlFetch(`https://app.timelines.ai/integrations/api/chats/${chat.id}/messages`, { headers: { Authorization: 'Bearer ' + TL() } })
  const mj = await mr.json()
  return ((mj.data && mj.data.messages) || []).some((m: { from_me?: boolean; text?: string }) => m.from_me && /גדעון גרציאני|reprime-terminal\.com\/invite/i.test(m.text || ''))
}

async function waSend(phone: string, text: string): Promise<void> {
  const r = await tlFetch('https://app.timelines.ai/integrations/api/messages', { method: 'POST', headers: { Authorization: 'Bearer ' + TL(), 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, text, whatsapp_account_phone: ACCT_305 }) })
  if (!r.ok) throw new Error('WA ' + r.status + ' ' + (await r.text()).slice(0, 120))
}

// The WhatsApp invite goes out as a real PHOTO of the navy card — WhatsApp's
// link-preview render is non-deterministic and can't be forced large, but a
// photo always shows big. Two-step Timelines flow: upload the card PNG to
// /files_upload (multipart) → get file_uid → send /messages with file_uid +
// caption (the pitch + booking link). See memory canonical_invite_buildout.
async function uploadCard(cardUrl: string): Promise<string | null> {
  try {
    const img = await fetch(cardUrl, { cache: 'no-store' })
    if (!img.ok) return null
    const buf = Buffer.from(await img.arrayBuffer())
    if (buf.length < 1000) return null
    const fd = new FormData()
    fd.append('file', new Blob([buf], { type: 'image/png' }), 'terminal.png')
    fd.append('filename', 'terminal.png')
    const r = await tlFetch('https://app.timelines.ai/integrations/api/files_upload', { method: 'POST', headers: { Authorization: 'Bearer ' + TL() }, body: fd })
    if (!r.ok) return null
    const j = (await r.json()) as { data?: { uid?: string } }
    return j?.data?.uid || null
  } catch { return null }
}
async function waSendCard(phone: string, fileUid: string, caption: string): Promise<void> {
  const r = await tlFetch('https://app.timelines.ai/integrations/api/messages', { method: 'POST', headers: { Authorization: 'Bearer ' + TL(), 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, whatsapp_account_phone: ACCT_305, text: caption, file_uid: fileUid }) })
  if (!r.ok) throw new Error('WA-card ' + r.status + ' ' + (await r.text()).slice(0, 120))
}

/** Process ONE queued invitation row: refresh slots, WhatsApp + email, return a result note. */
export async function processInvite(inv: { id: string; contact_name: string | null; contact_first_name: string | null; contact_email: string | null; contact_phone: string | null }): Promise<string> {
  const supabase = createServiceClient()
  const name = inv.contact_name || inv.contact_first_name || 'there'
  // GHOST-MEETING GUARD — never send the email to a HIGH-risk audit row.
  // WhatsApp can still go (different person, different channel + visible to
  // Gideon), but the email-with-calendar-invite would otherwise land in the
  // wrong inbox (Ilit/Doron class of bug).
  let blockEmail = false
  try {
    const { data: f } = await supabase.from('invitations').select('email_audit_flag').eq('id', inv.id).maybeSingle()
    if ((f as { email_audit_flag?: string } | null)?.email_audit_flag === 'high') blockEmail = true
  } catch { /* no flag known — proceed */ }
  // Auto-detect the wrong-person email (e.g. "Nadav Goldman" → pazit.goldman@…).
  // Don't email a stranger's inbox; hold the email, raise a 'review' flag for the
  // secretary, and let WhatsApp (the investor's own phone) carry the invite.
  if (!blockEmail && emailLikelyWrongPerson(inv.contact_first_name || inv.contact_name, inv.contact_email)) {
    blockEmail = true
    try { await supabase.from('invitations').update({ email_audit_flag: 'review' }).eq('id', inv.id).is('email_audit_flag', null) } catch { /* flag best-effort */ }
  }
  const slots = await daySpreadSlots()
  await supabase.from('invitations').update({ proposed_slots: slots.map((s) => ({ iso: s.iso, display: s.display })) }).eq('id', inv.id)
  const link = INVITE_BASE + inv.id
  const waLink = `${APP()}/invite/${inv.id}` // project-7e87w serves the OG card for WhatsApp
  const video = videoLink(inv.id)
  // Pre-render the OG card to static storage BEFORE sending so WhatsApp's first
  // crawl is an instant CDN fetch → big navy card (a cold dynamic render gets
  // skipped → small thumbnail). Best-effort; the dynamic route still works.
  try { await fetch(`${APP()}/api/center/warm-card`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: inv.id }) }) } catch { /* card still renders dynamically */ }
  const parts: string[] = []
  // WhatsApp
  if (inv.contact_phone) {
    try {
      if (await waAlreadyIntroduced(inv.contact_phone)) parts.push('WA:skip-already')
      else {
        const fn = firstName(name); const greet = fn ? 'היי ' + fn : 'שלום'
        const caption = noteText(greet, inv.contact_email ? ' שלחתי לך גם מייל.' : '') + '\n' + waLink
        // Send the big navy CARD as a photo; fall back to text+link only if the upload fails.
        const fileUid = await uploadCard(`${APP()}/invite/${inv.id}/opengraph-image`)
        if (fileUid) { await waSendCard(inv.contact_phone, fileUid, caption); parts.push('WA:card') }
        else { await waSend(inv.contact_phone, caption); parts.push('WA:text') }
        await sleep(2500)
        await waSend(inv.contact_phone, 'והנה הצצה קצרה מבפנים:\n' + video)
        parts.push('WA:video')
      }
    } catch (e) { parts.push('WA:FAIL ' + (e as Error).message.slice(0, 60)) }
  }
  // Email
  if (inv.contact_email) {
    if (blockEmail) { parts.push('EM:BLOCKED-audit'); }
    else {
      try {
        if (await emailAlreadySent(inv.contact_email)) parts.push('EM:skip-already')
        else { await emailSend(name, inv.contact_email, link, slots, video); parts.push('EM:sent') }
      } catch (e) { parts.push('EM:FAIL ' + (e as Error).message.slice(0, 60)) }
    }
  }
  return parts.join(' | ') || 'no-channel'
}
