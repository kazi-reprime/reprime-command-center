/**
 * Integration Gateway — Public API
 * 
 * Capability-based interface. Callers request what they need,
 * never which vendor to use.
 * 
 * Usage:
 *   import { gateway } from '@/lib/gateway'
 *   const result = await gateway.sendWhatsApp({ to: '+1...', body: 'Hello' })
 *   const result = await gateway.generateText({ messages: [...] })
 */

import { executeRequest, getHealthReport, registerProvider, onAudit, hasCapability } from './provider-registry'
import { writeAuditLog } from './audit'
import type {
  GatewayResponse,
  SendWhatsAppPayload,
  SendSMSPayload,
  SendEmailPayload,
  AICompletionPayload,
  AICompletionResponse,
  STTPayload,
  STTResponse,
  TTSPayload,
  TTSResponse,
  SearchPayload,
  SearchResponse,
  CreateMeetingPayload,
  CreateMeetingResponse,
  ListMeetingsPayload,
  ListMeetingsResponse,
  MeetingParticipantsPayload,
  MeetingParticipantsResponse,
  FetchEmailsPayload,
  FetchEmailsResponse,
  EmailThreadPayload,
  EmailThreadResponse,
  EmailReplyPayload,
  GatewayHealthReport,
  ProviderAdapter,
} from './types'

// ── Wire audit logs to the database ────────────────────────────────────────────

onAudit(writeAuditLog)

// ── Capability-Based Public API ────────────────────────────────────────────────

export const gateway = {
  // ── WhatsApp ───────────────────────────────────────────────────────────────
  async sendWhatsApp(payload: SendWhatsAppPayload): Promise<GatewayResponse> {
    return executeRequest({
      capability: 'whatsapp:send',
      payload,
      idempotencyKey: `wa:${payload.to}:${Date.now()}`,
      metadata: { to: payload.to, lane: payload.lane },
    })
  },

  // ── SMS ────────────────────────────────────────────────────────────────────
  async sendSMS(payload: SendSMSPayload): Promise<GatewayResponse> {
    return executeRequest({
      capability: 'sms:send',
      payload,
      idempotencyKey: `sms:${payload.to}:${Date.now()}`,
      metadata: { to: payload.to },
    })
  },

  // ── Email ──────────────────────────────────────────────────────────────────
  async sendEmail(payload: SendEmailPayload): Promise<GatewayResponse> {
    return executeRequest({
      capability: 'email:send',
      payload,
      idempotencyKey: `email:${payload.to}:${payload.subject}:${Date.now()}`,
      metadata: { to: payload.to, subject: payload.subject },
    })
  },

  async fetchEmails(payload: FetchEmailsPayload): Promise<GatewayResponse<FetchEmailsResponse>> {
    return executeRequest<FetchEmailsPayload, FetchEmailsResponse>({
      capability: 'email:read',
      payload,
      metadata: { account: payload.account, maxResults: payload.maxResults },
    })
  },

  async getEmailThread(payload: EmailThreadPayload): Promise<GatewayResponse<EmailThreadResponse>> {
    return executeRequest<EmailThreadPayload, EmailThreadResponse>({
      capability: 'email:thread',
      payload,
      metadata: { threadId: payload.threadId },
    })
  },

  async replyToEmail(payload: EmailReplyPayload): Promise<GatewayResponse> {
    return executeRequest({
      capability: 'email:send',
      payload,
      idempotencyKey: `email-reply:${payload.threadId}:${Date.now()}`,
      metadata: { threadId: payload.threadId, to: payload.to },
    })
  },

  // ── AI / LLM ───────────────────────────────────────────────────────────────
  async generateText(payload: AICompletionPayload): Promise<GatewayResponse<AICompletionResponse>> {
    return executeRequest<AICompletionPayload, AICompletionResponse>({
      capability: 'ai:chat',
      payload,
      metadata: { model: payload.model, messageCount: payload.messages.length },
    })
  },

  // ── STT ────────────────────────────────────────────────────────────────────
  async transcribe(payload: STTPayload): Promise<GatewayResponse<STTResponse>> {
    return executeRequest<STTPayload, STTResponse>({
      capability: 'stt:transcribe',
      payload,
      metadata: { language: payload.language },
    })
  },

  // ── TTS ────────────────────────────────────────────────────────────────────
  async synthesize(payload: TTSPayload): Promise<GatewayResponse<TTSResponse>> {
    return executeRequest<TTSPayload, TTSResponse>({
      capability: 'tts:synthesize',
      payload,
      metadata: { voice: payload.voice, textLength: payload.text.length },
    })
  },

  // ── Search ─────────────────────────────────────────────────────────────────
  async search(payload: SearchPayload): Promise<GatewayResponse<SearchResponse>> {
    return executeRequest<SearchPayload, SearchResponse>({
      capability: 'search:web',
      payload,
      metadata: { query: payload.query },
    })
  },

  // ── Zoom / Meetings ────────────────────────────────────────────────────────
  async createMeeting(payload: CreateMeetingPayload): Promise<GatewayResponse<CreateMeetingResponse>> {
    return executeRequest<CreateMeetingPayload, CreateMeetingResponse>({
      capability: 'meeting:create',
      payload,
      idempotencyKey: `meeting:${payload.topic}:${payload.startTime}`,
      metadata: { topic: payload.topic },
    })
  },

  async listMeetings(payload: ListMeetingsPayload = {}): Promise<GatewayResponse<ListMeetingsResponse>> {
    return executeRequest<ListMeetingsPayload, ListMeetingsResponse>({
      capability: 'meeting:list',
      payload,
      metadata: { type: payload.type },
    })
  },

  async getMeetingParticipants(payload: MeetingParticipantsPayload): Promise<GatewayResponse<MeetingParticipantsResponse>> {
    return executeRequest<MeetingParticipantsPayload, MeetingParticipantsResponse>({
      capability: 'meeting:participants',
      payload,
      metadata: { meetingId: payload.meetingId },
    })
  },

  // ── Health & Status ────────────────────────────────────────────────────────
  getHealth(): GatewayHealthReport {
    return getHealthReport()
  },

  hasCapability,

  /** Register a new provider adapter */
  register(adapter: ProviderAdapter): void {
    registerProvider(adapter)
  },
}

