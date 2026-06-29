// Soft scheduling — calendar-aware focus suggestions.
//
// Given today's calendar and the open bucket, find free gaps long enough
// to actually start something (default 90 min) between "now" and end-of-day,
// then assign top-priority bucket items to those gaps.
//
// Pure functions — no I/O. The /api/briefing/today route composes them.
//
// Shabbat note: there is no shared Shabbat util in the repo today. We
// approximate the Shabbat block as Friday 17:00 CT through Saturday 21:00 CT
// (conservative: candle-lighting is earliest ~16:00 in deep winter, never
// later than ~20:30; havdalah is rarely past 21:00). Yom Tov is not
// detected — that gap is intentional and tracked on the Phase 2 backlog.

export interface CalendarBlock {
  startTime: string // ISO
  endTime: string // ISO
}

export interface BucketCandidate {
  id: string
  title: string
  priority: number
}

export interface FreeGap {
  gap_start: string // ISO
  gap_end: string // ISO
  minutes: number
}

export interface SuggestedFocus {
  gap_start: string
  gap_end: string
  item_id: string
  title: string
  priority: number
}

const CHICAGO_TZ = 'America/Chicago'

/**
 * End-of-day cutoff for soft scheduling: 18:00 (6pm) Chicago time, expressed
 * as a UTC instant computed from the supplied `now`.
 */
export function endOfWorkdayCT(now: Date): Date {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(now).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value
    return acc
  }, {})
  // Build the 18:00 CT wall-clock as an ISO and resolve to UTC. Chicago is
  // UTC-5 (CDT) or UTC-6 (CST); resolve via Date parsing of an explicit offset.
  const offsetMin = chicagoOffsetMinutesAt(now)
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  const iso = `${parts.year}-${parts.month}-${parts.day}T18:00:00${sign}${hh}:${mm}`
  return new Date(iso)
}

/**
 * Offset (in minutes) FROM UTC to Chicago at the given instant. CDT = -300,
 * CST = -360. Returns a negative number (e.g., -300).
 */
function chicagoOffsetMinutesAt(at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = dtf.formatToParts(at).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value
    return acc
  }, {})
  // Re-construct that wall-clock as if it were UTC, then diff against the
  // actual UTC instant — that delta IS the Chicago offset for this moment.
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '00' : parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )
  return Math.round((asUtc - at.getTime()) / 60_000)
}

/**
 * Returns the Chicago wall-clock day-of-week (0=Sun..6=Sat) and hour for
 * `at`. Used by the Shabbat heuristic.
 */
export function chicagoDowAndHour(at: Date): { dow: number; hour: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TZ,
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  })
  const parts = dtf.formatToParts(at)
  const wk = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'
  const hr = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { dow: map[wk] ?? 0, hour: Number(hr === '24' ? '00' : hr) }
}

/**
 * Conservative Shabbat heuristic: Fri 17:00 CT → Sat 21:00 CT.
 * Used to skip soft-scheduling entirely when "now" sits inside that window.
 * Intentionally approximate — real candle-lighting times are not in scope
 * for v1; revisit when a Hebcal/zmanim util lands.
 */
export function isInShabbatWindow(now: Date): boolean {
  const { dow, hour } = chicagoDowAndHour(now)
  if (dow === 6) return hour < 21 // Saturday before 21:00 CT
  if (dow === 5 && hour >= 17) return true // Friday after 17:00 CT
  return false
}

/**
 * Find free gaps of at least `minMinutes` between `now` and `endOfDay`,
 * given a list of busy calendar blocks (start/end ISO strings). Blocks
 * that overlap each other are merged. Out-of-window blocks are clipped.
 */
export function findFreeGaps(
  blocks: CalendarBlock[],
  now: Date,
  endOfDay: Date,
  minMinutes: number
): FreeGap[] {
  if (now.getTime() >= endOfDay.getTime()) return []

  // Normalize, clip to window, drop invalid.
  const windowStart = now.getTime()
  const windowEnd = endOfDay.getTime()
  const clipped: Array<[number, number]> = []
  for (const b of blocks) {
    const s = new Date(b.startTime).getTime()
    const e = new Date(b.endTime).getTime()
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue
    const cs = Math.max(s, windowStart)
    const ce = Math.min(e, windowEnd)
    if (ce > cs) clipped.push([cs, ce])
  }

  // Merge overlapping blocks.
  clipped.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const seg of clipped) {
    const last = merged[merged.length - 1]
    if (last && seg[0] <= last[1]) {
      last[1] = Math.max(last[1], seg[1])
    } else {
      merged.push([seg[0], seg[1]])
    }
  }

  // Walk the window and emit gaps between merged blocks.
  const minMs = minMinutes * 60_000
  const gaps: FreeGap[] = []
  let cursor = windowStart
  for (const [s, e] of merged) {
    if (s - cursor >= minMs) {
      gaps.push({
        gap_start: new Date(cursor).toISOString(),
        gap_end: new Date(s).toISOString(),
        minutes: Math.round((s - cursor) / 60_000),
      })
    }
    cursor = Math.max(cursor, e)
  }
  if (windowEnd - cursor >= minMs) {
    gaps.push({
      gap_start: new Date(cursor).toISOString(),
      gap_end: new Date(windowEnd).toISOString(),
      minutes: Math.round((windowEnd - cursor) / 60_000),
    })
  }
  return gaps
}

/**
 * Distribute the top open bucket items across the visible free gaps:
 * one item per gap, highest-priority first, oldest-first as tiebreaker.
 * Caller pre-sorts `items` by priority asc, created_at asc. Up to 3
 * suggestions returned.
 */
export function pickFocusSuggestions(
  gaps: FreeGap[],
  items: BucketCandidate[],
  max = 3
): SuggestedFocus[] {
  if (gaps.length === 0 || items.length === 0) return []
  const limit = Math.min(max, gaps.length, items.length)
  const out: SuggestedFocus[] = []
  for (let i = 0; i < limit; i++) {
    const g = gaps[i]
    const it = items[i]
    out.push({
      gap_start: g.gap_start,
      gap_end: g.gap_end,
      item_id: it.id,
      title: it.title,
      priority: it.priority,
    })
  }
  return out
}

/**
 * Top-level: from raw calendar blocks + sorted bucket candidates, return
 * the suggested-focus payload. Empty if Shabbat is in window or no gap fits.
 */
export function computeSuggestedFocus(
  blocks: CalendarBlock[],
  items: BucketCandidate[],
  now: Date,
  opts: { minMinutes?: number; max?: number } = {}
): SuggestedFocus[] {
  if (isInShabbatWindow(now)) return []
  const minMinutes = opts.minMinutes ?? 90
  const max = opts.max ?? 3
  const eod = endOfWorkdayCT(now)
  const gaps = findFreeGaps(blocks, now, eod, minMinutes)
  return pickFocusSuggestions(gaps, items, max)
}
