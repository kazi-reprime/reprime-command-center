import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

const TZ = 'America/Chicago'

// ── Auth (mirrors lib/google/calendar.ts inline) ─────────────────────────────
function getAuthClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return auth
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return YYYY-MM-DD string in Central time for a given UTC Date */
function toChicagoDateStr(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Parse "YYYY-MM-DD" to a Date at the given hour:minute in Central time */
function chicagoTime(dateStr: string, hour: number, minute: number): Date {
  // Build a local-time string that Chicago would use, let Intl resolve the offset
  const isoLike = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
  // Treat the wall-clock string as if it were UTC, read back Chicago's offset at
  // that moment, then SUBTRACT it to recover the true UTC instant. Chicago is
  // behind UTC (offset is negative), so subtracting a negative shifts forward —
  // e.g. 9:00 AM CDT → 14:00 UTC. Gideon 2026-06-18: the prior code ADDED the
  // offset, which pushed every fallback slot ~10h off and onto the wrong day.
  const approx = new Date(`${isoLike}Z`)
  const offsetMs = getChicagoOffsetMs(approx)
  return new Date(approx.getTime() - offsetMs)
}

/** Get the UTC offset for Chicago at the given UTC date (accounts for DST) */
function getChicagoOffsetMs(utcDate: Date): number {
  // Format the date as if in Chicago, then compare to UTC
  const chicagoParts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(utcDate)

  const getPart = (type: string) => chicagoParts.find(p => p.type === type)?.value ?? '0'
  const year = parseInt(getPart('year'))
  const month = parseInt(getPart('month')) - 1
  const day = parseInt(getPart('day'))
  let hour = parseInt(getPart('hour'))
  if (hour === 24) hour = 0
  const minute = parseInt(getPart('minute'))
  const second = parseInt(getPart('second'))

  const chicagoAsUtc = Date.UTC(year, month, day, hour, minute, second)
  return chicagoAsUtc - utcDate.getTime()
}

/** Convert a UTC date to wall-clock time in Chicago */
function toChicagoWallClock(utcDate: Date): { hour: number; minute: number; dayOfWeek: number; dateStr: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'short',
  }).formatToParts(utcDate)

  const getPart = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  let hour = parseInt(getPart('hour'))
  if (hour === 24) hour = 0
  const minute = parseInt(getPart('minute'))
  const weekdayStr = getPart('weekday') // 'Sun', 'Mon', etc.
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayStr)
  const year = getPart('year')
  const month = getPart('month')
  const day = getPart('day')
  const dateStr = `${year}-${month}-${day}`

  return { hour, minute, dayOfWeek, dateStr }
}

/**
 * Per-slot button label — BOTH clocks so an Israeli investor picks by their
 * own time while Gideon still reads Central. The day is shown by the group
 * header above the buttons, so this is time-only. Gideon 2026-06-18.
 * e.g. "2:00 PM Israel · 6:00 AM Central"
 */
function formatSlotDisplay(iso: string): string {
  const d = new Date(iso)
  const ilTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Jerusalem',
  }).format(d)
  const ctTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: TZ,
  }).format(d)
  return `${ilTime} Israel · ${ctTime} Central`
}

/** Given "YYYY-MM-DD", return the next calendar day as "YYYY-MM-DD" */
function nextChicagoDateStr(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`) // noon avoids DST edges
  d.setUTCDate(d.getUTCDate() + 1)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/** Day-label for a YYYY-MM-DD string, e.g. "Monday, May 4" */
function formatDayLabel(dateStr: string): string {
  // Parse date as noon UTC to avoid off-by-one
  const d = new Date(`${dateStr}T12:00:00Z`)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    timeZone: TZ,
  }).format(d)
}

// ── Hebcal ───────────────────────────────────────────────────────────────────

interface HebcalItem {
  date: string   // "YYYY-MM-DD"
  title: string
  yomtov?: boolean
}

async function fetchClosedDates(startDate: Date, endDate: Date): Promise<Set<string>> {
  const closed = new Set<string>()

  // Collect month/year pairs in the window
  const months = new Set<string>()
  const cur = new Date(startDate)
  while (cur <= endDate) {
    const yyyy = cur.getUTCFullYear()
    const mm = cur.getUTCMonth() + 1
    months.add(`${yyyy}-${mm}`)
    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  await Promise.all(
    Array.from(months).map(async (ym) => {
      const [yyyy, mm] = ym.split('-')
      const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=off&nx=off&mf=off&ss=off&mod=off&yt=on&lg=s&c=off&year=${yyyy}&month=${mm}`
      try {
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) return
        const json = (await res.json()) as { items?: HebcalItem[] }
        for (const item of json.items ?? []) {
          if (item.yomtov === true) {
            closed.add(item.date)
          }
        }
      } catch (err) {
        console.error('[available-slots] Hebcal fetch error', err)
      }
    })
  )

  return closed
}

// ── Freebusy ─────────────────────────────────────────────────────────────────

