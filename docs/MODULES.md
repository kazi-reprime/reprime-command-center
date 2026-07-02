# Modules — RePrime Command Center v0.1

Detailed documentation for each module in the AI Business Operating System.

---

## 1. Executive Dashboard (`/cockpit`)

**File**: `app/cockpit/page.tsx`

The main landing page after login. Provides a high-level overview of business health.

### Features
- **Business Health Score** — Calculated 0-100 composite score based on revenue, pipeline, and activity
- **KPI Grid** — 6 cards: Revenue MTD, Active Deals, Open Tasks, AI Agents Running, Messages Today, Meetings This Week
- **Calendar Preview** — Today's upcoming events
- **AI Recommendations** — Contextual suggestions based on current business state
- **Quick Actions** — Fast links to create tasks, log calls, check inbox

### Data Source
Currently: Seed data (`lib/data/seed.ts`)
Planned: Live aggregation from Supabase + external APIs

---

## 2. Client CRM (`/cockpit/clients`)

**File**: `app/cockpit/clients/page.tsx`

Full client relationship management with CRUD operations.

### Features
- **Client Cards** — Name, company, status badge, revenue, last contact date
- **Add/Edit Client** — Modal form with all fields
- **Search & Filter** — By name, company, or status (active/prospect/churned)
- **AI Summary** — Per-client AI-generated relationship summary
- **Revenue Tracking** — Total revenue per client

### Data Source
Currently: Seed data with `useState` for local mutations
Planned: Supabase `clients` table

---

## 3. Lead Pipeline (`/cockpit/leads`)

**File**: `app/cockpit/leads/page.tsx`

Kanban-style pipeline for managing sales leads through stages.

### Features
- **5 Stages** — New → Contacted → Qualified → Proposal → Closed Won
- **Lead Cards** — Name, company, value, days in stage, source
- **AI Next-Best-Action** — Per-lead AI recommendation
- **Stage Counts & Values** — Aggregate stats per column
- **Quick-Add Lead** — Form to add leads to any stage

### Data Source
Currently: Seed data
Planned: Pipedrive deals synced to Supabase

---

## 4. Task Center (`/cockpit/tasks`)

**File**: `app/cockpit/tasks/page.tsx`

Priority-based task management with project tagging.

### Features
- **Priority Levels** — P1 (Critical) through P4 (Low), color-coded
- **Status Tabs** — All, To Do, In Progress, Done
- **Checklists** — Sub-tasks within each task
- **Quick-Add** — Inline form with priority and project tag
- **AI Next Step** — AI suggestion for next action per task
- **Project Tags** — Filter by Deals, Sales, Operations, etc.

### Data Source
Currently: Seed data
Planned: Supabase `tasks` table

---

## 5. AI Agent Control Panel (`/cockpit/agents`)

**File**: `app/cockpit/agents/page.tsx`

Monitor and control 10 AI agents that automate business operations.

### Agents
| Agent | Purpose |
|-------|---------|
| Nora | Executive AI assistant — briefings, summaries, recommendations |
| Lead Scorer | Scores incoming leads using ML model |
| Email Triager | Categorizes and prioritizes emails |
| Meeting Prep | Generates pre-meeting briefings |
| Follow-up Bot | Tracks and reminds about follow-ups |
| Content Writer | Drafts marketing content |
| Data Enricher | Enriches contacts from Apollo/LinkedIn |
| Invoice Agent | Tracks invoices and payment status |
| Sentiment Analyzer | Monitors client communication sentiment |
| Market Watcher | Tracks CRE market signals |

### Features
- **Status Cards** — Running/idle/error with last run time
- **Controls** — Run, Pause, Resume, Retry per agent
- **Run Count** — Total executions tracked
- **Error Handling** — Visual error states with retry

---

## 6. Automation Hub (`/cockpit/automations`)

**File**: `app/cockpit/automations/page.tsx`

Manage business automations with toggle controls.

### Features
- **8 Automations** — Email auto-reply, lead assignment, invoice reminders, etc.
- **Toggle On/Off** — Enable/disable each automation
- **Trigger Info** — Shows what triggers each automation
- **Last Run** — Timestamp of most recent execution
- **Retry** — Manual retry for failed automations

---

## 7. Communication Inbox (`/cockpit/inbox`)

