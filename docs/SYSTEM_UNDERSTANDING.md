# Prime/RePrime Command Center — System Understanding

## 1. Tech Stack & Architecture
- **Framework:** Next.js 15.5.19 (App Router `app/` heavily utilized for APIs).
- **Frontend:** React with Tailwind CSS. Radix UI primitives likely used for modals/dropdowns.
- **Backend/API:** Next.js Serverless Functions (`app/api/...`).
- **Database:** Supabase (PostgreSQL), primarily accessed via PostgREST rather than direct TCP connections.
- **State Management:** Zustand (`lib/store/useStore.ts`).
- **Auth Method:** Custom access code (`AUTH_ACCESS_CODE="REPRIME"`) / Supabase session token injection.
- **Deployment Platform:** Vercel (`.vercel` directory and Vercel env configs detected).

## 2. Key Integrations & AI Providers
- **AI Core:** Anthropic (Claude 3 Haiku/Sonnet), OpenAI (GPT-3.5/4), Groq. Nora is the central AI agent.
- **Voice/Audio:** ElevenLabs (Text-to-Speech), Deepgram (Transcription).
- **Comms/Messaging:**
  - WhatsApp: Timelines.ai (REST) & Meta Cloud API (fallback).
  - SMS/Voice: Twilio & Quo/OpenPhone.
  - iMessage: BlueBubbles Server.
- **Email & Calendar:** Google OAuth (Gmail API, Google Calendar API), SendGrid/Resend for outbound SMTP.
- **CRM & Data:** Pipedrive CRM, Inforuptcy Scraper.
- **Meetings:** Zoom API & Webhooks.
- **Caching:** Upstash Redis.
- **Payments:** Stripe.

## 3. Frontend Structure (`components/`)
The UI is modularized into dedicated panels representing the OS concept:
- **`cockpit/`**: The main 3-column layout (`LeftFlank.tsx`, `CommsPanel.tsx`, `RightFlank.tsx`, `ApexCard.tsx`).
- **`os/`**: Deep specialized views (`DecisionLog.tsx`, `FollowUpRadar.tsx`, `MeetingCockpit.tsx`, `DealsDashboard.tsx`, `GlobalSearch.tsx`).
- **`chat/` & `center/`**: Legacy or specific interaction surfaces (Nora chat bounds, Voice shell, Kpi cards).
- **`briefing/`, `email/`, `phone/`**: Modal overlays for specific workflows.

## 4. Backend Structure (`app/api/`)
API routes act as orchestrators between the frontend and third-party services/Supabase:
- **`api/ai/`**: Nora inference (`/nora`), drafting (`/draft`), concierge.
- **`api/whatsapp/`**: Thread fetching, sending, webhooks, investor-specific lanes.
- **`api/email/` & `api/gmail/`**: Triage, sync, send, mark-read operations.
- **`api/bucket/` & `api/notes/`**: Supabase CRUD operations for priorities.
- **`api/cron/`**: Scheduled jobs for email watch, investor cadence, center draining.
- **`api/webhooks/`**: Receivers for Stripe, SMS, Voice, WhatsApp, iMessage.

## 5. Environment Variables Map
| Service | Required Keys | Status |
|---------|---------------|--------|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Core DB logic |
| **Google** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Calendar / Mail |
| **Anthropic** | `ANTHROPIC_API_KEY` | Nora Intelligence |
| **OpenAI** | `OPENAI_API_KEY` | Nora Intelligence |
| **ElevenLabs** | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Audio playback |
| **Timelines** | `TIMELINES_API_KEY`, `TIMELINES_CHANNEL_*` | WhatsApp |
| **Pipedrive** | `PIPEDRIVE_API_KEY`, `PIPEDRIVE_DOMAIN` | CRM Data |
| **Upstash** | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate limiting |

## 6. Dependency Map
- **Zustand Store (`useStore.ts`)** -> Holds UI state for threads, messages, unread counts, apex cards.
- **Components (`LeftFlank.tsx`, `CommsPanel.tsx`)** -> Consume `useStore` -> Fire fetches to `app/api/`.
- **API Routes (`api/whatsapp/threads/route.ts`)** -> Consume `lib/timelines/client.ts` or `lib/supabaseClient.ts` -> Return JSON to component.
- **Adapters (`lib/google.ts`, `lib/voiceClient.ts`, `lib/pipedrive/client.ts`)** -> Wrap external fetch logic. Must be fortified to handle missing keys gracefully.

## 7. Known Broken Areas (Initial Hypothesis)
1. **Mock Data Pollution:** The UI attempts to look complete, meaning empty states likely do not exist.
2. **Missing Env Crashes:** If a key (like Twilio) is missing, components likely crash or fail silently instead of showing an "Integration Offline" UI.
3. **State Desync:** Zustand stores might not perfectly match Supabase/Third-party reality, leading to ghost data.
4. **Adapter Layer Inconsistency:** Integrations lack a unified `getStatus()` interface, meaning the frontend guesses if a service is live.
