# Prime/RePrime Command Center — Database Audit

## Overview
The persistence layer is managed via Supabase (PostgreSQL), utilizing `drizzle-orm` for schema definition (`db/schema.ts`). A multi-tenant approach (`organizations`) is established at the root of all tables.

## 1. Existing Tables & Status
| Table | Description | Status | Missing / Broken Elements |
|-------|-------------|--------|---------------------------|
| `organizations` | Tenant / workspace | ✅ Intact | None |
| `org_members` | Users in workspace | ✅ Intact | Needs integration with Supabase Auth |
| `threads` | Unified chat index | ✅ Intact | Lane overrides (investor/staff) manually mapped |
| `messages` | Chat bubbles | ✅ Intact | Lacks full sync state with Timelines API |
| `bucket_items`| Task/APEX priority list | ✅ Intact | Missing subtasks or check-lists |
| `nora_memory` | pgvector knowledge base | ✅ Intact | Semantic search works |
| `deals` | Pipeline deals | ✅ Intact | UI completely ignores this table currently |
| `investors` | CRM investors | ✅ Intact | `investorScore` untouched by any Cron |
| `decisions` | Decision log | ✅ Intact | UI completely ignores this table |
| `payments` | Tracker | ✅ Intact | UI completely ignores this table |

## 2. Missing Tables (Critical Gaps)
The frontend claims to support the following features, but **no database schema exists** to persist them:
* **`notes`**: The "Notes" panel on the right flank calls `/api/notes`, but there is no `notes` table in the DB schema.
* **`briefings`**: Briefings are generated and lost. There is no `briefings` table to store the historical morning/evening briefings.
* **`connected_accounts`**: OAuth tokens (Google, etc.) are currently pulled from `.env.local` globally instead of per-user or per-organization.
* **`audit_logs`**: Crucial for tracking who sent an invite or message.
* **`contact_labels`**: Contacts are currently hardcoded or derived from chat threads. No centralized `contacts` table exists!

## 3. Production Data Handling
* There is no local-only fallback. If Supabase is down, the app fails to load threads and bucket items.
* **Timezones:** `timestamp` is used without timezone explicit enforcement (`timestamp with time zone` should be verified).

## 4. Action Plan for Phase 2
1. **Migration Required:** Create a new Drizzle migration to add `notes`, `briefings`, `contacts`, and `audit_logs` tables.
2. **Apply Migrations:** Run `npm run db:push` or equivalent to update the local Supabase instance.
3. **Wire UI to DB:** The UI for Deals, Investors, and Decisions must be hooked up to `supabase.from('deals').select('*')` instead of returning hardcoded JSON.
