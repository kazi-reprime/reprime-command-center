// WhatsApp template registry. Used by /api/whatsapp/batch-send to fan out
// a single Gideon-voice template across many investors in one call.
//
// Constraints (per Wave 6 dispatch):
//   - Gideon-voice (terse, direct, ops-register; see CLAUDE.md §5 Frei/Grove/Horowitz)
//   - max 240 chars per rendered message
//   - no emojis
//   - typed vars per template; renderer rejects missing/empty vars

export const MAX_TEMPLATE_LENGTH = 240

export type WhatsappTemplateName = 'reEngageCold' | 'followUpDeal'

interface TemplateSpec<V extends Record<string, string>> {
  requiredVars: ReadonlyArray<keyof V & string>
  render: (vars: V) => string
}

const reEngageColdSpec: TemplateSpec<{ name: string; daysSilent: string }> = {
  requiredVars: ['name', 'daysSilent'],
  render: ({ name, daysSilent }) =>
    `Hi ${name}, it's been ${daysSilent} days — wanted to check in. ` +
    `Got a couple of new opportunities I'd like to walk you through. ` +
    `Worth a quick call this week? — Gideon`,
}

const followUpDealSpec: TemplateSpec<{ name: string; dealName: string }> = {
  requiredVars: ['name', 'dealName'],
  render: ({ name, dealName }) =>
    `Quick follow-up on ${dealName}, ${name}. ` +
    `Where's your head at? Happy to jump on a call if useful. — Gideon`,
}

const REGISTRY: Record<WhatsappTemplateName, TemplateSpec<Record<string, string>>> = {
  reEngageCold: reEngageColdSpec as unknown as TemplateSpec<Record<string, string>>,
  followUpDeal: followUpDealSpec as unknown as TemplateSpec<Record<string, string>>,
}

export function isTemplateName(s: string): s is WhatsappTemplateName {
  return s === 'reEngageCold' || s === 'followUpDeal'
}

export type RenderResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

// Emoji guard: rejects extended pictographic codepoints. Templates are
// authored emoji-free; this catches a future contributor adding one and
// any garbage that slips in via vars.
const EMOJI_RE = /\p{Extended_Pictographic}/u

export function renderTemplate(
  name: WhatsappTemplateName,
  vars: Record<string, string>
): RenderResult {
  const spec = REGISTRY[name]
  if (!spec) return { ok: false, error: `unknown_template:${name}` }

  for (const key of spec.requiredVars) {
    const v = vars[key]
    if (typeof v !== 'string' || v.trim().length === 0) {
      return { ok: false, error: `missing_var:${key}` }
    }
  }

  const text = spec.render(vars)
  if (text.length > MAX_TEMPLATE_LENGTH) {
    return { ok: false, error: `too_long:${text.length}>${MAX_TEMPLATE_LENGTH}` }
  }
  if (EMOJI_RE.test(text)) {
    return { ok: false, error: 'emoji_in_output' }
  }
  return { ok: true, text }
}
