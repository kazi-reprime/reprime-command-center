# Changelog

All notable changes to the RePrime Command Center are documented here.

---

## [0.1.0] — 2026-07-02

### 🎉 Initial Release — AI Business Operating System

**Built by Kazi** (kazi@reprime.com) for **Gideon** (Owner/CEO, RePrime Group).

### Added

#### Cockpit OS (`/cockpit`) — 13 Modules
- **Executive Dashboard** — Business Health Score (0-100), 6 KPI cards, calendar preview, AI recommendations
- **Client CRM** (`/cockpit/clients`) — Client profiles with CRUD, revenue tracking, search & filter, AI summaries
- **Lead Pipeline** (`/cockpit/leads`) — Kanban board with 5 stages, AI next-best-action per lead
- **Task Center** (`/cockpit/tasks`) — Priority management (P1-P4), checklists, project tagging, quick-add
- **AI Agents** (`/cockpit/agents`) — 10 AI agent cards with run/pause/resume/retry controls
- **Automation Hub** (`/cockpit/automations`) — 8 automations with enable/disable/retry and live status
- **Communication Inbox** (`/cockpit/inbox`) — Channel filtering (WhatsApp, email, SMS), AI message summaries
- **Revenue & Analytics** (`/cockpit/analytics`) — Revenue trend charts, lead funnel, agent performance metrics
- **Project Tracker** (`/cockpit/projects`) — Milestone tracking, progress bars, blocker alerts
- **File Center** (`/cockpit/files`) — File listing with tag-based filtering
- **System Health** (`/cockpit/health`) — 12-service status monitor with response times and log viewer
- **Settings** (`/cockpit/settings`) — Business config, integration status, team management

#### Infrastructure
- **CockpitShell** — Responsive sidebar navigation, topbar with time/date, hamburger drawer on mobile
- **Command Palette** — ⌘K keyboard shortcut for instant module navigation
- **Shared UI Library** — 15+ reusable components (`Card`, `StatCard`, `StatusBadge`, `ActionButton`, `SearchInput`, `FormInput`, `FormSelect`, `DataTable`, `EmptyState`, `KanbanColumn`, `KanbanCard`, `TabBar`, `Modal`)
- **Toast Notification System** — Replaced 18 browser `alert()` calls with premium glassmorphic toasts (success/error/warning/info)
- **Centralized Seed Data** — All demo data consolidated in `lib/data/seed.ts`

#### Legacy Kiosk (`/center`) — Preserved
- All existing WhatsApp, iMessage, SMS, Email, Phone features remain functional
- Daily Briefing, Nora AI Chat, Secretary, Investor Cadence, Suggested Focus — all untouched
- 105+ API routes preserved and working

### Security
- Removed hardcoded passwords from source code
- Removed database credential files from repository
- Updated `.gitignore` to prevent future credential leaks

### Changed
- `package.json` renamed from `temp-reprime` to `reprime-command-center`
- Package marked as public (`"private": false`)
- Toast system upgraded with `warning` type, dismiss buttons, and slide-in animation

### Removed
- `scratch/` directory (contained database credentials)
- 9 internal audit documents from `docs/` (replaced with proper documentation)

---

## What's Planned

### [0.2.0] — Upcoming
- Wire cockpit modules to live Supabase data (replace seed data)
- Real-time WebSocket updates for messages
- Drag-and-drop on Kanban boards
- File upload integration
- Role-based access control (RBAC)
- Automated testing suite