**File**: `app/cockpit/inbox/page.tsx`

Unified inbox across all communication channels.

### Features
- **Channel Tabs** — All, WhatsApp, Email, SMS, Phone
- **Message Preview** — Sender, subject/preview, timestamp, unread indicator
- **AI Summary** — AI-generated summary per message
- **Search** — Full-text search across messages
- **Bulk Actions** — Mark read, archive

---

## 8. Revenue & Analytics (`/cockpit/analytics`)

**File**: `app/cockpit/analytics/page.tsx`

Business intelligence dashboard with visual charts.

### Features
- **Revenue Trend** — Monthly revenue bar chart (12 months)
- **KPI Row** — Total Revenue, Active Deals, Avg Deal Size, Close Rate
- **Lead Funnel** — Conversion rates through pipeline stages
- **Agent Performance** — AI agent execution metrics
- **Top Clients** — Ranked by revenue contribution

---

## 9. Project Tracker (`/cockpit/projects`)

**File**: `app/cockpit/projects/page.tsx`

Track deal-related projects through milestones.

### Features
- **Progress Bars** — Visual completion percentage
- **Milestones** — Checkbox-based milestone tracking
- **Blockers** — Red-flagged items blocking progress
- **Owner Assignment** — Project owner display
- **Deadline Tracking** — Due date with overdue warnings

---

## 10. File Center (`/cockpit/files`)

**File**: `app/cockpit/files/page.tsx`

Central file repository with metadata and tagging.

### Features
- **File List** — Name, type icon, size, related entity, upload date
- **Tag Filtering** — Filter by tags (legal, deals, research, etc.)
- **Search** — Search by filename
- **Type Icons** — PDF, XLSX, DOCX, image, video

---

## 11. System Health (`/cockpit/health`)

**File**: `app/cockpit/health/page.tsx`

Monitor the health of all 12 connected services.

### Services Monitored
Supabase, Anthropic AI, Google APIs, Timelines.ai, BlueBubbles, Pipedrive, Upstash Redis, ElevenLabs, Deepgram, Stripe, Zoom, SendGrid

### Features
- **Status Grid** — Green/yellow/red per service
- **Response Times** — Simulated latency display
- **Uptime** — Percentage uptime per service
- **Log Viewer** — Recent system log entries

---

## 12. Settings & Integrations (`/cockpit/settings`)

**File**: `app/cockpit/settings/page.tsx`

Configure the entire system.

### Sections
- **General** — Business name, owner, timezone, currency, language
- **AI** — Model selection, temperature, auto-brief toggle
- **Integrations** — Status of all 12 integrations with env var references
- **Team** — Team member roster with roles and emails
- **Notifications** — Email, SMS, push notification toggles

---

## Shared Infrastructure

### CockpitShell (`components/cockpit/CockpitShell.tsx`)
The main layout wrapper providing:
- **Sidebar** — Collapsible nav with module icons and labels
- **Topbar** — Time, date, command palette trigger
- **Command Palette** — ⌘K shortcut for instant navigation
- **Mobile Drawer** — Hamburger menu for mobile viewport

### Shared UI Components (`components/ui/shared.tsx`)
| Component | Purpose |
|-----------|---------|
| `Card` | Consistent card container with title |
| `StatCard` | KPI display with label + value + trend |
| `StatusBadge` | Color-coded status indicator |
| `ActionButton` | Styled button (primary/secondary/danger) |
| `SearchInput` | Search field with icon |
| `FormInput` | Labeled text input |
| `FormSelect` | Labeled dropdown |
| `DataTable` | Sortable table with headers |
| `EmptyState` | Placeholder for empty lists |
| `KanbanColumn` | Kanban board column |
| `KanbanCard` | Kanban board card |
| `TabBar` | Horizontal tab navigation |
| `Modal` | Overlay modal container |

### Seed Data (`lib/data/seed.ts`)
Centralized demo data for all cockpit modules. Contains sample clients, leads, tasks, agents, automations, projects, files, inbox messages, and analytics data. Will be replaced with live Supabase queries in v0.2.

### Toast System (`lib/contexts/ToastContext.tsx`)
App-wide notification system with 4 types (success, error, warning, info). Used via `useToast()` hook. Provides glassmorphic floating toasts with auto-dismiss and dismiss button.
