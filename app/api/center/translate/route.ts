import { NextResponse } from 'next/server'
import { centerAuthed } from '@/lib/center/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// The translation engine. Inbound investor messages (Hebrew or English) are
// rendered for the Spanish-speaking secretary, and her reply is turned into the
// message Gideon would actually send — native Israeli dugri Hebrew, never
// Google-Translate. This is the prompt that earned "the Hebrew is perfect."
const SYS_ANALYZE = `You are the command-center engine for an Israeli real-estate firm. Principal: Gideon Gratsiani (RePrime). The secretary works in SPANISH. INVESTORS GET REPLIED TO IN THE LANGUAGE THEY WRITE IN — no exceptions. If they write Hebrew, reply in natural native ISRAELI business Hebrew (dugri, warm, real WhatsApp register, never literal/Google-Translate, no Tanakh/academic tone). If they write English, reply in natural, warm, founder-to-peer English. Never translate an English speaker's reply into Hebrew. The reply_he field is simply the OUTGOING MESSAGE — name is legacy; its language MUST match the investor's language, not always Hebrew. Read the whole thread for tone.

CRITICAL — READ WHAT THEY ACTUALLY WROTE FIRST. Classify their latest message and reply accordingly. Never generate a meeting-confirm to someone who didn't ask for a meeting. Never push a Zoom on someone who declined. Examples of intents and the RIGHT response shape:
 • DECLINED / passing: thank warmly, leave door open, do NOT push Zoom. ("Appreciate you taking a look — totally understand. If anything shifts, you know where to find me.")
 • DECLINED + REFERRAL ("I passed it to clients"): thank, ask who/can we reach out, do NOT push Zoom on them.
 • INTERESTED / asking for more info / asking to talk: THIS is where suggestion[0] drives to a Zoom (warmly, end by inviting to set a time — a link is appended automatically; DO NOT write any URL).
 • Question about the deal/firm: answer the question in 1-2 sentences first; THEN, if it makes sense, offer Zoom.
 • Pleasantry / out-of-office / "talk later": acknowledge briefly, no push.
 • Hostile / annoyed: short, gracious, back off.

Return STRICT JSON only (no code fences):
 context_es: 1-2 sentences of context — IN SPANISH if the investor writes Hebrew, IN ENGLISH if the investor writes English (do NOT translate to Spanish for English threads).
 their_message_es: their latest message — IN SPANISH if they write Hebrew, IN ENGLISH if they write English (i.e. just echo it for English threads).
 their_message_en: their latest message in natural English.
 their_intent: one of "interested" | "declined" | "declined_with_referral" | "question" | "pleasantry" | "hostile" | "other".
 lang: "he" or "en" — the language the investor writes in.
 push_zoom: boolean — true ONLY if their_intent is "interested" or "question" AND a Zoom invite is the right next move. False for declined, pleasantry, hostile.
 suggestions: array of EXACTLY 2 reply options, keys: label_es (2-4 word label of the angle — IN SPANISH if the investor writes Hebrew (e.g. "Agradecer y dejar puerta", "Pedir referencia", "Agendar Zoom"), IN ENGLISH if they write English (e.g. "Thank and leave door open", "Ask for referral", "Book Zoom")), label_en (the SAME 2-4 word label ALWAYS in natural English regardless of the investor's language — for the principal's English-side view), reply_es (the secretary-facing rendering — IN SPANISH if the investor writes Hebrew so she can read it, ELSE the EXACT SAME English reply as reply_he), reply_he (the outgoing message exactly as Gideon would send — Israeli Hebrew if the investor writes Hebrew, otherwise English).
  • If push_zoom is TRUE: suggestion[0] warmly drives to Zoom (lead into the link, don't write one); suggestion[1] is the same intent without the link.
  • If push_zoom is FALSE: NEITHER suggestion pushes a Zoom or asks for a meeting. Both fit the actual intent (e.g. for declined_with_referral: [0] thank + ask who to reach out to, [1] thank + leave door open). Labels must reflect what the reply actually does.

Return ONLY JSON.`


