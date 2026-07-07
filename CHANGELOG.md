# Changelog

All notable changes to the RePrime Command Center.

---

## [0.3.0] — 2026-07-08

### 🤖 Nora-First Dashboard Overhaul (NEW)

- **Two-Pillar Layout** — 50/50 split dashboard with Nora as the primary left pillar
- **Nora's Insights** — Proactive intelligence layer with real-time status cards (Lead Velocity, Network Pulse)
- **Integrated Voice Shell** — Premium bottom-pinned Command Bar with live waveform visualizer
- **Spacebar Global Shortcut** — Instant Nora activation from any view (Dashboard, Cockpit, Comms)
- **Smart Interruption** — Nora immediately stops speaking when Gideon hits spacebar or speaks over her
- **Manual Stop Control** — Dedicated UI button to pause/stop Nora's audio synthesis

### 📱 Communication Enhancements

- **WhatsApp + Google Split** — Dedicated 50/50 view for messaging and email in the Comms column
- **Investor Profile Fix** — Resolved "Install Investor Profile" bug for non-investor contacts
- **Smart Windowing** — Context-aware window opening for chat vs. investor intelligence profiles

### 🎨 Visual & Experience Polish

- **Glassmorphic Footer** — Redesigned bottom chrome for seamless Voice Shell integration
- **Premium Waveform** — CSS-based live audio feedback for voice interactions
- **Context-Aware Nora** — Nora now understands the active viewport context (Comms, Analytics, etc.)

---

## [0.2.0] — 2026-07-07

### 🏗️ Integration Gateway (NEW)

- **Capability-based routing** — callers request *what* they need, never *which vendor*
- **16 provider adapters** — WhatsApp (2), Email (2), AI (5), STT (3), TTS (2), Meetings (1)
- **Circuit breaker** — 5 failures opens circuit, 30s cooldown, 2 successes to close
- **Health monitor** — tracks latency, failure streaks, auth errors, rate limits per provider
- **Audit logger** — buffered batch writes to Supabase with automatic secret redaction
- **Provider registry** — health-score sorting + preferred provider override + failover chain
- **Gateway health endpoint** — `/api/gateway/health` with 10 capability checks

### 📱 WhatsApp (P0)

- **Dual-provider outbound** — Timelines.ai primary, Meta Cloud API fallback
- **305 & 718 number support** — lane-based routing
- **Meta webhook handler** — `/api/whatsapp/meta-webhook` for inbound from Meta Cloud API
- **Contact resolver** — cross-source lookup (WhatsApp + Pipedrive + Gmail)
- **Message scheduler** — Supabase-backed scheduled sends with retry
- **Realtime hook** — `useWhatsAppRealtime` for live message updates
- **CommsPanel** — live thread view with Supabase Realtime

### 📧 Email (P0)

- **Unified inbox** — multi-account Gmail with `fetchInbox()` and `sendGmailMessage()`
- **Thread view** — `/api/email/thread/[threadId]` with full conversation
- **Gmail + SendGrid send** — primary Gmail, fallback SendGrid
- **Legacy `/api/gmail` upgrade** — now falls back to unified inbox on rate limit (429)
- **LeftFlank panel** — live email display in cockpit

### 🤖 Nora AI (P0)

- **Multi-agent orchestrator** — 11 agents with intent classification
- **Email agent** — 5 tools (inbox, search, send, reply, mark_read)
- **WhatsApp agent** — 5 tools (search, read, send, unread_count, contacts)
- **Meeting agent** — 4 tools (list, create, meeting_brief, participants)
- **Contact agent** — 2 tools (resolve, search)
- **Security agent** — approval flows for sensitive actions
- **Session manager** — chat persistence + vector memory in Supabase
- **Triple fallback** — Orchestrator → Anthropic Claude (tool-use loop) → Groq/OpenAI
- **Voice pipeline** — `/api/nora/voice` (STT → Chat → TTS)
- **Approval system** — `/api/nora/approve` with graceful table degradation

### 📹 Zoom / Meeting Intelligence (P0)

- **Zoom S2S OAuth** — server-to-server authentication
- **Triple-fallback meetings** — Zoom API → Supabase synced → Google Calendar
- **Meeting intelligence** — AI-powered summaries + action item extraction
- **Webhook processor** — real-time event handling
- **Daily cron sync** — `/api/cron/zoom-sync` for meeting synchronization
- **MeetingCockpit component** — wired to real Zoom data

### 🎨 UI/UX Pro Max Upgrade

- **Premium glassmorphic design system** — `backdrop-filter: blur(20px) saturate(180%)`
- **Multi-layer shadows** — glass, glass-hover, glass-elevated (3 tiers per theme)
- **Gradient buttons** — `btn-primary` with gradient background + inner shine + glow
- **Glow effects** — accent/success/error/warning glow on hover
- **Staggered animations** — `.stagger-in` cascades children with 60ms delay
- **Ambient glow orbs** — gradient blur backgrounds in cards
- **Pulse-ring indicators** — animated live status dots
- **Gradient accent lines** — at top of every Card header
- **5 themes upgraded** — Light, Midnight, Aurora, High Contrast, Slate (all with glow vars)
- **Premium StatCard** — colored glow orb + gradient icon background
- **Elevated Modal** — glassmorphic with gradient header accent

### 🔧 Audit Fixes

- **Zoom meetings** — fixed 502 by calling Zoom API directly (not through gateway)
- **Nora approve** — graceful degradation when `nora_pending_actions` table missing
- **Gmail legacy** — falls back to unified inbox on rate limit
- **Contacts API** — new `/api/contacts` endpoint (Supabase + Pipedrive deduped)
- **Gateway capabilities** — fixed `email_read` check (`email:receive` not `email:read`)
- **Cron jobs** — downgraded to daily for Vercel Hobby tier compatibility

### 📊 Infrastructure

- **150+ API routes** — up from 105
- **115 lib files** — gateway, agents, integrations
- **112 components** — cockpit, UI, panels
- **7 hooks** — realtime, data fetching
- **19 UI pages** — all returning 200 on live site
- **17 API endpoints** — all verified 200 on live site
- **10/10 capabilities** — all active on gateway health

### 📝 Documentation

- **README.md** — complete rewrite for v0.2 with architecture, gateway, agents
- **MODULES.md** — added P0 system architecture docs
- **CHANGELOG.md** — this file

---

## [0.1.0] — 2026-07-06

### Initial Release

- 13-module AI Business OS under `/cockpit`
- Executive Dashboard with Business Health Score
- Client CRM with full CRUD
- Lead Pipeline with Kanban view
- Task Center with priority management
- AI Agent Control Panel (10 agents)
- Automation Hub with enable/disable controls
- Communication Inbox with channel filtering
- Revenue & Analytics dashboard
- Project Tracker with milestones
- File Center with tag filtering
- System Health monitor (12 services)
- Settings & Integrations panel
- Command Palette (⌘K) for quick navigation
- Premium toast notification system
- Responsive sidebar with mobile drawer
- Shared UI component library (15+ components)
- 105+ legacy API routes preserved
- 5-theme design system (Light, Midnight, Aurora, High Contrast, Slate)
