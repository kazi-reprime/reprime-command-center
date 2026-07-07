-- Gateway Infrastructure Tables
-- Adds durable outbox/inbox, provider health, and agent session tracking

-- ── Gateway Outbox ─────────────────────────────────────────────────────────────
-- Durable outbox for all outbound messages/actions
CREATE TABLE IF NOT EXISTS gateway_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability TEXT NOT NULL,
  provider_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'failed', 'retry_scheduled', 'ambiguous', 'dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  idempotency_key TEXT NOT NULL,
  external_id TEXT,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gateway_outbox_idempotency
  ON gateway_outbox (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_gateway_outbox_status
  ON gateway_outbox (status) WHERE status IN ('pending', 'retry_scheduled');
CREATE INDEX IF NOT EXISTS idx_gateway_outbox_capability
  ON gateway_outbox (capability, status);

-- ── Gateway Inbox ──────────────────────────────────────────────────────────────
-- Deduplicated inbound webhook events
CREATE TABLE IF NOT EXISTS gateway_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  normalized_payload JSONB,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'verified', 'deduplicated', 'processing', 'processed', 'failed')),
  idempotency_key TEXT NOT NULL,
  signature_valid BOOLEAN,
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gateway_inbox_idempotency
  ON gateway_inbox (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_gateway_inbox_status
  ON gateway_inbox (status) WHERE status IN ('received', 'verified', 'processing');

-- ── Provider Health Snapshots ──────────────────────────────────────────────────
-- Periodic health snapshots for monitoring dashboard
CREATE TABLE IF NOT EXISTS provider_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id TEXT NOT NULL,
  state TEXT NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  failure_streak INTEGER NOT NULL DEFAULT 0,
  circuit_breaker_state TEXT NOT NULL DEFAULT 'closed',
  error_message TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_health_provider
  ON provider_health (provider_id, recorded_at DESC);

-- ── Agent Sessions ─────────────────────────────────────────────────────────────
-- Persistent agent conversation state across page reloads
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  tool_trace JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_sessions_session
  ON agent_sessions (session_id);

-- ── Approvals ──────────────────────────────────────────────────────────────────
-- Approval gate for sensitive agent actions
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approvals_status
  ON approvals (status) WHERE status = 'pending';

-- ── Contact Identities ─────────────────────────────────────────────────────────
-- Identity graph for merging contacts across channels
CREATE TABLE IF NOT EXISTS contact_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  whatsapp_thread_id TEXT,
  pipedrive_contact_id TEXT,
  gmail_contact_id TEXT,
  channel TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_identities_phone
  ON contact_identities (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_identities_email
  ON contact_identities (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_identities_name
  ON contact_identities (canonical_name);
