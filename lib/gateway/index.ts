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
  try {
    const { timelinesWhatsAppProvider } = await import('./providers/whatsapp/timelines-adapter')
    gateway.register(timelinesWhatsAppProvider)
  } catch (e) { console.warn('[gateway] timelines adapter load failed:', (e as Error).message) }

  try {
    const { metaWhatsAppProvider } = await import('./providers/whatsapp/meta-cloud-adapter')
    gateway.register(metaWhatsAppProvider)
  } catch (e) { console.warn('[gateway] meta wa adapter load failed:', (e as Error).message) }

  try {
    const { gmailProvider } = await import('./providers/email/gmail-adapter')
    gateway.register(gmailProvider)
  } catch (e) { console.warn('[gateway] gmail adapter load failed:', (e as Error).message) }

  try {
    const { sendgridProvider } = await import('./providers/email/sendgrid-adapter')
    gateway.register(sendgridProvider)
  } catch (e) { console.warn('[gateway] sendgrid adapter load failed:', (e as Error).message) }

  try {
    const { anthropicProvider } = await import('./providers/ai/anthropic-adapter')
    gateway.register(anthropicProvider)
  } catch (e) { console.warn('[gateway] anthropic adapter load failed:', (e as Error).message) }

  try {
    const { openaiProvider } = await import('./providers/ai/openai-adapter')
    gateway.register(openaiProvider)
  } catch (e) { console.warn('[gateway] openai adapter load failed:', (e as Error).message) }

  try {
    const { openaiSTTProvider } = await import('./providers/stt/openai-whisper-adapter')
    gateway.register(openaiSTTProvider)
  } catch (e) { console.warn('[gateway] openai stt adapter load failed:', (e as Error).message) }

  try {
    const { elevenLabsTTSProvider } = await import('./providers/tts/elevenlabs-adapter')
    gateway.register(elevenLabsTTSProvider)
  } catch (e) { console.warn('[gateway] elevenlabs adapter load failed:', (e as Error).message) }

  try {
    const { openaiTTSProvider } = await import('./providers/tts/openai-tts-adapter')
    gateway.register(openaiTTSProvider)
  } catch (e) { console.warn('[gateway] openai tts adapter load failed:', (e as Error).message) }

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
} from './types'
