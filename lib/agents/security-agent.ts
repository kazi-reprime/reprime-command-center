/**
 * Security / Approval Agent — Guardrails for sensitive actions
 *
 * Validates, rate-limits, and gates sensitive operations:
 * - Outbound message sending
 * - Meeting creation
 * - Data deletion
 * - Bulk operations
 */

import { type AgentDefinition, type AgentTool, registerAgent } from './types'

const reviewAction: AgentTool = {
  name: 'review_pending_action',
  description: 'Review a pending action that requires approval. Returns the action details for Gideon to approve or reject.',
  parameters: {
    action_id: { type: 'string', description: 'Pending action ID' },
  },
  async execute(params) {
    const actionId = String(params.action_id || '')
    // In a full implementation, this would look up pending actions from a queue
    return JSON.stringify({
      actionId,
      message: 'Action review requested. Present details to Gideon for approval.',
    })
  },
}

const checkRateLimit: AgentTool = {
  name: 'check_rate_limit',
  description: 'Check if an outbound action is within rate limits (e.g., max WhatsApp messages per hour).',
  parameters: {
    channel: { type: 'string', description: "'whatsapp', 'email', 'zoom'" },
    action: { type: 'string', description: "'send', 'create', 'bulk'" },
  },
  async execute(params) {
    const channel = String(params.channel || '')
    const action = String(params.action || 'send')

    // Rate limit thresholds
    const limits: Record<string, number> = {
      'whatsapp:send': 50,    // per hour
      'whatsapp:bulk': 5,     // per day
      'email:send': 100,      // per hour
      'email:bulk': 3,        // per day
      'zoom:create': 20,      // per day
    }

    const key = `${channel}:${action}`
    const limit = limits[key] || 100

    // In production, check Redis counters
    return JSON.stringify({
      channel,
      action,
      limit,
      remaining: limit, // Would be computed from Redis
      allowed: true,
    })
  },
}

const securityAgent: AgentDefinition = {
  id: 'security',
  name: 'Security Agent',
  description: 'Validates and gates sensitive actions — approvals, rate limits, content filtering',
  systemPrompt: `You are Nora's Security gatekeeper. You ensure sensitive actions are properly approved.

Your tools:
- review_pending_action: Review an action awaiting approval
- check_rate_limit: Verify rate limits before allowing actions

Security rules:
1. ALL outbound messages (WhatsApp, email) need explicit approval
2. Bulk operations are always flagged for review
3. Meeting creation with external attendees needs confirmation
4. Never allow deletion of data without double-confirmation
5. Rate limit violations block the action and notify Gideon`,
  tools: [reviewAction, checkRateLimit],
  canHandoffTo: ['orchestrator'],
  maxToolRounds: 1,
}

registerAgent(securityAgent)
export { securityAgent }
