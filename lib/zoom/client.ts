const BASE_URL = 'https://api.zoom.us/v2'
const OAUTH_URL = 'https://zoom.us/oauth/token'

interface CachedToken {
  token: string
  expiresAt: number
}

let cached: CachedToken | null = null

async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET

  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      'ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET must be set'
    )
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const url = `${OAUTH_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(
    accountId
  )}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}` },
  })

  if (!res.ok) {
    throw new Error(`Zoom OAuth failed: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return data.access_token
}

export async function zoomRequest<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const accessToken = await getAccessToken()
  const res = await fetch(BASE_URL + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    throw new Error(
      `Zoom ${init.method ?? 'GET'} ${path} failed: ${res.status} ${await res.text()}`
    )
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface ZoomMeeting {
  id: number
  topic: string
  start_time: string
  duration: number
  timezone?: string
  join_url: string
  start_url?: string
  password?: string
}

export function createMeeting(
  userId: string,
  body: {
    topic: string
    start_time: string
    duration: number
    timezone?: string
    agenda?: string
    password?: string
  }
): Promise<ZoomMeeting> {
  return zoomRequest<ZoomMeeting>(`/users/${encodeURIComponent(userId)}/meetings`, {
    method: 'POST',
    body: JSON.stringify({ type: 2, ...body }),
  })
}

export function getMeeting(meetingId: number | string): Promise<ZoomMeeting> {
  return zoomRequest<ZoomMeeting>(`/meetings/${encodeURIComponent(String(meetingId))}`)
}

export function patchMeeting(
  meetingId: number | string,
  body: Partial<{
    topic: string
    start_time: string
    duration: number
    timezone: string
    agenda: string
  }>
): Promise<void> {
  return zoomRequest<void>(`/meetings/${encodeURIComponent(String(meetingId))}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteMeeting(meetingId: number | string): Promise<void> {
  return zoomRequest<void>(`/meetings/${encodeURIComponent(String(meetingId))}`, {
    method: 'DELETE',
  })
}

// ── Attendance verification ─────────────────────────────────────────────────
// "Did the booked meeting actually happen?" Zoom records who actually joined a
// past meeting and for how long. We read that to tell real attendance from
// people who said yes and never showed.
//
// Zoom exposes three overlapping participant feeds, with different scopes:
//   1. GET /past_meetings/{id}/participants  — dashboard feed (scope:
//      dashboard_meetings:read or meeting:read). Best first try.
//   2. GET /report/meetings/{id}/participants — report feed (scope:
//      report:read:admin / report_meetings:read). Has per-person duration.
//   3. GET /metrics/meetings/{id}/participants — metrics/dashboard feed
//      (scope: dashboard_meetings:read:admin). Live + historical.
// A single numeric meeting ID can 404 on one feed while another returns data,
// and recurring/UUID meetings sometimes need a double-encoded UUID. We try the
// feeds in order and use whichever first returns participants.

export interface ZoomAttendance {
  participantCount: number
  totalMinutes: number
  guestCount: number // participants who are NOT RePrime team — a real meeting needs ≥1
  raw: unknown
  ok: boolean // true = Zoom answered (0 participants is a REAL no-show); false = could not read Zoom
}

// Our own side joining a no-show meeting must NOT count as attendance. Anyone
// whose name/email matches the RePrime team is excluded from guestCount.
const REPRIME_TEAM = /reprime\.com|gideon|gratsiani|tahisa|shirel|chaim|\bnora\b|\bsteve\b|philipp/i

interface ZoomParticipant {
  // duration is in SECONDS on /report and /metrics feeds; /past_meetings omits it
  duration?: number
  user_id?: string
  id?: string
  name?: string
  user_email?: string
}

interface ZoomParticipantsResponse {
  participants?: ZoomParticipant[]
  participants_count?: number
  total_records?: number
}

function summarizeParticipants(data: ZoomParticipantsResponse): ZoomAttendance {
  const participants = Array.isArray(data.participants) ? data.participants : []
  // Prefer the explicit count Zoom reports; fall back to the array length.
  const reported = Number(data.participants_count ?? data.total_records ?? NaN)
  const participantCount = Number.isFinite(reported) && reported > 0 ? reported : participants.length
  // duration is in seconds → minutes. Sum across participants (each unique join
  // contributes its watched time). Guard non-numeric durations.
  const totalSeconds = participants.reduce((sum, p) => {
    const d = Number(p.duration)
    return sum + (Number.isFinite(d) && d > 0 ? d : 0)
  }, 0)
  const totalMinutes = Math.round(totalSeconds / 60)
  // Count GUEST joins only — exclude our own team so "Gideon + Steve waited but
  // the investor never showed" is correctly a no-show, not a false attendance.
  const guestCount = participants.filter((p) => {
    const idstr = `${p.name || ''} ${p.user_email || ''}`.trim()
    return idstr.length > 0 && !REPRIME_TEAM.test(idstr)
  }).length
  return { participantCount, totalMinutes, guestCount, raw: data, ok: true }
}

export async function getPastMeetingAttendance(
  meetingId: string
): Promise<ZoomAttendance> {
  const id = encodeURIComponent(String(meetingId))
  // Ordered candidates. First one that returns a non-empty participants payload wins.
  const paths = [
    `/past_meetings/${id}/participants?page_size=300`,
    `/report/meetings/${id}/participants?page_size=300`,
    `/metrics/meetings/${id}/participants?type=past&page_size=300`,
  ]

  let anyResolved = false
  for (const path of paths) {
    try {
      const data = await zoomRequest<ZoomParticipantsResponse>(path)
      anyResolved = true // Zoom answered this feed (even if empty)
      const summary = summarizeParticipants(data)
      // Treat an empty payload as "this feed has nothing" and try the next one.
      if (summary.participantCount > 0 || summary.totalMinutes > 0) {
        return summary
      }
    } catch {
      // 404 / scope error on this feed — fall through to the next candidate.
    }
  }

  // If at least one feed answered (anyResolved) but all were empty → a REAL
  // no-show (ok:true, 0 participants). If NO feed answered → we couldn't read
  // Zoom at all (ok:false) and must NOT be treated as a no-show.
  return { participantCount: 0, totalMinutes: 0, guestCount: 0, raw: null, ok: anyResolved }
}