// ── Provider Auto-Registration ─────────────────────────────────────────────────

/**
 * Initialize all configured providers. Called once at app startup.
 * Each provider checks its own env vars and self-reports configuration status.
 */
export async function initializeGateway(): Promise<void> {
  console.log('[gateway] initializing providers...')

  // Dynamic imports to avoid loading unconfigured providers
  const loaders: Array<[string, () => Promise<{ default?: unknown; [k: string]: unknown }>]> = [
    // WhatsApp
    ['timelines-wa', () => import('./providers/whatsapp/timelines-adapter')],
    ['meta-wa', () => import('./providers/whatsapp/meta-cloud-adapter')],
    // Email
    ['gmail', () => import('./providers/email/gmail-adapter')],
    ['sendgrid', () => import('./providers/email/sendgrid-adapter')],
    // AI — Primary
    ['anthropic', () => import('./providers/ai/anthropic-adapter')],
    ['openai', () => import('./providers/ai/openai-adapter')],
    // AI — Secondary
    ['gemini', () => import('./providers/ai/gemini-adapter')],
    ['groq', () => import('./providers/ai/groq-adapter')],
    ['openrouter', () => import('./providers/ai/openrouter-adapter')],
    // STT
    ['openai-stt', () => import('./providers/stt/openai-whisper-adapter')],
    ['groq-whisper', () => import('./providers/stt/groq-whisper-adapter')],
    ['deepgram', () => import('./providers/stt/deepgram-adapter')],
    // TTS
    ['elevenlabs', () => import('./providers/tts/elevenlabs-adapter')],
    ['openai-tts', () => import('./providers/tts/openai-tts-adapter')],
    // Zoom
    ['zoom', () => import('./providers/zoom/zoom-adapter')],
  ]

  const results = await Promise.allSettled(
    loaders.map(async ([name, loader]) => {
      try {
        const mod = await loader()
        // Find the exported provider (convention: <name>Provider)
        const providerKey = Object.keys(mod).find(
          k => k.endsWith('Provider') && typeof (mod as Record<string, unknown>)[k] === 'object',
        )
        if (providerKey) {
          gateway.register((mod as Record<string, ProviderAdapter>)[providerKey])
        }
      } catch (e) {
        console.warn(`[gateway] ${name} adapter load failed:`, (e as Error).message)
      }
    }),
  )

  const failures = results.filter(r => r.status === 'rejected').length
  if (failures > 0) {
    console.warn(`[gateway] ${failures} adapter(s) failed to load`)
  }

  const health = getHealthReport()
  console.log(
    `[gateway] initialized — ${health.providers.length} providers, ` +
    `overall: ${health.overall}, ` +
    `configured: ${health.providers.filter(p => p.health.state !== 'not_configured').length}`,
  )
}

// Re-export types for convenience
export type {
  GatewayResponse,
  GatewayCapability,
  ProviderHealthState,
  GatewayHealthReport,
  SendWhatsAppPayload,
  SendSMSPayload,
  SendEmailPayload,
  AICompletionPayload,
  AICompletionResponse,
  STTPayload,
  STTResponse,
  TTSPayload,
  TTSResponse,
  CreateMeetingPayload,
  CreateMeetingResponse,
  ListMeetingsPayload,
  ListMeetingsResponse,
  FetchEmailsPayload,
  FetchEmailsResponse,
  EmailThreadPayload,
  EmailThreadResponse,
  EmailReplyPayload,
} from './types'

