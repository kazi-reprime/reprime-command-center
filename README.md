# RePrime Command Center v0.4

The ultimate executive cockpit for Gideon Gratsiani. A voice-controlled operating system for high-stakes commercial real estate.

🌐 **Live**: [reprime-command-center.vercel.app](https://reprime-command-center.vercel.app)

## 🤖 Nora: The Voice-Controlled OS

Nora is no longer just an assistant; she is the primary interface for the RePrime Group.

- **"All-Seeing" Control**: Nora manages WhatsApp, Gmail, Pipedrive, Zoom, and the UI itself.
- **Voice Navigation**: Press **Spacebar** to talk. Say "Go to [Module]" to navigate instantly.
- **Intelligent Automation**: Nora understands context—"Send a message to the guy from the Miami deal"—and resolves contacts across all platforms.
- **Universal Kill Switch**: Press **Escape** at any time to immediately stop Nora.

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

The Command Center is a **production-grade AI Business Operating System** with 4 P0 systems running end-to-end with real data:

| System | Status | Providers | Controls |
|--------|--------|-----------|----------|
| **Nora AI** | ✅ Live | Integrated 2-Pillar Dashboard + Multi-Agent Orchestrator (11 agents) | **Spacebar** to talk, **Escape** to stop |
| **Voice Shell** | ✅ Live | Spacebar Shortcut + Live Waveform + ElevenLabs TTS | **Hold Space** to record |
| **WhatsApp** | ✅ Live | Timelines.ai (primary) → Meta Cloud API (fallback) |
| **Email** | ✅ Live | Gmail API → SendGrid (fallback) |

### The Vision
> **Notion + CRM + AI Assistant + Automation Hub + Business Analytics Dashboard + Client Portal + Project Control Room + AI Agent Monitor**

---

## Architecture

```
/                     → Redirect to /login
/login                → Authentication (Supabase Auth)
/cockpit              → AI Business OS (18+ modules)
/center               → Legacy Kiosk (WhatsApp, iMessage, SMS, Email, Phone)
/os                   → OS-style system view
/api/*                → 150+ API routes (all server-side)
```

### Integration Gateway (`lib/gateway/`)

All external services are accessed through a **capability-based gateway** with automatic failover:

```typescript
import { gateway } from '@/lib/gateway'

// Callers request WHAT they need, never WHICH vendor
const result = await gateway.sendWhatsApp({ to: '+1...', body: 'Hello', lane: '305' })
// → Tries Timelines.ai → Meta Cloud API automatically
```

| Component | Purpose |
|-----------|---------|
| `provider-registry.ts` | Capability routing with health-scored failover |
| `circuit-breaker.ts` | Closed → Open → Half-Open → Closed (5 failures = open) |
| `health-monitor.ts` | Latency tracking, failure streaks, auth detection |
| `audit.ts` | Buffered audit log writes with secret redaction |

#### 15 Registered Providers

| Category | Providers |
|----------|-----------|
| WhatsApp | Timelines.ai (primary), Meta Cloud API (fallback) |
| Email | Gmail API, SendGrid |
| AI | Anthropic Claude, OpenAI, Gemini*, Groq*, OpenRouter* |
| STT | OpenAI Whisper, Groq Whisper*, Deepgram Nova* |
| TTS | ElevenLabs, OpenAI TTS |
| Meetings | Zoom S2S OAuth |

> \*Not yet configured — will activate when API keys are added

### Nora AI — Multi-Agent System

| Agent | Tools | Purpose |
|-------|-------|---------|
| Orchestrator | Intent routing | Classifies intent → dispatches to specialist |
| Email Agent | 5 tools | Inbox, search, send, reply, mark |
| WhatsApp Agent | 5 tools | Search, read, send, unread, contacts |
| Meeting Agent | 4 tools | List, create, brief, participants |
| Contact Agent | 2 tools | Resolve, search |
| Security Agent | Approval flows | Sensitive action gating |
| Session Manager | Persistence | Vector memory + Supabase history |

**Fallback chain:** Orchestrator → Anthropic Claude (tool-use) → Groq/OpenAI (plain chat)

### Cockpit Modules

| Route | Module | Data Source |
|-------|--------|-------------|
| `/cockpit` | Executive Dashboard | Live APIs |
| `/cockpit/health` | System Health | Gateway health monitor |
| `/cockpit/comms` | Communications | Supabase Realtime |
| `/cockpit/email` | Email Inbox | Real Gmail API |
| `/cockpit/tasks` | Task Center | Supabase |
| `/cockpit/clients` | Client CRM | Supabase |
| `/cockpit/leads` | Lead Pipeline | Supabase |
| `/cockpit/pipeline` | Deal Pipeline | Supabase + Pipedrive |
| `/cockpit/investors` | Investor Relations | Supabase |
| `/cockpit/agents` | AI Agent Monitor | Live agent status |
| `/cockpit/analytics` | Revenue & Analytics | Aggregated APIs |
| `/cockpit/calendar` | Calendar | Google Calendar API |
| `/cockpit/notes` | Notes | Supabase |
| `/cockpit/inbox` | Unified Inbox | Multi-channel |
| `/cockpit/settings` | Settings | Config store |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15.5 (App Router) |
| **Language** | TypeScript (strict) |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth |
| **AI** | Anthropic Claude, OpenAI GPT-4o, ElevenLabs, OpenAI Whisper |
| **Styling** | Tailwind CSS + Glassmorphic Design System (5 themes) |
| **State** | React hooks + Supabase Realtime |
| **Gateway** | Custom capability-based router with circuit breakers |
| **CRM** | Pipedrive API |
| **Email** | Gmail API + SendGrid |
| **Messaging** | Timelines.ai (WhatsApp) + Meta Cloud API |
| **Meetings** | Zoom S2S OAuth |
| **Cache** | Upstash Redis |
| **Hosting** | Vercel (Hobby tier) |

---

## Getting Started

### Prerequisites

- Node.js 24+
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

| Group | Variables | Required |
|-------|----------|----------|
| Database | `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes |
| AI | `ANTHROPIC_API_KEY` | ✅ Yes |
| WhatsApp | `TIMELINES_API_KEY`, `TIMELINES_CHANNEL_305`, `TIMELINES_CHANNEL_718` | For messaging |
| WhatsApp Fallback | `META_WA_ACCESS_TOKEN`, `META_WA_PHONE_ID_305`, `META_WA_VERIFY_TOKEN` | Optional |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | For email/calendar |
| Voice | `ELEVENLABS_API_KEY`, `OPENAI_API_KEY` | For voice features |
| Zoom | `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | For meetings |
| CRM | `PIPEDRIVE_API_TOKEN` | For CRM |
| Email | `SENDGRID_API_KEY` | Fallback email |
| Cache | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | For caching |
| Cron | `CRON_SECRET` | For scheduled jobs |

---

## Project Structure

```
reprime-command-center/
├── app/                          # Next.js App Router
│   ├── api/                      # 150+ API routes
│   │   ├── cockpit/              #   Dashboard & portal APIs
│   │   ├── email/                #   Gmail inbox, send, threads
│   │   ├── gateway/              #   Health, synthesize, transcribe
│   │   ├── nora/                 #   Chat, voice, approve, history
│   │   ├── whatsapp/             #   Threads, messages, webhooks
│   │   ├── zoom/                 #   Meetings, webhooks
│   │   ├── cron/                 #   Scheduled jobs (zoom-sync, messages)
│   │   └── ...                   #   pipedrive, investors, tasks, etc.
│   ├── cockpit/                  # AI Business OS (18 modules)
│   │   ├── layout.tsx            #   Cockpit shell (sidebar + topbar)
│   │   └── [module]/page.tsx     #   Each module page
│   ├── center/                   # Legacy Kiosk
│   ├── login/                    # Auth page
│   └── layout.tsx                # Root layout
├── components/
│   ├── cockpit/                  # Cockpit-specific components
│   │   ├── CockpitShell.tsx      #   Sidebar + topbar + command palette
│   │   ├── panels/               #   CommsPanel, LeftFlank, RightFlank
│   │   └── modals/               #   ContactsModal, EmailModal, etc.
│   ├── ui/                       # Shared UI library
│   │   ├── shared.tsx            #   StatCard, Card, Modal, ActionButton, etc.
│   │   ├── PremiumChart.tsx      #   Analytics charts
│   │   ├── PremiumTable.tsx      #   Data tables
│   │   ├── LiveStatus.tsx        #   DataSourceBanner, LoadingState
│   │   └── ThemeSwitcher.tsx     #   5-theme switcher
│   └── Providers.tsx             # React Query + Toast providers
├── lib/
│   ├── gateway/                  # ★ Integration Gateway
│   │   ├── index.ts              #   Public API (sendWhatsApp, etc.)
│   │   ├── types.ts              #   All type definitions
│   │   ├── provider-registry.ts  #   Capability routing + failover
│   │   ├── circuit-breaker.ts    #   Circuit breaker state machine
│   │   ├── health-monitor.ts     #   Provider health tracking
│   │   ├── audit.ts              #   Audit logging
│   │   └── providers/            #   16 provider adapters
│   ├── agents/                   # ★ Nora AI Multi-Agent System
│   │   ├── orchestrator.ts       #   Intent classification + routing
│   │   ├── email-agent.ts        #   5 email tools
│   │   ├── whatsapp-agent.ts     #   5 WhatsApp tools
│   │   ├── meeting-agent.ts      #   4 meeting tools
│   │   ├── contact-agent.ts      #   Contact resolution
│   │   ├── security-agent.ts     #   Approval flows
│   │   └── session-manager.ts    #   Persistence + memory
│   ├── email/                    # Email integration
│   │   └── unified-inbox.ts      #   Multi-account Gmail
│   ├── whatsapp/                 # WhatsApp integration
│   │   ├── contact-resolver.ts   #   Cross-source contact lookup
│   │   └── scheduler.ts          #   Message scheduling
│   ├── zoom/                     # Zoom integration
│   │   ├── meeting-sync.ts       #   Zoom → Supabase sync
│   │   ├── meeting-intelligence.ts # AI meeting summaries
│   │   └── webhook-processor.ts  #   Event routing
│   ├── google/                   # Google APIs (Gmail, Calendar)
│   ├── pipedrive/                # Pipedrive CRM client
│   ├── supabase/                 # Supabase client helpers
│   └── store/                    # Client-side state
├── hooks/                        # React hooks
│   └── useWhatsAppRealtime.ts    #   Supabase Realtime subscription
├── docs/                         # Architecture documentation
│   └── MODULES.md                #   Module reference
├── supabase/migrations/          # SQL migrations
├── public/                       # Static assets
├── .env.example                  # Environment variable template
├── CHANGELOG.md                  # Version history
└── README.md                     # ← You are here
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx drizzle-kit push` | Push schema to Supabase |

---

## Deployment

The app auto-deploys from `main` branch to Vercel:

```bash
# Manual deploy
vercel --prod

# Check live health
curl https://reprime-command-center.vercel.app/api/health
curl https://reprime-command-center.vercel.app/api/gateway/health
```

---

## License

MIT — See [LICENSE](LICENSE) for details.

---

**Built by Kazi** · kazi@reprime.com · RePrime Group
