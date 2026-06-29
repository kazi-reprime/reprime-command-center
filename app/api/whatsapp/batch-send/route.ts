import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { PANEL_ACCOUNT_MAP, sendMessage } from '@/lib/timelines/client'
import { normalizePhone } from '@/lib/timelines/normalize-phone'
import { getPerson, type PipedriveContactValue } from '@/lib/pipedrive/client'
import { recordOutboundAsk } from '@/lib/secretary/outbound-asks'
import {
  isTemplateName,
  renderTemplate,
  type WhatsappTemplateName,
} from '@/lib/whatsapp/templates'
import type { Panel } from '@/lib/timelines/types'

export const dynamic = 'force-dynamic'
// Per-recipient sleep means a 50-recipient batch can take ~100s. Bump above
// the 60s default so the function isn't killed mid-batch.
export const maxDuration = 300

// Throttle floor: at most one Timelines POST per 2s. Timelines doesn't publish
// hard rate limits but the single-send path occasionally returns 429 under
// burst; 2s is comfortably under any documented ceiling.
const SEND_INTERVAL_MS = 2000

type BatchRecipient = {
  pipedrive_id: number
  vars: Record<string, string>
}

type BatchBody = {
  template?: string
  recipients?: BatchRecipient[]
  // Optional. Defaults to '305' (active outbound line per memory
  // google_voice_retired.md). Spec only required template + recipients;
  // panel is additive and backwards-compatible.
  panel?: string
}

type Failure = { id: number; reason: string }

function pickPrimaryPhone(values: PipedriveContactValue[] | null | undefined): string | null {
  if (!values || values.length === 0) return null
  const primary = values.find((v) => v.primary && v.value && v.value.trim())
  if (primary) return primary.value.trim()
  const first = values.find((v) => v.value && v.value.trim())
  return first ? first.value.trim() : null
}

function isRecipientShape(x: unknown): x is BatchRecipient {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  if (typeof r.pipedrive_id !== 'number' || !Number.isFinite(r.pipedrive_id)) return false
  if (!r.vars || typeof r.vars !== 'object') return false
  for (const v of Object.values(r.vars as Record<string, unknown>)) {
    if (typeof v !== 'string') return false
  }
  return true
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== 'g@reprime.com') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: BatchBody
  try {
    payload = (await request.json()) as BatchBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const templateName = payload.template
  if (typeof templateName !== 'string' || !isTemplateName(templateName)) {
    return NextResponse.json({ error: 'invalid_template' }, { status: 400 })
  }

  const recipients = payload.recipients
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: 'recipients_required' }, { status: 400 })
  }
  for (const r of recipients) {
    if (!isRecipientShape(r)) {
      return NextResponse.json({ error: 'invalid_recipient_shape' }, { status: 400 })
    }
  }

  const panelParam = payload.panel ?? '305'
  if (panelParam !== '718' && panelParam !== '305') {
    return NextResponse.json({ error: 'invalid_panel' }, { status: 400 })
  }
  const panel: Panel = panelParam
  const accountId = PANEL_ACCOUNT_MAP[panel]

  let sent = 0
  const failed: Failure[] = []
  const tpl: WhatsappTemplateName = templateName

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i]
    try {
      const rendered = renderTemplate(tpl, r.vars)
      if (!rendered.ok) {
        failed.push({ id: r.pipedrive_id, reason: `render_failed:${rendered.error}` })
        continue
      }

      const person = await getPerson(r.pipedrive_id)
      if (!person) {
        failed.push({ id: r.pipedrive_id, reason: 'person_not_found' })
        continue
      }

      const rawPhone = pickPrimaryPhone(person.phone as PipedriveContactValue[] | null | undefined)
      const phone = rawPhone ? normalizePhone(rawPhone) : null
      if (!phone) {
        failed.push({ id: r.pipedrive_id, reason: 'no_valid_phone' })
        continue
      }

      const result = await sendMessage({
        phone,
        text: rendered.text,
        whatsappAccountPhone: accountId,
      })

      // Record into outbound_asks (24h window is the channel default).
      // Non-fatal — a failed bookkeeping write still counts as sent.
      await recordOutboundAsk({
        recipientIdentifier: phone,
        channel: 'whatsapp',
        body: rendered.text,
        sentAt: new Date(),
      })

      sent++
      void result
    } catch (err) {
      const msg = (err as Error).message ?? 'unknown_error'
      failed.push({ id: r.pipedrive_id, reason: msg.slice(0, 200) })
    }

    // Throttle: sleep between sends, but skip after the last one.
    if (i < recipients.length - 1) {
      await sleep(SEND_INTERVAL_MS)
    }
  }

  return NextResponse.json({ sent, failed })
}
