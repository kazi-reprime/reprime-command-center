# Architecture — RePrime Command Center v0.1

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL EDGE                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ /login   │  │ /center  │  │ /cockpit │  │ /api/* (105+)│   │
│  │ Auth     │  │ Kiosk    │  │ OS       │  │ Server Routes│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │              │             │              │
         ▼              ▼             ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE (PostgreSQL)                      │
│  organizations │ org_members │ whatsapp_threads │ notes │ ...  │
└─────────────────────────────────────────────────────────────────┘
         │                                           │
         ▼                                           ▼
┌──────────────────┐                    ┌──────────────────────┐
│   EXTERNAL APIs  │                    │   UPSTASH REDIS      │
│  Pipedrive CRM   │                    │   Cache + Rate Limit │
│  Google APIs     │                    └──────────────────────┘
│  Timelines.ai    │
│  BlueBubbles     │
│  Quo/Twilio      │
│  Anthropic/OpenAI│
│  ElevenLabs      │
│  Deepgram        │
│  Stripe          │
│  Zoom            │
│  PagerDuty       │
│  SendGrid        │
└──────────────────┘
```

---

## Route Architecture

The app has two distinct UIs sharing the same API layer:

### `/center` — Legacy Kiosk (v0.0)
The original 3-column command center built for Gideon's daily operations:

```
┌──────────────┬────────────────────┬──────────────┐
│  LEFT FLANK  │    COMMS PANEL     │ RIGHT FLANK  │
│              │                    │              │
│ • Briefing   │ • WhatsApp threads │ • Nora AI    │
│ • Calendar   │ • Message view     │ • Tasks      │
│ • Email      │ • Reply + send     │ • Notes      │
│ • Focus      │ • Search           │              │
│ • Secretary  │ • Archive/delete   │              │
│ • Investors  │                    │              │
└──────────────┴────────────────────┴──────────────┘
```

- Uses `WindowManager` pattern for floating windows
- Multi-panel (305 & 718) WhatsApp via Timelines.ai adapter
- Zustand store for client state
- React Query for server state

### `/cockpit` — AI Business OS (v0.1)
The new modular operating system with sidebar navigation:

```
┌────────┬────────────────────────────────────────┐
│        │                                        │
│  SIDE  │           MODULE CONTENT               │
│  BAR   │                                        │
│        │  (Dashboard / CRM / Leads / Tasks /    │
│  Nav   │   Agents / Automations / Inbox /       │
│  Items │   Analytics / Projects / Files /       │
│        │   Health / Settings)                   │
│        │                                        │
│        │                                        │
└────────┴────────────────────────────────────────┘
```

- `CockpitShell` wraps all modules with sidebar + topbar
- Each module is a standalone page in `app/cockpit/[module]/page.tsx`
- Shared UI components from `components/ui/shared.tsx`
- Seed data from `lib/data/seed.ts` (to be replaced with live data in v0.2)
- Command Palette (⌘K) for keyboard navigation

---

## Data Flow

### Communication Messages
```
External (WhatsApp/iMessage/SMS)
    → Webhook (api/webhooks/*)
    → Supabase (whatsapp_messages table)
    → React Query fetch → Zustand store → UI
```

### AI Briefing
```
Cron trigger / Manual request
    → /api/briefing/today
    → Parallel fetch: Calendar + Email + Pipedrive + Tasks
    → Claude/GPT summarization
    → Cached in Redis (5 min TTL)
    → Response to client
```

### Cockpit Modules (Current — v0.1)
```
Page load → Import seed data from lib/data/seed.ts
         → useState for local mutations
         → UI renders with seed data
```

### Cockpit Modules (Planned — v0.2)
```
Page load → React Query fetch from /api/[resource]
         → Supabase query
         → UI renders with live data
         → Mutations via POST/PATCH/DELETE
```

---

## Database Schema

Managed by Drizzle ORM in `db/schema.ts`. Key tables:

| Table | Purpose |
|-------|---------|
| `organizations` | Multi-tenant org container |
| `org_members` | Team members per org |
| `whatsapp_threads` | Conversation threads (all channels) |
| `whatsapp_messages` | Individual messages |
| `notes` | Linked notes system |
| `briefings` | AI-generated briefings |
| `nora_chat_messages` | Nora AI conversation history |
| `outbound_asks` | Secretary follow-up tracking |
| `roster` | Contact board |
| `invitations` | Meeting invitations |
| `rsvps` | RSVP responses |

---

## Integration Adapters

Located in `lib/adapters/`. Each adapter normalizes a third-party API:

| Adapter | File | External Service |
|---------|------|-----------------|
| Timelines | `lib/adapters/timelines.ts` | Timelines.ai (WhatsApp) |
| BlueBubbles | `lib/adapters/bluebubbles.ts` | BlueBubbles (iMessage) |
| Pipedrive | `lib/pipedrive/client.ts` | Pipedrive CRM |
| Google | `lib/google.ts` | Gmail + Calendar |
| Zoom | `lib/zoom/` | Zoom meetings |
| Voice | `lib/voice/` | ElevenLabs + Deepgram |
| Slack | `lib/slack/` | Slack notifications |

---

## Multi-Tenant Model

The system supports multiple organizations via:

1. `X-Active-Identity` header identifies the acting user
2. `organizations` → `org_members` relationship in DB
3. Middleware extracts identity and injects into request context
4. API routes filter data by org membership

---

## Environment & Deployment

- **Hosting**: Vercel (auto-deploy from `main` branch)
- **Database**: Supabase (us-east-1)
- **Cache**: Upstash Redis
- **Domain**: reprime-command-center.vercel.app
- **CI/CD**: Push to `main` → Vercel auto-deploys
