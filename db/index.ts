import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://mock:mock@localhost:5432/mock';

// For serverless environments, PgBouncer / Supavisor connection pooling is preferred.
// Set prepare: false to ensure compatibility with Supabase's transaction poolers.
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
