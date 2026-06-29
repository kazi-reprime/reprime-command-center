import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { getPerson } from '@/lib/pipedrive/client'
import { sendEmail } from '@/lib/sendgrid/client'
import { buildTerminalInvitationEmail } from '@/lib/email/templates/terminal-invitation'
import { buildGeneralMeetingEmail } from '@/lib/email/templates/general-meeting'
import { getChats, sendMessage, PANEL_ACCOUNT_MAP } from '@/lib/timelines/client'
import { normalizePhone } from '@/lib/timelines/normalize-phone'
import type { Panel } from '@/lib/timelines/types'

// Required table (run once in Supabase SQL editor):
//   CREATE TABLE IF NOT EXISTS invitations (
//     id uuid PRIMARY KEY,
//     contact_pipedrive_id integer,
//     contact_first_name text,
//     contact_name text,
//     contact_email text,
//     contact_phone text,
//     proposed_slots jsonb,
//     status text DEFAULT 'sent',
//     confirmed_slot_iso text,
//     zoom_meeting_id text,
//     zoom_join_url text,
//     calendar_event_id text,
//     created_at timestamptz DEFAULT now(),
//     expires_at timestamptz DEFAULT (now() + interval '14 days')
//   );

export const dynamic = 'force-dynamic'

const ALLOWED_EMAIL = 'g@reprime.com'
const FROM_EMAIL = 'g@reprime-terminal.com'
const REPLY_TO = 'g@reprime.com'

type ChannelOption = 'whatsapp_718' | 'whatsapp_305' | 'email'
type Channel = ChannelOption | 'all'   // legacy single-value shape

type MeetingType = 'terminal' | 'meeting'

interface SendInvitationBody {
  contact: number
  /** New multi-select format — any subset of channels */
  channels?: ChannelOption[]
  /** Legacy single-value format — kept for backwards compat */
  channel?: Channel
  meeting_type?: MeetingType
  slots?: string[]
  /** Optional personal note from Gideon — prepended to email and used as full WhatsApp body */
  personal_message?: string
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://project-7e87w.vercel.app'
  ).replace(/\/$/, '')
}

function formatSlotDisplay(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const fmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  })
  return `${fmt.format(d)} Central`
}

function buildWhatsAppCopy(
  firstName: string,
  inviteUrl: string,
  meetingType: MeetingType,
  personalMessage?: string
): string {
  // Captain hotfix 2026-05-20: URL must be the LAST line with no text after.
  // WhatsApp's auto-preview engine places the OG card at the END of the
  // message bubble when the URL is the trailing element — which puts the
  // recipient's eye on Gideon's typed text FIRST, then the gold preview
  // card BELOW. Previously the URL sat in the middle with "— Gideon" after,
  // which pushed the preview to the top and the text below.
  if (personalMessage) {
    return `${personalMessage}\n\n— Gideon\n\n${inviteUrl}`
  }
  if (meetingType === 'meeting') {
    return `${firstName} — I'd value some time with you. 30 minutes, your schedule.\n\n— Gideon\n\n${inviteUrl}`
  }
  return `${firstName} — built a deal-sourcing machine I want to walk you through. 30 minutes.\n\n— Gideon\n\n${inviteUrl}`
}

async function findChatIdForPhone(panel: Panel, phone: string): Promise<number | null> {
  const target = (phone ?? '').replace(/\D/g, '')
  if (!target) return null
  for (let page = 1; page <= 5; page++) {
    const chats = await getChats(panel, page)
    if (chats.length === 0) return null
    // Timelines returns chats with null/undefined phone for some system entries
    // and groups — guard before calling .replace() on each, otherwise the
    // iteration crashes before reaching the actual match.
    const match = chats.find(
      (c) => !c.is_group && typeof c.phone === 'string' && c.phone.replace(/\D/g, '') === target
    )
    if (match) return match.id
  }
  return null
}

