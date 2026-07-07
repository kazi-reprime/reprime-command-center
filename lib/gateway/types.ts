/**
 * Gateway Core Types
 * 
 * Shared type definitions for the Integration Gateway.
 * All provider adapters, circuit breakers, health monitors,
 * and routing logic share these contracts.
 */

// ── Provider & Capability Types ────────────────────────────────────────────────

/** Capabilities the gateway can fulfill — callers request these, never vendors */
export type GatewayCapability =
  | 'whatsapp:send'
  | 'whatsapp:receive'
  | 'whatsapp:media'
  | 'sms:send'
  | 'sms:receive'
  | 'imessage:send'
  | 'imessage:receive'
  | 'email:send'
  | 'email:receive'
  | 'email:sync'
  | 'phone:call'
  | 'phone:voicemail'
  | 'ai:chat'
  | 'ai:chat:vision'
  | 'ai:embeddings'
  | 'stt:transcribe'
  | 'tts:synthesize'
  | 'search:web'
  | 'search:semantic'
  | 'calendar:read'
  | 'calendar:write'
  | 'meeting:create'
  | 'meeting:join'
  | 'meeting:transcript'
  | 'meeting:list'
  | 'meeting:participants'
  | 'meeting:recordings'
  | 'meeting:summary'
  | 'email:read'
  | 'email:thread'
  | 'email:search'
  | 'email:attachments'
  | 'zoom:sync'
  | 'zoom:create'
  | 'zoom:update'
  | 'zoom:delete'
  | 'zoom:participants'
  | 'zoom:recordings'
  | 'memory:store'
  | 'memory:recall'
  | 'browser:navigate'
  | 'browser:extract'

/** Truthful provider health states — never fake "connected" */
export type ProviderHealthState =
  | 'healthy'
  | 'degraded'
  | 'failing_over'
  | 'rate_limited'
  | 'auth_failed'
  | 'not_configured'
  | 'disconnected'

/** Circuit breaker states per Martin Fowler pattern */
export type CircuitBreakerState = 'closed' | 'open' | 'half_open'

/** Outbox entry lifecycle */
export type OutboxStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'retry_scheduled'
  | 'ambiguous'
  | 'dead_letter'

/** Inbox entry lifecycle */
export type InboxStatus =
  | 'received'
  | 'verified'
  | 'deduplicated'
  | 'processing'
  | 'processed'
  | 'failed'

// ── Provider Adapter Contract ──────────────────────────────────────────────────

export interface ProviderHealth {
  state: ProviderHealthState
  latencyMs: number
  lastSuccessAt: Date | null
  lastFailureAt: Date | null
  failureStreak: number
  rateLimitResetAt: Date | null
  errorMessage?: string
}

export interface ProviderAdapter {
  /** Unique provider identifier e.g. 'timelines', 'twilio', 'anthropic' */
  readonly id: string
  /** Human-readable name e.g. 'Timelines.ai', 'Twilio' */
  readonly name: string
  /** Capabilities this provider can fulfill */
  readonly capabilities: GatewayCapability[]
  /** Priority (lower = preferred). Used for ordering when multiple providers available */
  readonly priority: number

  /** Check if provider is configured (has required env vars) */
  isConfigured(): boolean
  /** Get current health snapshot — never throws */
  getHealth(): ProviderHealth
  /** Execute a capability request — throws on failure */
  execute<TInput, TOutput>(capability: GatewayCapability, input: TInput): Promise<TOutput>
  /** Optional: test connectivity (called during health probe) */
  probe?(): Promise<boolean>
}

// ── Circuit Breaker Config ─────────────────────────────────────────────────────

export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold: number
  /** Time in ms to keep circuit open before trying half-open (default: 30000) */
  resetTimeoutMs: number
  /** Number of successful probes in half-open before closing (default: 2) */
  successThreshold: number
  /** Time window in ms for failure counting (default: 60000) */
  windowMs: number
}

export interface CircuitBreakerSnapshot {
  providerId: string
  state: CircuitBreakerState
  failureCount: number
  successCount: number
  lastFailureAt: Date | null
  lastSuccessAt: Date | null
  lastStateChangeAt: Date
  nextProbeAt: Date | null
}

// ── Outbox Entry ───────────────────────────────────────────────────────────────

export interface OutboxEntry {
  id: string
  capability: GatewayCapability
  providerId: string | null
  payload: Record<string, unknown>
  status: OutboxStatus
  attempts: number
  maxAttempts: number
  idempotencyKey: string
  createdAt: Date
  updatedAt: Date
  scheduledAt: Date | null
  sentAt: Date | null
  deliveredAt: Date | null
  failedAt: Date | null
  errorMessage: string | null
  /** Provider-specific message/delivery ID for reconciliation */
  externalId: string | null
}

// ── Inbox Entry ────────────────────────────────────────────────────────────────

