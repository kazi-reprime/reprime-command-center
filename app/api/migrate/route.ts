import { NextResponse } from 'next/server';
import { Client } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sql = `
-- 1. Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES org_members(id) ON DELETE SET NULL,
  linked_source_type VARCHAR(50),
  linked_source_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- 2. Create briefings table
CREATE TABLE IF NOT EXISTS briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  generated_for UUID REFERENCES org_members(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- 3. Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  company VARCHAR(255),
  is_investor BOOLEAN DEFAULT FALSE NOT NULL,
  is_staff BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- 4. Create contact_labels table
CREATE TABLE IF NOT EXISTS contact_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  label VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- 5. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  action VARCHAR(255) NOT NULL,
  actor_id UUID REFERENCES org_members(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- 6. Create decision_log table
CREATE TABLE IF NOT EXISTS decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  decided_by VARCHAR(100) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'active' NOT NULL,
  is_reversible BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- 7. Create whatsapp_threads table
CREATE TABLE IF NOT EXISTS whatsapp_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    panel VARCHAR(10) NOT NULL,
    channel_type VARCHAR(20) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    contact_name TEXT,
    is_group BOOLEAN DEFAULT FALSE NOT NULL,
    jid TEXT,
    last_message_at TIMESTAMP,
    last_message_preview TEXT,
    unread_count INTEGER DEFAULT 0 NOT NULL,
    pipedrive_contact_id INTEGER,
    is_investor BOOLEAN DEFAULT FALSE NOT NULL,
    is_family BOOLEAN DEFAULT FALSE NOT NULL,
    is_staff BOOLEAN DEFAULT FALSE NOT NULL,
    is_blocked BOOLEAN DEFAULT FALSE NOT NULL,
    timelines_chat_id INTEGER,
    is_priority BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL,
    UNIQUE(panel, phone, channel_type)
);
-- Seed an organization if it doesn't exist
INSERT INTO organizations (id, name, slug) VALUES ('00000000-0000-0000-0000-000000000000', 'RePrime', 'reprime') ON CONFLICT DO NOTHING;

-- Seed some payments
INSERT INTO payments (org_id, title, amount, payee, due_date, status) VALUES 
('00000000-0000-0000-0000-000000000000', 'Legal Settlement', 150000, 'Cohen Law Firm Escrow', now() + interval '1 day', 'pending'),
('00000000-0000-0000-0000-000000000000', 'Q3 Investor Distribution', 85000, 'Sarah Chen', now(), 'pending'),
('00000000-0000-0000-0000-000000000000', 'Vendor Invoice 402', 12500, 'Apex Roofing LLC', now() - interval '2 days', 'overdue')
ON CONFLICT DO NOTHING;

-- 8. Create whatsapp_messages table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES whatsapp_threads(id) ON DELETE CASCADE,
    panel VARCHAR(10) NOT NULL,
    channel_type VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    body TEXT,
    media_url TEXT,
    media_type TEXT,
    media_filename TEXT,
    timelines_uid TEXT UNIQUE,
    from_phone VARCHAR(50),
    from_name TEXT,
    sent_at TIMESTAMP,
    status TEXT,
    is_group_message BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- 9. Create roster table (Contacts board)
CREATE TABLE IF NOT EXISTS roster (
    source_row SERIAL PRIMARY KEY,
    phone VARCHAR(50),
    board_stage VARCHAR(50),
    thread_json JSONB,
    awaiting_us BOOLEAN DEFAULT FALSE,
    last_reply_at TIMESTAMP,
    last_reply_text TEXT,
    last_from VARCHAR(10),
    updated_at TIMESTAMP DEFAULT now() NOT NULL,
    UNIQUE(phone)
);
-- 9. Create nora_chat_messages table
CREATE TABLE IF NOT EXISTS nora_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP DEFAULT now() NOT NULL
);
-- 10. Create outbound_asks table
CREATE TABLE IF NOT EXISTS outbound_asks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    sender_identity VARCHAR(255) NOT NULL,
    recipient_identifier VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    body TEXT,
    sent_at TIMESTAMP DEFAULT now() NOT NULL,
    expected_reply_by TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'open' NOT NULL,
    related_thread_id UUID,
    reminded_at TIMESTAMP,
    closed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);
  `;

  const url = new URL(process.env.DATABASE_URL || '');
  url.searchParams.delete('sslmode');
  const connectionString = url.toString();

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query(sql);
    return NextResponse.json({ success: true, message: 'Migration completed' });
  } catch (error: unknown) {
    console.error('Migration failed:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  } finally {
    await client.end();
  }
}

export async function POST() {
  return GET();
}
