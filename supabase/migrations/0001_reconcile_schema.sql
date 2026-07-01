-- Migration: Notes, Briefings, and WhatsApp schema reconciliation

-- 1. Create whatsapp_threads table
CREATE TABLE IF NOT EXISTS whatsapp_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    panel VARCHAR(10) NOT NULL, -- '718' or '305'
    channel_type VARCHAR(20) NOT NULL, -- 'whatsapp', 'imessage', 'sms'
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

-- 2. Create whatsapp_messages table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES whatsapp_threads(id) ON DELETE CASCADE,
    panel VARCHAR(10) NOT NULL,
    channel_type VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL, -- 'in' or 'out'
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

-- 3. Create notes table
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    created_by UUID REFERENCES org_members(id) ON DELETE SET NULL,
    linked_source_type VARCHAR(50),
    linked_source_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- 4. Create briefings table
CREATE TABLE IF NOT EXISTS briefings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'morning', 'evening', 'meeting'
    content TEXT NOT NULL,
    generated_for UUID REFERENCES org_members(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- 5. Create nora_chat_messages table
CREATE TABLE IF NOT EXISTS nora_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- 6. Create roster table (Contacts board)
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

-- 6. Create outbound_asks table
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_phone ON whatsapp_threads(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_thread_id ON whatsapp_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_at ON whatsapp_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_roster_phone ON roster(phone);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_outbound_asks_recipient ON outbound_asks(recipient_identifier);