export interface InboxEntry {
  id: string
  capability: GatewayCapability
  providerId: string
  /** Raw webhook/event payload, preserved for debugging */
  rawPayload: Record<string, unknown>
  /** Normalized payload after processing */
  normalizedPayload: Record<string, unknown> | null
  status: InboxStatus
  /** Provider-specific dedup key */
  idempotencyKey: string
  receivedAt: Date
  processedAt: Date | null
  errorMessage: string | null
  /** Webhook signature verification result */
  signatureValid: boolean | null
}

// ── Gateway Request/Response ───────────────────────────────────────────────────

export interface GatewayRequest<T = unknown> {
  capability: GatewayCapability
  payload: T
  /** Optional: force a specific provider (bypass routing) */
  preferredProvider?: string
  /** Optional: idempotency key to prevent duplicate sends */
  idempotencyKey?: string
  /** Optional: metadata for audit logging */
  metadata?: Record<string, unknown>
}

export interface GatewayResponse<T = unknown> {
  success: boolean
  providerId: string
  data?: T
  error?: string
  /** How many providers were attempted before success/failure */
  attemptsCount: number
  /** Which providers were tried (in order) */
  providerChain: string[]
  /** Total latency across all attempts */
  totalLatencyMs: number
}

// ── Health Report ──────────────────────────────────────────────────────────────

export interface ProviderHealthReport {
  providerId: string
  name: string
  capabilities: GatewayCapability[]
  health: ProviderHealth
  circuitBreaker: CircuitBreakerSnapshot
}

export interface GatewayHealthReport {
  overall: 'ok' | 'degraded' | 'critical'
  providers: ProviderHealthReport[]
  timestamp: Date
}

// ── Audit Log Entry ────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  action: string
  capability: GatewayCapability
  providerId: string | null
  success: boolean
  latencyMs: number
  metadata?: Record<string, unknown>
  error?: string
  timestamp: Date
}

// ── Channel-Specific Payloads ──────────────────────────────────────────────────

export interface SendWhatsAppPayload {
  to: string
  body: string
  mediaUrl?: string
  /** Which account/lane: '305' or '718' */
  lane?: '305' | '718'
}

export interface SendSMSPayload {
  to: string
  body: string
  from?: string
}

export interface SendEmailPayload {
  to: string
  subject: string
  body: string
  html?: string
  cc?: string
  bcc?: string
  threadId?: string
  replyToMessageId?: string
}

export interface AICompletionPayload {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  model?: string
  maxTokens?: number
  temperature?: number
  tools?: unknown[]
}

export interface AICompletionResponse {
  content: string
  model: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  toolCalls?: unknown[]
  finishReason: string
}

export interface STTPayload {
  audio: Blob | Buffer | ArrayBuffer
  language?: string
  format?: string
}

export interface STTResponse {
  text: string
  language?: string
  confidence?: number
  segments?: { start: number; end: number; text: string }[]
}

export interface TTSPayload {
  text: string
  voice?: string
  model?: string
  language?: string
  speed?: number
  format?: string
}

export interface TTSResponse {
  audio: ArrayBuffer
  audioUrl?: string
  format: string
  durationMs?: number
}

export interface SearchPayload {
  query: string
  maxResults?: number
  domain?: string
}

export interface SearchResponse {
  results: { title: string; url: string; snippet: string; score?: number }[]
  query: string
}

// ── Zoom / Meeting Payloads ────────────────────────────────────────────────────

export interface CreateMeetingPayload {
  topic: string
  startTime: string
  duration: number
  timezone?: string
  agenda?: string
  attendees?: string[]
}

export interface CreateMeetingResponse {
  meetingId: number | string
  joinUrl: string
  startUrl?: string
  password?: string
}

export interface ListMeetingsPayload {
  userId?: string
  type?: 'upcoming' | 'past' | 'all'
}

export interface MeetingInfo {
  id: number | string
  topic: string
  startTime: string
  duration: number
  joinUrl: string
  status?: string
  participants?: number
}

export interface ListMeetingsResponse {
  meetings: MeetingInfo[]
}

export interface MeetingParticipantsPayload {
  meetingId: string | number
}

export interface MeetingParticipantsResponse {
  participants: { name: string; email?: string; duration?: number; joinTime?: string }[]
  total: number
}

// ── Email Read / Inbox Payloads ────────────────────────────────────────────────

export interface FetchEmailsPayload {
  account?: string
  maxResults?: number
  query?: string
  labelIds?: string[]
  /** Only messages after this date */
  after?: string
}

export interface EmailThreadInfo {
  threadId: string
  messageId: string
  from: string
  fromName: string
  to: string
  subject: string
  snippet: string
  body?: string
  htmlBody?: string
  receivedAt: string
  unread: boolean
  important: boolean
  hasAttachments: boolean
  hasCalendarInvite: boolean
  labels: string[]
  account: string
}

export interface FetchEmailsResponse {
  emails: EmailThreadInfo[]
  total: number
  account: string
}

export interface EmailThreadPayload {
  threadId: string
  account?: string
}

export interface EmailThreadResponse {
  threadId: string
  subject: string
  messages: EmailThreadInfo[]
}

export interface EmailReplyPayload {
  threadId: string
  inReplyTo: string
  to: string
  subject: string
  body: string
  html?: string
  cc?: string
  bcc?: string
  account?: string
}

