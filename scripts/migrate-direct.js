const postgres = require('postgres');

const url = 'postgresql://postgres.yrnujfhzmoasodawqfri:Dcy%407700Dcy@aws-1-us-east-1.pooler.supabase.com:5432/postgres';
const sql = postgres(url, { prepare: false });

const schemaSql = `
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop old conflicting tables to ensure clean greenfield setup
DROP TABLE IF EXISTS nora_memory CASCADE;
DROP TABLE IF EXISTS bucket_items CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS threads CASCADE;
DROP TABLE IF EXISTS org_invites CASCADE;
DROP TABLE IF EXISTS org_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- 1. Create organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'starter' NOT NULL,
  stripe_customer_id VARCHAR(255),
  settings JSONB,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- 2. Create org_members table
CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  role VARCHAR(50) DEFAULT 'agent' NOT NULL,
  invited_at TIMESTAMP,
  joined_at TIMESTAMP
);

-- 3. Create org_invites table
CREATE TABLE org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'agent' NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP
);

-- 4. Create threads table
CREATE TABLE threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  contact_phone VARCHAR(50) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  lane_override VARCHAR(50) DEFAULT 'general' NOT NULL,
  is_blocked BOOLEAN DEFAULT FALSE NOT NULL,
  is_archived BOOLEAN DEFAULT FALSE NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
  last_message_at TIMESTAMP DEFAULT now() NOT NULL
);

-- 5. Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL,
  direction VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'received' NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- 6. Create bucket_items table
CREATE TABLE bucket_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  priority INTEGER DEFAULT 3 NOT NULL,
  project_tag VARCHAR(100),
  assigned_to UUID REFERENCES org_members(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES org_members(id) ON DELETE SET NULL,
  due_at_soft TIMESTAMP,
  remind_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- 7. Create nora_memory table
CREATE TABLE nora_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
`;

async function run() {
  try {
    console.log('Migrate: Starting database DDL migrations...');
    await sql.unsafe(schemaSql);
    console.log('Migrate: Greenfield schema created successfully!');

    // Seed default tenant organization
    const orgName = 'RePrime Group';
    const orgSlug = 'reprime-group';
    const [org] = await sql`
      INSERT INTO organizations (name, slug, plan, settings)
      VALUES (${orgName}, ${orgSlug}, 'premium', '{"twilioNumber": "+13057784861"}'::jsonb)
      RETURNING id;
    `;
    console.log('Migrate: Seeded organization:', org.id);

    // Seed Gideon as default admin member (using a mock auth userId to map correctly)
    const mockUserId = '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d';
    const [member] = await sql`
      INSERT INTO org_members (org_id, user_id, role, joined_at)
      VALUES (${org.id}, ${mockUserId}, 'admin', now())
      RETURNING id;
    `;
    console.log('Migrate: Seeded Gideon admin member:', member.id);

    // Seed initial welcome task in bucket_items
    await sql`
      INSERT INTO bucket_items (org_id, title, priority, project_tag, assigned_to)
      VALUES (${org.id}, 'Verify greenfield database RLS & cockpit setup', 1, 'General', ${member.id});
    `;
    console.log('Migrate: Seeded first checklist task!');

    await sql.end();
    console.log('Migrate: Database setup completed successfully!');
  } catch (err) {
    console.error('Migrate: Database migration failed:', err);
    process.exit(1);
  }
}

run();
