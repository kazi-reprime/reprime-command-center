/**
 * Voice command grammar v1 — regex + keyword, no LLM.
 *
 * Pure function: takes a transcript string, returns a tagged intent.
 * Kept browser/node-agnostic so it can be unit-tested without a DOM.
 *
 * Order matters: more-specific patterns are matched before more-general
 * ones (e.g. "remind me about ... in N minutes" before "search ..." catches
 * any leading word).
 */

export type ParsedIntent =
  | { intent: 'add_to_bucket'; params: { text: string }; raw: string }
  | { intent: 'remind'; params: { text: string; minutes: number }; raw: string }
  | { intent: 'delegate'; params: { name: string; text: string }; raw: string }
  | {
      intent: 'open_window'
      params: { target: WindowTarget; opts: { query?: string } }
      raw: string
    }
  | { intent: 'search'; params: { text: string }; raw: string }
  | { intent: 'call'; params: { name: string }; raw: string }
  | {
      intent: 'email'
      params: { name: string; subject: string; body: string }
      raw: string
    }
  | { intent: 'briefing'; params: Record<string, never>; raw: string }
  | { intent: 'stop'; params: Record<string, never>; raw: string }
  | { intent: 'unknown'; params: Record<string, never>; raw: string }

export type WindowTarget =
  | 'perplexity'
  | 'gmail'
  | 'costar'
  | 'loopnet'
  | 'pipedrive'

const WINDOW_TARGETS: ReadonlySet<WindowTarget> = new Set([
  'perplexity',
  'gmail',
  'costar',
  'loopnet',
  'pipedrive',
])

function unitToMinutes(unit: string, n: number): number {
  const u = unit.toLowerCase()
  if (u.startsWith('h')) return n * 60
  if (u.startsWith('d')) return n * 60 * 24
  return n
}

export function parseCommand(raw: string): ParsedIntent {
  const text = raw.trim()
  if (!text) return { intent: 'unknown', params: {}, raw }

  // stop / nora stop
  if (/^(?:nora\s+)?stop\b/i.test(text)) {
    return { intent: 'stop', params: {}, raw }
  }

  // brief me
  if (/^brief\s*me\b/i.test(text)) {
    return { intent: 'briefing', params: {}, raw }
  }

  // open <target> [ask <query>]
  // Only "perplexity" honors the ask form; other targets just open.
  const openMatch = text.match(/^open\s+([a-z]+)(?:\s+ask\s+(.+))?$/i)
  if (openMatch) {
    const target = openMatch[1].toLowerCase() as WindowTarget
    if (WINDOW_TARGETS.has(target)) {
      const query = openMatch[2]?.trim()
      return {
        intent: 'open_window',
        params: {
          target,
          opts: query && target === 'perplexity' ? { query } : {},
        },
        raw,
      }
    }
  }

  // add to bucket: <text>   (also accepts "add to bucket <text>")
  const bucketMatch = text.match(/^add\s+to\s+bucket\s*[:\-,]?\s*(.+)$/i)
  if (bucketMatch) {
    return {
      intent: 'add_to_bucket',
      params: { text: bucketMatch[1].trim() },
      raw,
    }
  }

  // remind me about <text> in <N> minutes|hours|days
  // Also accepts "remind me to <text>" / "remind me of <text>".
  const remindMatch = text.match(
    /^remind\s+me\s+(?:about|to|of)?\s*(.+?)\s+in\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\s*$/i,
  )
  if (remindMatch) {
    const body = remindMatch[1].trim()
    const n = parseInt(remindMatch[2], 10)
    const minutes = unitToMinutes(remindMatch[3], n)
    return { intent: 'remind', params: { text: body, minutes }, raw }
  }

  // tell <name> to <text>
  const tellMatch = text.match(/^tell\s+([\p{L}][\p{L}\s.'\-]*?)\s+to\s+(.+)$/iu)
  if (tellMatch) {
    return {
      intent: 'delegate',
      params: {
        name: tellMatch[1].trim(),
        text: tellMatch[2].trim(),
      },
      raw,
    }
  }

  // email <name>: <subj> / <body>      (slash separates subject and body)
  // Tolerates "-" or "," in place of ":" after the name.
  const emailMatch = text.match(/^email\s+([^:,\-]+?)\s*[:,\-]\s*(.+)$/i)
  if (emailMatch) {
    const name = emailMatch[1].trim()
    const rest = emailMatch[2].trim()
    const slashIdx = rest.indexOf(' / ')
    const subject = slashIdx >= 0 ? rest.slice(0, slashIdx).trim() : rest
    const body = slashIdx >= 0 ? rest.slice(slashIdx + 3).trim() : ''
    return { intent: 'email', params: { name, subject, body }, raw }
  }

  // call <name>
  const callMatch = text.match(/^call\s+(.+)$/i)
  if (callMatch) {
    return { intent: 'call', params: { name: callMatch[1].trim() }, raw }
  }

  // search <text>     (last so it doesn't eat "search" inside another verb)
  const searchMatch = text.match(/^search\s+(.+)$/i)
  if (searchMatch) {
    return { intent: 'search', params: { text: searchMatch[1].trim() }, raw }
  }

  return { intent: 'unknown', params: {}, raw }
}