const SYS_FINALIZE = `You turn a reply written by a Spanish-speaking secretary into the message Gideon Gratsiani (RePrime, Israeli real-estate principal) will actually send.
Target Hebrew: natural native ISRAELI business Hebrew — dugri, warm, real WhatsApp register, never literal/Google-Translate, no Tanakh/academic/biblical tone.
Target English: natural, warm, concise, founder-to-peer.
Return STRICT JSON only (no fences): { final: "<the message, ready to send>" }.`

async function claude(system: string, user: string) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY missing')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 2000, system, messages: [{ role: 'user', content: user }] }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error('anthropic ' + r.status + ' ' + JSON.stringify(j).slice(0, 200))
  let t = (j.content || []).map((c: { text?: string }) => c.text || '').join('')
  t = t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)
  return JSON.parse(t)
}

const hasHebrew = (s: string | undefined | null) => /[֐-׿]/.test(s || '')

// Force a set of lines into natural Latin-American Spanish. Used to GUARANTEE the
// secretary-facing fields are Spanish even when the model echoes Hebrew into them.
async function toSpanish(lines: string[]): Promise<string[]> {
  const arr = (lines || []).map((x) => String(x || ''))
  if (!arr.some((s) => s.trim())) return arr
  const sys = 'Translate each numbered line into natural, warm Latin-American Spanish for a Spanish-speaking secretary. Keep the meaning and tone; keep any URLs/emojis as-is; NEVER return Hebrew. Return STRICT JSON only: {"es":["...", ...]} with exactly one string per input line, in order.'
  try {
    const o = await claude(sys, arr.map((s, i) => `${i + 1}. ${s}`).join('\n'))
    const es = Array.isArray(o.es) ? o.es : []
    return arr.map((s, i) => (es[i] ? String(es[i]) : s))
  } catch {
    return arr
  }
}

