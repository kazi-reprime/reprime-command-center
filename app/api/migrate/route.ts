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
  `;

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query(sql);
    return NextResponse.json({ success: true, message: 'Migration completed' });
  } catch (error: any) {
    console.error('Migration failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