interface BusyInterval {
  start: number // ms
  end: number
}

async function fetchBusyTimes(timeMin: string, timeMax: string): Promise<BusyInterval[]> {
  const calendar = google.calendar({ version: 'v3', auth: getAuthClient() })
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      timeZone: 'UTC',
      items: [{ id: 'primary' }],
    },
  })
  const busyRanges = res.data?.calendars?.primary?.busy ?? []
  return busyRanges.map((b) => ({
    start: new Date(b.start!).getTime(),
    end: new Date(b.end!).getTime(),
  }))
}

function overlaps(slotStart: number, slotEnd: number, busy: BusyInterval[]): boolean {
  for (const b of busy) {
    if (slotStart < b.end && slotEnd > b.start) return true
  }
  return false
}

// ── Main schedule generation ──────────────────────────────────────────────────

export async function GET() {
  try {
    const now = new Date()
    const twoHoursFromNow = now.getTime() + 2 * 60 * 60 * 1000

    // 14-day window (UTC bounds)
    const windowStart = new Date(now)
    windowStart.setUTCHours(0, 0, 0, 0)
    const windowEnd = new Date(windowStart)
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 14)

    const [busyTimes, closedDates] = await Promise.all([
      fetchBusyTimes(windowStart.toISOString(), windowEnd.toISOString()),
      fetchClosedDates(windowStart, windowEnd),
    ])

    // Generate all slots in the 14-day window
    // Key: YYYY-MM-DD dateStr in Chicago time
    const slotsByDate = new Map<string, Array<{ iso: string; display: string }>>()

    // Iterate day by day
    const dayCursor = new Date(windowStart)
    while (dayCursor < windowEnd) {
      const dateStr = toChicagoDateStr(dayCursor)

      // Determine day of week at this Chicago date (use noon to be safe)
      const noonUtc = new Date(`${dateStr}T18:00:00Z`) // ~noon Chicago
      const { dayOfWeek } = toChicagoWallClock(noonUtc)

      // Saturday = 6 → always closed
      if (dayOfWeek === 6) {
        dayCursor.setUTCDate(dayCursor.getUTCDate() + 1)
        continue
      }

      // Yom Tov → office closed
      if (closedDates.has(dateStr)) {
        dayCursor.setUTCDate(dayCursor.getUTCDate() + 1)
        continue
      }

      // Determine operating hours for this day — ALL Central/Iowa time.
      // Gideon 2026-06-18 (locked): Sun 11a-11p, Mon-Thu 9a-11p,
      // Fri 9a-10a only (erev Shabbat), Sat closed (handled above),
      // Yom Tov closed (handled above), erev Yom Tov until 10a only.
      let startHour: number
      let endHour: number
      if (dayOfWeek === 0) {
        startHour = 11; endHour = 23   // Sunday
      } else if (dayOfWeek === 5) {
        startHour = 9; endHour = 10    // Friday, erev Shabbat
      } else {
        startHour = 9; endHour = 23    // Monday-Thursday
      }

      // Erev Yom Tov: the day immediately before a closed Yom Tov gets the
      // same 10 AM cutoff as Friday. If that lands on a Sunday (11a floor),
      // the cutoff wins and the day is effectively closed — flag if it occurs.
      const nextDayStr = nextChicagoDateStr(dateStr)
      if (closedDates.has(nextDayStr)) {
        endHour = Math.min(endHour, 10)
      }

      // Generate 30-min slots
      for (let h = startHour; h < endHour; h++) {
        for (const m of [0, 30]) {
          const slotStart = chicagoTime(dateStr, h, m)
          const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000)

          // Filter past slots (< 2 hours from now)
          if (slotStart.getTime() < twoHoursFromNow) continue

          // Filter if overlaps existing calendar events
          if (overlaps(slotStart.getTime(), slotEnd.getTime(), busyTimes)) continue

          // Gideon 2026-06-18: recipients are in Israel — never offer a time
          // that's the middle of the night there. Keep only 8 AM–10 PM Israel.
          const ilHour = parseInt(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' }).format(slotStart), 10)
          if (ilHour < 8 || ilHour >= 22) continue

          // Verify the slot's Chicago date matches (edge case near midnight)
          const slotDateStr = toChicagoDateStr(slotStart)
          if (slotDateStr !== dateStr) continue

          if (!slotsByDate.has(dateStr)) slotsByDate.set(dateStr, [])
          slotsByDate.get(dateStr)!.push({
            iso: slotStart.toISOString(),
            display: formatSlotDisplay(slotStart.toISOString()),
          })
        }
      }

      dayCursor.setUTCDate(dayCursor.getUTCDate() + 1)
    }

    const slots = Array.from(slotsByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateStr, times]) => ({
        date: dateStr,
        label: formatDayLabel(dateStr),
        times,
      }))

    return NextResponse.json({ slots })
  } catch (err) {
    console.error('[available-slots] error', err)
    return NextResponse.json({ error: 'internal_error', message: (err as Error).message }, { status: 500 })
  }
}