export async function POST(request: Request) {
  if (!centerAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: { action?: string; thread?: string; latest?: string; draft?: string; target?: string; bookLink?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  try {
    if (body.action === 'finalize') {
      const out = await claude(SYS_FINALIZE, `Target language: ${body.target === 'en' ? 'English' : 'Hebrew'}.\nSecretary wrote:\n${body.draft || ''}`)
      return NextResponse.json({ final: out.final || '' })
    }
    const out = await claude(SYS_ANALYZE, `Thread (old to new):\n${body.thread || '(no prior context — this was just the invitation)'}\n\nLatest from them: ${body.latest || ''}`)
    // ENGLISH IN, ENGLISH OUT — never translate. The Hebrew↔Spanish loop exists
    // ONLY because the secretary can't read Hebrew. Trust CONTENT over the
    // model's lang label: the investor's ACTUAL latest message decides the
    // thread language, regardless of what the model claims (mixed-language
    // threads were confusing the model into returning lang:"en" with an empty
    // reply_he). Then we OVERWRITE out.lang so downstream consumers (UI label)
    // see the truth.
    const investorWroteHebrew = hasHebrew(body.latest)
    const isEnThread = !investorWroteHebrew && /[A-Za-z]/.test(body.latest || '')
    if (out) out.lang = isEnThread ? 'en' : 'he'
    if (out && Array.isArray(out.suggestions) && out.suggestions.length) {
      if (isEnThread) {
        // English thread: the model's reply_he IS the English outgoing message.
        // Mirror it into reply_es so the UI shows the same English in both boxes.
        // GUARD: if the model accidentally returned Hebrew in reply_he (despite
        // instructions), fall back to reply_es so we never send Hebrew to an
        // English speaker.
        out.suggestions.forEach((s: { reply_es?: string; reply_he?: string }) => {
          const he = s.reply_he || ''
          const es = s.reply_es || ''
          // If reply_he has Hebrew, it's wrong for this thread — drop it.
          const outgoing = hasHebrew(he) ? (hasHebrew(es) ? '' : es) : (he || es)
          s.reply_he = outgoing
          s.reply_es = outgoing
        })
        // also force the top-level lang field to match reality so downstream
        // consumers (UI label) don't re-trust a stale value.
        out.lang = 'en'
      } else {
        // Hebrew thread: guarantee the secretary-facing reply is Spanish (the
        // model sometimes echoes Hebrew into reply_es). ALSO salvage cases
        // where the model returned an English reply by mistake on a Hebrew
        // thread — that's not usable as the outgoing message, so we treat it
        // as missing (empty reply_he) and let the UI show its placeholder.
        out.suggestions.forEach((s: { reply_he?: string; reply_es?: string }) => {
          const he = s.reply_he || ''
          // If reply_he came back with NO Hebrew chars at all, the model
          // mis-followed instructions — drop it rather than send English
          // to a Hebrew investor.
          if (he && !hasHebrew(he)) s.reply_he = ''
        })
        const esReplies = await toSpanish(out.suggestions.map((s: { reply_he?: string; reply_es?: string }) => s.reply_he || s.reply_es || ''))
        out.suggestions.forEach((s: { reply_es?: string }, i: number) => { if (esReplies[i]) s.reply_es = esReplies[i] })
      }
    }
    if (out && !isEnThread) {
      // Hebrew-thread guarantees only — never run these on English threads.
      if (hasHebrew(out.their_message_es)) { const t = await toSpanish([body.latest || out.their_message_es]); out.their_message_es = t[0] || out.their_message_es }
      if (hasHebrew(out.context_es)) { const t = await toSpanish([out.context_es]); out.context_es = t[0] || out.context_es }
    } else if (out && isEnThread) {
      // English thread: secretary sees the English text in the Spanish slot too.
      out.their_message_es = out.their_message_en || body.latest || out.their_message_es || ''
      // context_es is just an English summary for her — leave the model's English output as-is.
    }
    // Append the Zoom link to suggestion[0] ONLY when the model judged the intent
    // warrants pushing a meeting (push_zoom=true). For declined / pleasantry /
    // hostile, no link, no meeting-push label — the reply must match what they
    // actually said, not the funnel's default goal.
    if (out && Array.isArray(out.suggestions) && out.suggestions.length) {
      const isEn = out.lang === 'en'
      const link = (body.bookLink && /^https?:\/\//.test(body.bookLink) && /\/invite\//.test(body.bookLink)) ? body.bookLink : ''
      const s0 = out.suggestions[0]
      const pushZoom = out.push_zoom === true
      if (s0 && link && pushZoom) {
        const heSig = isEn
          ? `\n\nHere's the link to grab a time with Gideon: ${link}`
          : `\n\nהנה הקישור לתיאום זום עם גדעון: ${link}`
        const esSig = `\n\nEnlace para agendar el Zoom: ${link}`
        if (s0.reply_he && !s0.reply_he.includes(link)) s0.reply_he = String(s0.reply_he).trimEnd() + heSig
        if (s0.reply_es && !s0.reply_es.includes(link)) s0.reply_es = String(s0.reply_es).trimEnd() + esSig
      }
      // Keep the model's own labels (they already reflect the actual intent).
      // Only fall back if the model didn't return one.
      if (s0 && !s0.label_es) s0.label_es = pushZoom ? 'Agendar Zoom' : 'Opción 1'
      if (s0 && !s0.label_en) s0.label_en = pushZoom ? 'Book Zoom' : 'Option 1'
      if (out.suggestions[1] && !out.suggestions[1].label_es) out.suggestions[1].label_es = 'Opción 2'
      if (out.suggestions[1] && !out.suggestions[1].label_en) out.suggestions[1].label_en = 'Option 2'
    }
    return NextResponse.json(out)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 })
  }
}
