import { google, type calendar_v3 } from 'googleapis'

function getAuthClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return auth
}

export async function getTodayEvents() {
  const calendar = google.calendar({ version: 'v3', auth: getAuthClient() })
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 86400000)
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  })
  // Match any zoom.us meeting URL (/j/, /w/, /my/, personal links), not just /j/.
  const zoomRegex = /https:\/\/[^\s"<]*zoom\.us\/[^\s"<]+/i
  return res.data.items?.map(event => {
    const locationMatch = event.location?.match(zoomRegex)?.[0] || null
    const descriptionMatch = event.description?.match(zoomRegex)?.[0] || null
    // Google's native conference integration (Zoom add-on, Meet) puts the join
    // URL in conferenceData.entryPoints, not location/description.
    const entryPoints = event.conferenceData?.entryPoints || []
    const videoEntry =
      entryPoints.find(ep => ep.entryPointType === 'video' && ep.uri)?.uri ||
      entryPoints.find(ep => ep.uri)?.uri ||
      null
    const zoomLink = locationMatch || descriptionMatch || (videoEntry?.includes('zoom.us') ? videoEntry : null)
    return {
      id: event.id || '',
      title: event.summary || 'Untitled',
      startTime: event.start?.dateTime || event.start?.date || '',
      endTime: event.end?.dateTime || event.end?.date || '',
      zoomLink,
      // hangoutLink / any conference entry point so the cockpit Join button has
      // a real URL even for Meet or add-on-based meetings.
      hangoutLink: event.hangoutLink || videoEntry || null,
      location: event.location || null,
      attendees: event.attendees?.map(a => a.email).filter((email): email is string => !!email) || [],
    }
  }) || []
}

export async function updateCalendarEvent(eventId: string, opts: {
  summary?: string
  description?: string
  startTime?: string
  endTime?: string
  attendees?: string[]
  zoomLink?: string
  location?: string
}) {
  const calendar = google.calendar({ version: 'v3', auth: getAuthClient() })
  const requestBody: calendar_v3.Schema$Event = {}
  if (opts.summary !== undefined) requestBody.summary = opts.summary
  if (opts.description !== undefined) requestBody.description = opts.description
  if (opts.location !== undefined) requestBody.location = opts.location
  if (opts.startTime) requestBody.start = { dateTime: opts.startTime, timeZone: 'America/Chicago' }
  if (opts.endTime) requestBody.end = { dateTime: opts.endTime, timeZone: 'America/Chicago' }
  if (opts.attendees) requestBody.attendees = opts.attendees.map(email => ({ email }))
  const res = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody,
    sendUpdates: 'all',
  })
  return res.data.id
}

export async function createCalendarEvent(opts: {
  summary: string
  description?: string
  startTime: string
  endTime: string
  attendees?: string[]
  zoomLink?: string
  location?: string
}) {
  const calendar = google.calendar({ version: 'v3', auth: getAuthClient() })
  const location = opts.location ?? opts.zoomLink
  // Captain hotfix 2026-05-19: ALWAYS prepend Zoom URL to description as a
  // visible link. Previously the URL was put in `location` only, which Outlook
  // and many email clients show as a non-clickable "Zoom meeting" label until
  // the recipient opens the event. Putting it at the top of the description
  // surfaces it in compact previews and copy-paste flows.
  const zoomBlock = opts.zoomLink ? `Join Zoom: ${opts.zoomLink}\n\n` : ''
  const description = zoomBlock + (opts.description || '')
  const res = await calendar.events.insert({
    calendarId: 'primary',
    sendUpdates: 'all', // Gideon 2026-06-18: actually email/notify every attendee (recipient + Chaim + Steve) so it lands on their calendars
    requestBody: {
      summary: opts.summary,
      description,
      location,
      start: { dateTime: opts.startTime, timeZone: 'America/Chicago' },
      end: { dateTime: opts.endTime, timeZone: 'America/Chicago' },
      attendees: opts.attendees?.map(email => ({ email })),
    },
  })
  return res.data.id
}

/**
 * Captain hotfix 2026-05-19: expose freebusy lookup so the booking page can
 * filter proposed_slots against Gideon's actual calendar before showing them
 * to a recipient. Returns busy intervals in ms-epoch range.
 */
export interface BusyInterval {
  start: number
  end: number
}

export async function getBusyTimes(timeMin: string, timeMax: string): Promise<BusyInterval[]> {
  try {
    const calendar = google.calendar({ version: 'v3', auth: getAuthClient() })
    // Gideon 2026-06-22: g@reprime.com is fully independent. Check ONLY its own
    // calendar — never any other linked/secondary calendar.
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
  } catch (err) {
    // Graceful degradation — if freebusy fails, return [] (no conflicts known).
    // Better to show a slot that might conflict than to show nothing.
    console.error('[google.getBusyTimes] failed', err)
    return []
  }
}

export function slotOverlapsBusy(slotIso: string, durationMinutes: number, busy: BusyInterval[]): boolean {
  const start = new Date(slotIso).getTime()
  if (isNaN(start)) return false
  const end = start + durationMinutes * 60 * 1000
  for (const b of busy) {
    if (start < b.end && end > b.start) return true
  }
  return false
}
