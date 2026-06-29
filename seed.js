const fs = require('fs');
const postgres = require('postgres');

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      env[key] = value;
    }
  });
  return env;
}
const envLocal = parseEnv('.env.local');
const envFile = parseEnv('.env');
const dbUrl = envLocal.DATABASE_URL || envFile.DATABASE_URL;

const sql = postgres(dbUrl);

async function seed() {
  const orgId = '00000000-0000-0000-0000-000000000000';
  
  // Seed Deals
  await sql`
    INSERT INTO deals (org_id, name, address, asset_type, purchase_price, loan_amount, equity_needed, status, priority, risk_score)
    VALUES 
    (${orgId}, 'Bay Valley Shopping Center', '123 Bay Valley Rd, FL', 'Retail', 4200000, 2500000, 1700000, 'under_contract', 1, 3),
    (${orgId}, 'Downtown Office Plaza', '456 Main St, NY', 'Office', 15000000, 10000000, 5000000, 'evaluating', 2, 5)
    ON CONFLICT DO NOTHING
  `;

  // Seed Investors
  await sql`
    INSERT INTO investors (org_id, name, contact_phone, capital_capacity, preferred_deal_type, preferred_location, status, investor_score)
    VALUES 
    (${orgId}, 'Sarah Chen', '+13055551234', 5000000, 'Retail', 'Florida', 'hot', 92),
    (${orgId}, 'Marcus Levy', '+17185559876', 2000000, 'Office', 'New York', 'warm', 65),
    (${orgId}, 'David Rosenberg', '+13055554321', 10000000, 'Multifamily', 'Texas', 'committed', 98)
    ON CONFLICT DO NOTHING
  `;

  console.log('Seeding complete.');
  process.exit(0);
}

seed().catch(console.error);
