/**
 * Zoom Meeting Provider Adapter
 *
 * Wraps the existing lib/zoom/client.ts with the gateway adapter pattern.
 * Provides meeting CRUD + participant lookup through the gateway's
 * health-aware routing.
 */

import type {
  GatewayCapability,
  ProviderAdapter,
  ProviderHealth,
  CreateMeetingPayload,
  CreateMeetingResponse,
  ListMeetingsPayload,
  ListMeetingsResponse,
  MeetingParticipantsPayload,
  MeetingParticipantsResponse,
} from '../../types'
import { healthMonitor } from '../../health-monitor'

class ZoomAdapter implements ProviderAdapter {
  readonly id = 'zoom'
  readonly name = 'Zoom (S2S OAuth)'
  readonly capabilities: GatewayCapability[] = [
    'meeting:create',
    'meeting:list',
    'meeting:participants',
    'meeting:transcript',
    'zoom:sync',
    'zoom:create',
    'zoom:update',
    'zoom:delete',
    'zoom:participants',
    'zoom:recordings',
  ]
  readonly priority = 1

  isConfigured(): boolean {
    return (
      !!process.env.ZOOM_ACCOUNT_ID &&
      !!process.env.ZOOM_CLIENT_ID &&
      !!process.env.ZOOM_CLIENT_SECRET
    )
  }

  getHealth(): ProviderHealth {
    return healthMonitor.getHealth(this.id)
  }

  async execute<TInput, TOutput>(capability: GatewayCapability, input: TInput): Promise<TOutput> {
    if (!this.isConfigured()) throw new Error('Zoom not configured')

    switch (capability) {
      case 'meeting:create':
      case 'zoom:create':
        return this.createMeeting(input as unknown as CreateMeetingPayload) as unknown as TOutput
      case 'meeting:list':
      case 'zoom:sync':
        return this.listMeetings(input as unknown as ListMeetingsPayload) as unknown as TOutput
      case 'meeting:participants':
      case 'zoom:participants':
        return this.getParticipants(
          input as unknown as MeetingParticipantsPayload,
        ) as unknown as TOutput
      case 'zoom:recordings':
      case 'meeting:transcript':
        return this.getRecordings(input as unknown as { meetingId: string }) as unknown as TOutput
      default:
        throw new Error(`Capability ${capability} not implemented by ${this.id}`)
    }
  }

  private async createMeeting(payload: CreateMeetingPayload): Promise<CreateMeetingResponse> {
    const { createMeeting } = await import('@/lib/zoom/client')
    const meeting = await createMeeting('me', {
      topic: payload.topic,
      start_time: payload.startTime,
      duration: payload.duration,
      timezone: payload.timezone,
      agenda: payload.agenda,
    })
    return {
      meetingId: meeting.id,
      joinUrl: meeting.join_url,
      startUrl: meeting.start_url,
      password: meeting.password,
    }
  }

  private async listMeetings(payload: ListMeetingsPayload): Promise<ListMeetingsResponse> {
    const { zoomRequest } = await import('@/lib/zoom/client')
    const userId = payload.userId || 'me'
    const type = payload.type === 'past' ? 'previous_meetings' : 'upcoming'
    const data = await zoomRequest<{
      meetings: Array<{
        id: number
        topic: string
        start_time: string
        duration: number
        join_url: string
        status?: string
      }>
    }>(`/users/${encodeURIComponent(userId)}/meetings?type=${type}&page_size=30`)
    return {
      meetings: (data.meetings || []).map(m => ({
        id: m.id,
        topic: m.topic,
        startTime: m.start_time,
        duration: m.duration,
        joinUrl: m.join_url,
        status: m.status,
      })),
    }
  }

  private async getParticipants(
    payload: MeetingParticipantsPayload,
  ): Promise<MeetingParticipantsResponse> {
    const { getPastMeetingAttendance } = await import('@/lib/zoom/client')
    const attendance = await getPastMeetingAttendance(String(payload.meetingId))
    const raw = attendance.raw as {
      participants?: Array<{
        name?: string
        user_email?: string
        duration?: number
        join_time?: string
      }>
    }
    return {
      participants: (raw?.participants || []).map(p => ({
        name: p.name || 'Unknown',
        email: p.user_email,
        duration: p.duration,
        joinTime: p.join_time,
      })),
      total: attendance.participantCount,
    }
  }

  private async getRecordings(payload: { meetingId: string }): Promise<unknown> {
    const { zoomRequest } = await import('@/lib/zoom/client')
    try {
      return await zoomRequest(
        `/meetings/${encodeURIComponent(payload.meetingId)}/recordings`,
      )
    } catch {
      return { recording_files: [], message: 'No recordings available' }
    }
  }

  async probe(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const { zoomRequest } = await import('@/lib/zoom/client')
      await zoomRequest('/users/me')
      return true
    } catch {
      return false
    }
  }
}

export const zoomProvider = new ZoomAdapter()
