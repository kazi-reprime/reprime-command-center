# Prime/RePrime Command Center — Integration Adapter Audit

## The Goal
Replace ad-hoc API calls and unhandled API key exceptions with a robust, standardized Adapter layer. Every integration must export a standardized interface:
- `getStatus()`: Returns `{ isConfigured: boolean, error?: string }`
- `validateConfig()`: Runs early to prevent fatal crashes if keys are missing.
- Feature methods: `fetch()`, `sync()`, `send()` mapped to normalized data objects.

## Current State of Adapters

### 1. `gmailAdapter` & `calendarAdapter`
* **Current location:** `lib/google/gmail.ts` and `lib/google/calendar.ts`
* **Status:** Mostly robust, but lacks a clean `getStatus()` exposing OAuth token expiration to the UI. If the token expires, the backend throws a 401 unhandled by the UI.

### 2. `whatsappAdapter`
* **Current location:** `lib/timelines/client.ts`
* **Status:** Very brittle. The client assumes `TIMELINES_API_KEY` exists. If the API key is "mock", it attempts the fetch, fails, and returns a 500. Needs `validateConfig()`.

### 3. `smsAdapter` / `voiceAdapter` (Quo/Twilio)
* **Current location:** `lib/phone.ts` and `api/webhooks/sms`
* **Status:** Uses raw SDKs. If `QUO_API_KEY` is missing, it crashes the endpoint. Needs an abstract `smsAdapter` that chooses between Quo and Twilio based on env config, returning safe setup-required states.

### 4. `pipedriveAdapter`
* **Current location:** `lib/pipedrive/client.ts`
* **Status:** Used only in specific webhooks. The UI completely bypasses this and uses mocked `setTimeout` responses (e.g., `ContactsModal.tsx`). Must be rewritten to support `syncInvestors()`.

### 5. `aiAdapter` (Nora)
* **Current location:** `lib/embeddings.ts` and inline in `/api/ai/nora`
* **Status:** Has some basic fallback logic (tries Anthropic, falls back to Groq/OpenAI), but needs extraction into a strict `aiAdapter` file so other parts of the app (like Draft/Briefing) can share the intelligence routing reliably.

## Required Implementation
In Phase 2, we will create/refactor these adapters into `lib/adapters/`:
- `aiAdapter.ts`
- `gmailAdapter.ts`
- `calendarAdapter.ts`
- `smsAdapter.ts`
- `whatsappAdapter.ts`
- `zoomAdapter.ts`
- `pipedriveAdapter.ts`

Each will export a `getStatus()` function, which will be aggregated by the `/api/health` endpoint to drive a new "System Status" component in the UI.
