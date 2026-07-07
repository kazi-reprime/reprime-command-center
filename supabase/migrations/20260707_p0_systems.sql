-- P0 Migration: Zoom Meetings, Meeting Intelligence, and Nora Pending Actions
-- Run this via Supabase dashboard or `supabase db push`

-- ── Zoom Meetings ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zoom_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_id TEXT UNIQUE NOT NULL,
  topic TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration INTEGER,
  status TEXT DEFAULT 'scheduled',
  host_email TEXT,
  join_url TEXT,
  recording_url TEXT,
  transcript_url TEXT,
  recording_status TEXT,
  summary TEXT,
  action_items JSONB DEFAULT '[]',
  key_decisions JSONB DEFAULT '[]',
  unanswered_questions JSONB DEFAULT '[]',
  follow_ups JSONB DEFAULT '[]',
  attendance JSONB,
  participant_count INTEGER DEFAULT 0,
  guest_count INTEGER DEFAULT 0,
  no_show BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zoom_meetings_zoom_id ON zoom_meetings(zoom_id);
CREATE INDEX IF NOT EXISTS idx_zoom_meetings_start_time ON zoom_meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_zoom_meetings_status ON zoom_meetings(status);

-- ── Nora Pending Actions (approval queue) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS nora_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,        -- 'whatsapp:send', 'email:send', 'meeting:create'
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'executed', 'rejected', 'failed'
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON nora_pending_actions(status);
CREATE INDEX IF NOT EXISTS idx_pending_actions_created ON nora_pending_actions(created_at);

-- ── WhatsApp thread additions ──────────────────────────────────────────────────
-- Add columns if they don't exist (safe for re-runs)
ALTER TABLE whatsapp_threads ADD COLUMN IF NOT EXISTS is_priority BOOLEAN DEFAULT false;
ALTER TABLE whatsapp_threads ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT false;
ALTER TABLE whatsapp_threads ADD COLUMN IF NOT EXISTS is_family BOOLEAN DEFAULT false;
ALTER TABLE whatsapp_threads ADD COLUMN IF NOT EXISTS last_message_preview TEXT;

-- ── Zoom Events (ensure exists for webhook processor) ──────────────────────────
CREATE TABLE IF NOT EXISTS zoom_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Scheduled WhatsApp messages ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp', 'email', 'sms'
  to_identifier TEXT NOT NULL,               -- phone or email
  body TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled',           -- 'scheduled', 'sent', 'failed', 'cancelled'
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_time ON scheduled_messages(scheduled_for);

-- ── RLS policies (allow service role full access) ──────────────────────────────
ALTER TABLE zoom_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nora_pending_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies
CREATE POLICY IF NOT EXISTS "service_full_access" ON zoom_meetings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_full_access" ON nora_pending_actions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_full_access" ON scheduled_messages FOR ALL USING (true) WITH CHECK (true);
