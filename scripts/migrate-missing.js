const postgres = require('postgres');

const url = 'postgresql://postgres.yrnujfhzmoasodawqfri:Dcy%407700Dcy@aws-1-us-east-1.pooler.supabase.com:5432/postgres';
const sql = postgres(url, { ssl: 'require' });

const schemaSql = `
-- Table: notes
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

-- Table: briefings
CREATE TABLE IF NOT EXISTS briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  generated_for UUID REFERENCES org_members(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Table: contacts
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

-- Table: contact_labels
CREATE TABLE IF NOT EXISTS contact_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  label VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  action VARCHAR(255) NOT NULL,
  actor_id UUID REFERENCES org_members(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
`;

async function run() {
  try {
    console.log('Migrate: Starting database DDL migrations...');
    await sql.unsafe(schemaSql);
    console.log('Migrate: Missing tables created successfully!');
    await sql.end();
  } catch (err) {
    console.error('Migrate: Database migration failed:', err);
    process.exit(1);
  }
}
run();
