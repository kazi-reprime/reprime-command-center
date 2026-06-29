// Ghost-meeting prevention. The #1 cause of "meeting booked, nobody shows" is a
// contact_email that belongs to a DIFFERENT person than the contact — e.g.
// contact "Nadav Goldman" but email pazit.goldman@gmail.com (his wife). The
// Zoom + calendar invite then lands in the wrong inbox and the actual investor
// never knows, so they no-show. (Same class: "Ilit Peleg" → Dorons@kali.co.il.)
//
// This is deliberately CONSERVATIVE — it must never block a legitimate booking.
// It only fires on a CLEAR Latin first-name mismatch, and skips:
//   • Hebrew names / initials / very short names (can't be judged by ASCII)
//   • shared / company mailboxes (info@, office@, sam@firm where sam==first)
//   • nicknames, both directions (sam↔samuel, dani↔daniel)
// A true positive is surfaced as a 'review' flag for the secretary to verify —
// never an automatic hard block. Only a human-confirmed 'high' flag blocks.

const SHARED_LOCALPARTS = new Set([
  'info', 'office', 'admin', 'contact', 'sales', 'hello', 'team', 'mail',
  'support', 'finance', 'accounts', 'accounting', 'investor', 'investors',
  'ir', 'deals', 'invest', 'capital', 'group', 'fund', 'family',
])

// First run of Latin letters in a name, diacritics stripped, lowercased.
// "Liran Ben Ari" → "liran"; "לירן" → "" (Hebrew, can't judge).
function latinFirstToken(name: string): string {
  const m = (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .match(/[a-z]+/)
  return m ? m[0] : ''
}

/**
 * True when `email`'s local-part almost certainly belongs to someone OTHER than
 * `firstName`. Conservative by design — returns false whenever it can't be sure.
 */
export function emailLikelyWrongPerson(firstName: string | null | undefined, email: string | null | undefined): boolean {
  if (!firstName || !email) return false
  const fn = latinFirstToken(firstName)
  if (fn.length < 3) return false // Hebrew / initials — not judgeable from ASCII
  const local = (email.split('@')[0] || '').toLowerCase()
  if (local.length < 3) return false // initials / single-letter inbox — not judgeable
  if (local.includes(fn)) return false // first name appears verbatim in the address
  const tokens = local.split(/[^a-z]+/).filter((t) => t.length >= 3)
  if (tokens.some((t) => SHARED_LOCALPARTS.has(t))) return false // shared/company mailbox
  // Nickname tolerance, both directions.
  if (tokens.some((t) => fn.includes(t) || t.includes(fn))) return false
  // Initial-match escape — "jhorn" for Jonathan, "aweitmann" for Amir,
  // "m.feinstein" for Mordy are all the RIGHT person in initial+surname form.
  // The wrong-person signature is a DIFFERENT first name in the address
  // (pazit.goldman for Nadav, Dorons@ for Ilit), where even the initial differs.
  const firstAlpha = (local.match(/[a-z]/) || [''])[0]
  if (firstAlpha === fn[0]) return false
  return true
}
