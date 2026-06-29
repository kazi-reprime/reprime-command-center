/**
 * Captain 2026-05-26: shared slot-picker logic.
 *
 * Gideon's rule (from operator chat 2026-05-26):
 *   - For Israeli contacts (locale='il'), prime their 3 default slots in
 *     Israeli afternoon: 16:00 / 17:00 / 18:00 IDT (= 8/9/10 AM Central).
 *   - For US contacts (locale='us'), keep the current morning / afternoon /
 *     evening spread in Central time (9-12 / 12-17 / 17-21).
 *   - The /choose page (driven by /api/bookings/available-slots) offers
 *     everything from 6 AM Central onwards (= 2 PM IDT) so Israeli recipients
 *     who want to pick a custom slot have the full window.
 *
 * The picker reads slot ISO strings (UTC), evaluates the wall-clock hour in
 * the appropriate timezone, buckets, and returns up to 3 picks from the
 * soonest available day in the slot groups.
 */

export type Slot = { iso: string; display: string }
export type SlotGroup = { date: string; label: string; times: Slot[] }
export type Locale = 'us' | 'il'

const TZ_CHICAGO = 'America/Chicago'
const TZ_JERUSALEM = 'Asia/Jerusalem'

function hourIn(tz: string, iso: string): number {
  const h = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(
      new Date(iso)
    ),
    10
  )
  return h === 24 ? 0 : h
}

function minuteIn(tz: string, iso: string): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, minute: 'numeric' }).format(new Date(iso)),
    10
  )
}

/**
 * Locale signal — checks if a phone number is Israeli (+972).
 * Falls back to 'us' for unknown / blank.
 */
export function detectLocale(phone: string | null | undefined, name?: string | null): Locale {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.startsWith('972')) return 'il'
  // Hebrew character heuristic in case phone is missing
  if (name && /[֐-׿]/.test(name)) return 'il'
  return 'us'
}

/**
 * Build a display string for a slot in the appropriate timezone for the
 * recipient. For IL → "Tuesday, May 26 · 4:00 PM Israel". For US → existing
 * Central format. Use this when overriding the server-supplied display.
 */
export function formatSlotForLocale(iso: string, locale: Locale): string {
  const d = new Date(iso)
  const tz = locale === 'il' ? TZ_JERUSALEM : TZ_CHICAGO
  const suffix = locale === 'il' ? 'Israel' : 'Central'
  const fmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
  })
  return `${fmt.format(d)} ${suffix}`
}

/**
 * From the freebusy-filtered slot groups, pick three slots spread across the
 * day on the soonest available day.
 *
 *   locale='il' → bias toward 16:00 / 17:00 / 18:00 IDT (Israeli afternoon).
 *   locale='us' → morning / afternoon / evening in Central time.
 *
 * Returns up to 3 slots with display strings rewritten for the target locale.
 */
export function pickThreeSlots(groups: SlotGroup[], locale: Locale = 'us'): Slot[] {
  for (const group of groups) {
    const picks: Slot[] = []

    if (locale === 'il') {
      // IL: target 16:00, 17:00, 18:00 IDT (= 8/9/10 AM CDT during DST)
      const targetHours = [16, 17, 18]
      for (const target of targetHours) {
        const found = group.times.find((t) => {
          const h = hourIn(TZ_JERUSALEM, t.iso)
          const m = minuteIn(TZ_JERUSALEM, t.iso)
          return h === target && m === 0
        })
        if (found && !picks.find((p) => p.iso === found.iso)) picks.push(found)
      }

      // Fallback: fill from IDT 14:00-20:00 range
      if (picks.length < 3) {
        for (const t of group.times) {
          if (picks.length >= 3) break
          if (picks.find((p) => p.iso === t.iso)) continue
          const h = hourIn(TZ_JERUSALEM, t.iso)
          if (h >= 14 && h < 20) picks.push(t)
        }
      }
    } else {
      // US: morning (9-12), afternoon (12-17), evening (17-21) CDT
      const bucketed: Record<'morning' | 'afternoon' | 'evening', Slot[]> = {
        morning: [],
        afternoon: [],
        evening: [],
      }
      for (const t of group.times) {
        const h = hourIn(TZ_CHICAGO, t.iso)
        if (h >= 9 && h < 12) bucketed.morning.push(t)
        else if (h >= 12 && h < 17) bucketed.afternoon.push(t)
        else if (h >= 17 && h < 21) bucketed.evening.push(t)
      }
      if (bucketed.morning[0]) picks.push(bucketed.morning[0])
      if (bucketed.afternoon[0]) picks.push(bucketed.afternoon[0])
      if (bucketed.evening[0]) picks.push(bucketed.evening[0])
    }

    // Universal backfill from this day's remaining slots
    if (picks.length < 3) {
      for (const t of group.times) {
        if (picks.length >= 3) break
        if (!picks.find((p) => p.iso === t.iso)) picks.push(t)
      }
    }

    if (picks.length >= 1) {
      // Rewrite display strings in the recipient's timezone
      return picks.slice(0, 3).map((s) => ({
        iso: s.iso,
        display: formatSlotForLocale(s.iso, locale),
      }))
    }
  }
  return []
}

/**
 * Period label for a slot — bucket name shown above the time on the email
 * slot button. Computed in the recipient's timezone.
 */
export function periodLabelForLocale(iso: string, locale: Locale): string {
  const tz = locale === 'il' ? TZ_JERUSALEM : TZ_CHICAGO
  const h = hourIn(tz, iso)
  if (h < 12) return 'Morning'
  if (h < 16) return 'Afternoon'
  if (h < 19) return 'Evening'
  return 'Late Evening'
}