function pickPrimary(values: Array<{ value: string; primary: boolean }> | null | undefined): string | null {
  if (!values || values.length === 0) return null
  const primary = values.find((v) => v.primary && v.value)
  return (primary?.value || values[0]?.value || null) as string | null
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: SendInvitationBody
  try {
    body = (await request.json()) as SendInvitationBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!Number.isInteger(body.contact) || body.contact <= 0) {
    return NextResponse.json({ error: 'contact_required' }, { status: 400 })
  }

  // Resolve effective channel set — accept either new `channels[]` or legacy `channel`
  const VALID_OPTIONS: ChannelOption[] = ['whatsapp_718', 'whatsapp_305', 'email']
  let channelSet: Set<ChannelOption>
  if (Array.isArray(body.channels) && body.channels.length > 0) {
    const valid = body.channels.filter((c) => VALID_OPTIONS.includes(c))
    if (valid.length === 0) {
      return NextResponse.json({ error: 'invalid_channels' }, { status: 400 })
    }
    channelSet = new Set(valid)
  } else if (body.channel) {
    // Legacy single-value → expand 'all' to everything
    if (!['whatsapp_718', 'whatsapp_305', 'email', 'all'].includes(body.channel)) {
      return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })
    }
    if (body.channel === 'all') {
      channelSet = new Set(['whatsapp_305', 'whatsapp_718', 'email'])
    } else {
      channelSet = new Set([body.channel as ChannelOption])
    }
  } else {
    return NextResponse.json({ error: 'channel_or_channels_required' }, { status: 400 })
  }

  // slots is optional; if provided must be an array of ISO strings
  if (body.slots !== undefined && body.slots !== null) {
    if (!Array.isArray(body.slots) || !body.slots.every((s) => typeof s === 'string')) {
      return NextResponse.json({ error: 'slots_must_be_iso_strings_array' }, { status: 400 })
    }
  }

  let person
  try {
    person = await getPerson(body.contact)
  } catch (err) {
    return NextResponse.json(
      { error: 'pipedrive_error', message: (err as Error).message },
      { status: 502 }
    )
  }
  if (!person) {
    return NextResponse.json({ error: 'contact_not_found' }, { status: 404 })
  }

  const firstName = (person.first_name || person.name?.split(' ')[0] || 'there').trim()
  const fullName = (person.name || firstName).trim()
  const email = person.primary_email || pickPrimary(person.email ?? null)
  const phoneRaw = pickPrimary(person.phone ?? null)
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null
  const meetingType: MeetingType = body.meeting_type === 'meeting' ? 'meeting' : 'terminal'
  const personalMessage = typeof body.personal_message === 'string' ? body.personal_message.trim() : ''

  const slotsWithDisplay = (body.slots ?? []).map((iso) => ({
    iso,
    display: formatSlotDisplay(iso),
  }))

  const token = randomUUID()
  const inviteUrl = `${appUrl()}/invite/${token}`

  const service = createServiceClient()
  const { error: insertError } = await service.from('invitations').insert({
    id: token,
    contact_pipedrive_id: person.id,
    contact_first_name: firstName,
    contact_name: fullName,
    contact_email: email,
    contact_phone: phone,
    proposed_slots: slotsWithDisplay,
    meeting_type: meetingType,
    status: 'sent',
  })
  if (insertError) {
    return NextResponse.json(
      {
        error: 'invitation_insert_failed',
        message: insertError.message,
        hint: 'If table is missing, create the invitations table per the SQL in this route file header.',
      },
      { status: 500 }
    )
  }

  const sentChannels: string[] = []
  const errors: Array<{ channel: string; message: string }> = []

  // ── Email ────────────────────────────────────────────────────────────────────
  if (channelSet.has('email')) {
    if (!email) {
      errors.push({ channel: 'email', message: 'no_email_on_contact' })
    } else {
      try {
        const tmpl = meetingType === 'meeting'
          ? buildGeneralMeetingEmail({ firstName, inviteUrl, personalMessage: personalMessage || undefined })
          : buildTerminalInvitationEmail({ firstName, inviteUrl, slots: slotsWithDisplay.map((s) => ({ display: s.display })), personalMessage: personalMessage || undefined })
        await sendEmail({
          to: email,
          from: FROM_EMAIL,
          replyTo: REPLY_TO,
          subject: tmpl.subject,
          html: tmpl.html,
          text: tmpl.text,
        })
        sentChannels.push('email')
      } catch (err) {
        errors.push({ channel: 'email', message: (err as Error).message })
      }
    }
  }

  // ── WhatsApp 305 ─────────────────────────────────────────────────────────────
  if (channelSet.has('whatsapp_305')) {
    if (!phone) {
      errors.push({ channel: 'whatsapp_305', message: 'no_phone_on_contact' })
    } else {
      try {
        const chatId = await findChatIdForPhone('305', phone)
        if (!chatId) {
          errors.push({ channel: 'whatsapp_305', message: 'no_existing_chat_with_this_phone_on_panel' })
        } else {
          const text = buildWhatsAppCopy(firstName, inviteUrl, meetingType, personalMessage)
          await sendMessage({ phone, text, whatsappAccountPhone: PANEL_ACCOUNT_MAP['305'] })
          sentChannels.push('whatsapp_305')
        }
      } catch (err) {
        errors.push({ channel: 'whatsapp_305', message: (err as Error).message })
      }
    }
  }

  // ── WhatsApp 718 ─────────────────────────────────────────────────────────────
  if (channelSet.has('whatsapp_718')) {
    if (!phone) {
      errors.push({ channel: 'whatsapp_718', message: 'no_phone_on_contact' })
    } else {
      try {
        const chatId = await findChatIdForPhone('718', phone)
        if (!chatId) {
          errors.push({ channel: 'whatsapp_718', message: 'no_existing_chat_with_this_phone_on_panel' })
        } else {
          const text = buildWhatsAppCopy(firstName, inviteUrl, meetingType, personalMessage)
          await sendMessage({ phone, text, whatsappAccountPhone: PANEL_ACCOUNT_MAP['718'] })
          sentChannels.push('whatsapp_718')
        }
      } catch (err) {
        errors.push({ channel: 'whatsapp_718', message: (err as Error).message })
      }
    }
  }

  // Captain hotfix 2026-05-20: also return the recipient phone + the WhatsApp
  // body the route tried to send, so the UI can offer a wa.me deep-link
  // fallback for cold contacts (Timelines API requires an existing chat;
  // wa.me opens WhatsApp Web with the recipient pre-filled, lets Gideon
  // send manually one time, and creates the chat for future API sends).
  const whatsappText = phone ? buildWhatsAppCopy(firstName, inviteUrl, meetingType, personalMessage) : null
  return NextResponse.json({
    invitation_id: token,
    invite_url: inviteUrl,
    sent_channels: sentChannels,
    errors,
    // Cold-start fallback fields
    phone_e164: phone,
    whatsapp_text: whatsappText,
  })
}
