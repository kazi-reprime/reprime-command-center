# RePrime Command Center v0.1

**AI Business Operating System for RePrime Group**

A full-stack Next.js command center that combines CRM, communications, AI agents, analytics, automations, and business operations into one unified platform. Built for Gideon (CEO) and the RePrime team to run their commercial real estate business from a single interface.

🌐 **Live**: [reprime-command-center.vercel.app](https://reprime-command-center.vercel.app)

---

## Team

| Name | Role | Email |
|------|------|-------|
| **Gideon** | Owner / CEO | g@reprime.com |
| **Kazi** | Builder / Technology Lead | kazi@reprime.com |
| **Shirel** | Operations | shirel@reprime.com |
| **Adir** | Technology | adir@reprime.com |
| **Yaron** | Finance | yaron@reprime.com |

---

## What This Is

The Command Center started as a communications kiosk (`/center`) for managing WhatsApp, iMessage, SMS, email, and phone calls across two business panels (305 & 718). In v0.1, it was upgraded into a full **AI Business Operating System** (`/cockpit`) with 13 modules.

### The Vision
> **Notion + CRM + AI Assistant + Automation Hub + Business Analytics Dashboard + Client Portal + Project Control Room + AI Agent Monitor**

---

## Architecture

```
/                     → Redirect to /login
/login                → Authentication (Supabase Auth)
/center               → Legacy Kiosk (WhatsApp, iMessage, SMS, Email, Phone)
/cockpit              → AI Business OS (13 modules — see below)
/api/*                → 105+ API routes (all server-side)
```

### Cockpit Modules (v0.1)

| Route | Module | Status | Description |
|-------|--------|--------|-------------|
| `/cockpit` | Executive Dashboard | ✅ Seed | Business Health Score, KPI grid, calendar, AI recommendations |
| `/cockpit/clients` | Client CRM | ✅ Seed | Client profiles, CRUD, revenue tracking, AI summaries |
| `/cockpit/leads` | Lead Pipeline | ✅ Seed | Kanban board, drag-and-drop stages, AI next-best-action |
| `/cockpit/tasks` | Task Center | ✅ Seed | Priority management, checklists, project tagging |
| `/cockpit/agents` | AI Agents | ✅ Seed | 10 AI agents with run/pause/resume/retry controls |
| `/cockpit/automations` | Automation Hub | ✅ Seed | Enable/disable/retry automations with live status |
| `/cockpit/inbox` | Communication Inbox | ✅ Seed | Channel filtering (WhatsApp, email, SMS), AI summaries |
| `/cockpit/analytics` | Revenue & Analytics | ✅ Seed | Revenue trends, lead funnel, agent performance charts |
| `/cockpit/projects` | Project Tracker | ✅ Seed | Milestones, progress bars, blocker alerts |
| `/cockpit/files` | File Center | ✅ Seed | File listing with tag filtering |
| `/cockpit/health` | System Health | ✅ Seed | 12-service status monitor, log viewer |
| `/cockpit/settings` | Settings | ✅ Seed | Business config, integrations, team management |

> **✅ Seed** = UI is built and functional with seed/demo data. Wiring to live Supabase data is the next phase.

### Legacy Kiosk (`/center`) — Fully Functional

| Feature | Status | Description |
|---------|--------|-------------|
| WhatsApp (305 & 718) | ✅ Live | Via Timelines.ai adapter |
| iMessage | ✅ Live | Via BlueBubbles adapter |
| SMS | ✅ Live | Via Quo/Twilio adapter |
| Email (Gmail) | ✅ Live | OAuth2 via Google APIs |
| Phone Calls | ✅ Live | Call events + recordings |
| Daily Briefing | ✅ Live | AI-generated morning briefing |
| Nora AI Chat | ✅ Live | Claude/GPT-powered assistant |
| Secretary (Outbound Asks) | ✅ Live | Track follow-ups with deadlines |
| Investor Cadence | ✅ Live | Investor communication tracker |
| Suggested Focus | ✅ Live | 90-minute focus timer |
| Pipedrive CRM Sidebar | ✅ Live | Contact resolution + deal cards |
| Notes | ✅ Live | Linked notes system |

### API Routes (105+)

All API routes are in `app/api/`. Key categories:

- **Communication**: `/api/whatsapp/*`, `/api/gmail/*`, `/api/email/*`, `/api/nora/*`
- **CRM**: `/api/pipedrive/*`, `/api/deals`, `/api/investors/*`
- **AI**: `/api/ai/*`, `/api/briefing/*`, `/api/voice/*`
- **Scheduling**: `/api/invitations/*`, `/api/calendar/*`
- **Automation**: `/api/cron/*` (10+ scheduled jobs)
- **Webhooks**: `/api/webhooks/*`, `/api/phone/*`
- **System**: `/api/health`, `/api/migrate`, `/api/search`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript |
| **Database** | Supabase (PostgreSQL) |
| **ORM** | Drizzle ORM |
| **Auth** | Supabase Auth |
| **AI** | Anthropic Claude, OpenAI, Google Gemini |
| **Styling** | Tailwind CSS + Custom CSS-in-JS |
| **State** | Zustand (client) + React Query (server) |
| **Voice** | ElevenLabs (TTS) + Deepgram (STT) |
| **CRM** | Pipedrive API |
| **Email** | Gmail API + SendGrid |
| **Messaging** | Timelines.ai (WhatsApp) + BlueBubbles (iMessage) |
| **Phone** | Quo API + Twilio |
| **Video** | Zoom API |
| **Cache** | Upstash Redis |
| **Payments** | Stripe |
| **Hosting** | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A Supabase project
- API keys for integrations (see `.env.example`)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/kazi-reprime/reprime-command-center.git
cd reprime-command-center

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Create your environment file
cp .env.example .env.local
# Fill in your API keys in .env.local

# 4. Push database schema
npx drizzle-kit push

# 5. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

All required environment variables are documented in [`.env.example`](.env.example). Key groups:

| Group | Variables | Required |
|-------|----------|----------|
| Database | `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes |
| AI | `ANTHROPIC_API_KEY` | ✅ Yes |
| WhatsApp | `TIMELINES_API_KEY`, `TIMELINES_CHANNEL_*` | For messaging |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | For email/calendar |
| Voice | `ELEVENLABS_API_KEY`, `DEEPGRAM_API_KEY` | For voice features |
| CRM | Pipedrive keys (via Supabase config) | For CRM sidebar |

---

## Project Structure

```
reprime-command-center/
├── app/                          # Next.js App Router
│   ├── api/                      # 105+ API routes
│   ├── cockpit/                  # AI Business OS (13 modules)
│   │   ├── layout.tsx            # Cockpit shell (sidebar + topbar)
│   │   ├── page.tsx              # Executive Dashboard
│   │   ├── agents/               # AI Agent Control Panel
│   │   ├── analytics/            # Revenue & Analytics
│   │   ├── automations/          # Automation Hub
│   │   ├── clients/              # Client CRM
│   │   ├── files/                # File Center
│   │   ├── health/               # System Health
│   │   ├── inbox/                # Communication Inbox
│   │   ├── leads/                # Lead Pipeline (Kanban)
│   │   ├── projects/             # Project Tracker
│   │   ├── settings/             # Settings & Integrations
│   │   └── tasks/                # Task Center
│   ├── center/                   # Legacy Kiosk
│   ├── login/                    # Auth page
│   └── layout.tsx                # Root layout
├── components/
│   ├── cockpit/                  # Cockpit UI components
│   │   ├── CockpitShell.tsx      # Sidebar + topbar + command palette
│   │   ├── modals/               # ContactsModal, EmailModal, etc.
│   │   └── panels/               # CommsPanel, RightFlank, NotesPanel
│   ├── center/                   # Legacy kiosk components
│   ├── chat/                     # Chat thread components
│   ├── ui/                       # Shared UI library (15+ components)
│   └── Providers.tsx             # React Query + Toast providers
├── lib/
│   ├── adapters/                 # Integration adapters
│   ├── data/                     # Seed data (seed.ts)
│   ├── contexts/                 # React contexts (Toast)
│   ├── store/                    # Zustand store
│   ├── supabase.ts               # Supabase server client
│   ├── supabaseClient.ts         # Supabase browser client
│   └── [integrations]/           # pipedrive/, google/, whatsapp/, etc.
├── db/
│   ├── schema.ts                 # Drizzle ORM schema (all tables)
│   └── index.ts                  # DB connection
├── supabase/
│   └── migrations/               # SQL migrations
├── scripts/
│   ├── setup.sh                  # Bootstrap script
│   └── test-webhooks.ts          # Webhook testing utility
├── public/                       # Static assets
├── docs/                         # Architecture & module docs
├── .env.example                  # Environment variable template
├── package.json                  # Dependencies & scripts
└── README.md                     # ← You are here
```

---

## v0.1 Release Notes

### What's Built
- ✅ 13-module AI Business OS under `/cockpit`
- ✅ Executive Dashboard with Business Health Score
- ✅ Client CRM with full CRUD
- ✅ Lead Pipeline with Kanban view
- ✅ Task Center with priority management
- ✅ AI Agent Control Panel (10 agents)
- ✅ Automation Hub with enable/disable controls
- ✅ Communication Inbox with channel filtering
- ✅ Revenue & Analytics dashboard
- ✅ Project Tracker with milestones
- ✅ File Center with tag filtering
- ✅ System Health monitor (12 services)
- ✅ Settings & Integrations panel
- ✅ Command Palette (⌘K) for quick navigation
- ✅ Premium toast notification system (replaced all browser alerts)
- ✅ Responsive sidebar with mobile drawer
- ✅ Shared UI component library (15+ components)
- ✅ All 105+ legacy API routes preserved and functional

### What's Next (v0.2)
- 🔲 Wire cockpit modules to live Supabase data (replace seed data)
- 🔲 Real-time WebSocket updates for messages
- 🔲 Drag-and-drop on Kanban boards
- 🔲 File upload integration (Google Drive / S3)
- 🔲 Role-based access control (RBAC)
- 🔲 Mobile app wrapper (PWA)
- 🔲 Automated testing suite

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx drizzle-kit push` | Push schema to Supabase |
| `bash scripts/setup.sh` | Bootstrap new environment |

---

## License

MIT — See [LICENSE](LICENSE) for details.

---

**Built by Kazi** · kazi@reprime.com · RePrime Group
