# MISSING FEATURES AUDIT — RePrime Command Center

> **Audited:** 2026-06-29  
> **Codebase:** `/Users/mkazi/New Command Center` (Next.js 15.5.19)  
> **Live:** https://reprime-command-center.vercel.app  
> **API Routes:** 105 total  
> **Components:** 78 total  
> **Database:** Drizzle ORM + Supabase (PostgreSQL + pgvector)

---

## Executive Summary

The codebase is **far more complete than expected**. It is NOT a mock/demo — it contains production-quality backend code across 105 API routes, real integrations (Anthropic Claude, Google Calendar, Pipedrive, WhatsApp/Quo Vadis, Supabase Realtime, Upstash Redis, ElevenLabs, SendGrid, Zoom), and a sophisticated Zustand-driven frontend.

**What works well:** WhatsApp comms, Nora AI (Claude), morning briefing, task bucket, email triage scoring, Pipedrive CRM sync, invitation system, voice transcription routes.

**What's missing or incomplete:** APEX priority system (no UI), religious calendar (hardcoded), contact grouping (no dedicated UI), notes (API exists but limited cockpit exposure), follow-up management (no dedicated panel), evening briefing (API exists but no UI), voice recording (buttons exist but no handlers), playback speed, EN/HE toggle persistence, Zoom embedded, and several decorative buttons with no handlers.

---

## Module-by-Module Audit

### A. APEX / Current Priority System

| Item | Status |
|------|--------|
| **Exists** | ❌ NO dedicated APEX component |
| **API** | ✅ `/api/briefing/today` returns `suggested_focus[]` — closest equivalent |
| **Priority Calculation** | ⚠️ PARTIAL — `lib/center/soft-schedule.ts` computes focus from calendar gaps + bucket items, but doesn't aggregate emails/messages/investor activity into a single priority score |
| **UI Component** | ❌ No APEX card in cockpit |
| **Current file** | `lib/center/soft-schedule.ts`, `app/api/briefing/today/route.ts` |

**What's missing:**
- No `ApexCard` component in cockpit
- No unified priority scoring across all data sources (calendar, emails, messages, deals, follow-ups)
- No "mark handled" / "ask Nora about this" actions
- No pinned priority items

**Backend work needed:**
- New `/api/apex` route that aggregates: upcoming calendar (from `/api/calendar/today`), overdue follow-ups (from bucket items with `remind_at` past), unread important emails (from Gmail triage score), unread investor messages, Nora-detected urgent items
- Priority ranking algorithm

**Priority:** 🔴 CRITICAL

---

### B. Nora Assistant

| Item | Status |
|------|--------|
| **Exists** | ✅ YES — `components/cockpit/panels/RightFlank.tsx` |
| **API** | ✅ `/api/nora/chat` — Anthropic Claude with Haiku/Opus model selection |
| **Text input** | ✅ Working — sends to `/api/ai/nora` (note: RightFlank calls `/api/ai/nora` but the actual route is `/api/nora/chat`) |
| **Voice input** | ❌ Mic button exists in CommsPanel but NO handler |
| **Contextual answers** | ⚠️ PARTIAL — accepts `context` JSON but cockpit doesn't send any context |
| **Task creation** | ⚠️ PARTIAL — Nora API checks for `tasksToCreate` in response but no tool-use implemented |
| **Briefing generation** | ✅ `/api/briefing/today` (483 lines, production-quality) |
| **Email/message reply drafting** | ✅ `/api/ai/draft` route exists |
| **Follow-up creation** | ❌ No follow-up creation from Nora |
| **Note creation** | ⚠️ `/api/notes` exists but Nora can't create notes |
| **Summarization** | ✅ In Nora's system prompt |
| **Hebrew/English** | ✅ Auto-detected via regex, persisted to `nora_chat_messages` |
| **Translation** | ✅ `/api/center/translate` route exists |
| **Contact/thread analysis** | ⚠️ PARTIAL — can analyze if context is provided |
| **Confirmation before send** | ❌ No confirmation modal |
| **Persistent task/action log** | ✅ Chat messages persisted to `nora_chat_messages` table |
| **Chat history** | ✅ `/api/nora/history` route exists |

**What's missing:**
- RightFlank calls `/api/ai/nora` but the real route is `/api/nora/chat` — **possible routing mismatch bug**
- No live cockpit context being sent with Nora queries (emails, threads, calendar data)
- No tool-use / function-calling for Nora to create tasks, notes, follow-ups
- No confirmation modal before Nora sends emails/messages
- No voice input handler
- Initial greeting is hardcoded

**Priority:** 🔴 CRITICAL

---

### C. Calendar

| Item | Status |
|------|--------|
| **Exists** | ✅ YES — `components/cockpit/panels/LeftFlank.tsx` |
| **API** | ✅ `/api/calendar` and `/api/calendar/today` |
| **Today's events** | ✅ Fetches from `/api/calendar` |
| **Start/end times** | ✅ Formatted properly |
| **Timezone** | ✅ America/Chicago used in briefing |
| **Event details** | ⚠️ PARTIAL — shows summary, time, duration but no attendees/description |
| **Attendees** | ❌ Not shown |
| **Location** | ❌ Not shown |
| **Zoom/Meet link** | ✅ `meetingUrl` detected, "Join Call" button shown only when link exists |
| **Create note from event** | ❌ No action button |
| **Create follow-up from event** | ❌ No action button |
| **Meeting briefing** | ✅ `/api/briefing/today` generates meeting context |
| **Google Calendar connection state** | ❌ No "Connect Calendar" UI — silently fails if not connected |
| **Backend** | ✅ `lib/google/calendar.ts` — real Google Calendar API via OAuth |

**What's missing:**
- Attendees, location, description not displayed
- No "Create note" / "Create follow-up" actions on events
- No connection status indicator
- No upcoming events (shows today only)

**Priority:** 🟡 HIGH

---

### D. Religious Calendar

| Item | Status |
|------|--------|
| **Exists** | ⚠️ PARTIAL — hardcoded elements only |
| **Hebrew date** | ❌ Not displayed |
| **Shabbat start** | ❌ Hardcoded text "SHABBAT MONITOR ACTIVE" in TopChrome |
| **Candle-lighting time** | ❌ Hardcoded "Shabbat lockout armed. All outbound schedules queue at sunset." in LeftFlank |
| **Jewish holidays** | ❌ Not implemented |
| **Timezone/location** | ❌ No Postville/location config |
| **Real library/API** | ❌ No hebcal or similar integration |

**What's missing:**
- Entire religious calendar module needs implementation
- Need `hebcal` library or Hebcal API
- Need real Shabbat times for configured location
- Need Hebrew date display
- Need holiday awareness

**Priority:** 🟡 HIGH

---

### E. Email Triage / Gmail

| Item | Status |
|------|--------|
| **Exists** | ✅ YES — `components/cockpit/panels/LeftFlank.tsx` + extensive API routes |
| **Gmail OAuth** | ✅ `lib/google.ts` — OAuth2 with refresh token |
| **Inbox list** | ✅ `/api/gmail` returns scored emails |
| **Unread count** | ⚠️ Not displayed as badge |
| **Read full email** | ❌ No email detail view in cockpit |
| **Search emails** | ❌ No search UI |
| **Classify/triage** | ✅ `/api/email/triage` route exists |
| **Summarize** | ✅ Nora can summarize |
| **Urgent detection** | ✅ Score-based coloring (green > 10, red < 0) |
| **Investor/deal detection** | ⚠️ Via scoring but no explicit category labels |
| **Suggested replies** | ✅ `/api/ai/draft` route exists |
| **Compose** | ⚠️ `/api/email/send` and `/api/email/draft` exist but no compose UI in cockpit |
| **Send with confirmation** | ❌ No confirmation modal |
| **Archive/mark read** | ✅ `/api/email/mark-read` exists |
| **Link to contact/follow-up** | ❌ No linking UI |
| **Email categories** | ⚠️ Scoring exists but no explicit category labels shown |
| **"Open Gmail" button** | ⚠️ Button exists but has no `onClick` handler |

**What's missing:**
- "Open Gmail" button has no handler (decorative)
- No email detail view / reading pane
- No compose modal
- No search
- No explicit category labels (urgent/investor/legal/etc.)
- No send confirmation

**Priority:** 🟡 HIGH

---

### F. Comms Center

| Item | Status |
|------|--------|
| **Exists** | ✅ YES — `components/cockpit/panels/CommsPanel.tsx` (392 lines) |
| **WhatsApp threads** | ✅ Real — fetches from `/api/whatsapp/threads` |
| **SMS threads** | ⚠️ API structure supports it but may not have SMS provider connected |
| **iMessage threads** | ⚠️ `/api/webhooks/imessage` webhook exists but no adapter connected |
| **Thread list** | ✅ Working with search & channel filter |
| **Latest message** | ✅ Shown in thread preview |
| **Unread count** | ✅ Badge shown |
| **Timestamp** | ✅ Shown |
| **Open conversation** | ✅ Working — loads messages |
| **Read messages** | ✅ Working — fetches from `/api/whatsapp/messages` |
| **Reply** | ✅ Working — sends via POST to `/api/whatsapp/messages` |
| **Supabase Realtime** | ✅ Live message subscription |
| **RTL Hebrew support** | ✅ Auto-detected |
| **Search** | ✅ Working |
| **Channel filter** | ✅ all/whatsapp/imessage/sms tabs |
| **Translate** | ❌ No translate button (API exists at `/api/center/translate`) |
| **Summarize** | ❌ No summarize button |
| **Tag contact** | ❌ No tag button (`/api/tags/apply` exists) |
| **Create follow-up** | ❌ No follow-up button |
| **Create note** | ❌ No note button |
| **Ask Nora about thread** | ❌ No Nora integration |
| **Phone button** | ⚠️ Decorative — no handler |
| **Archive button** | ⚠️ Decorative — no handler |
| **Delete button** | ⚠️ Decorative — no handler |
| **Mic button** | ⚠️ Decorative — no handler |
| **305/718 panel labels** | ⚠️ Data fetched for both panels but not visually separated |
| **Adapter pattern** | ❌ No adapter abstraction — directly calls WhatsApp API |
| **Provider setup-required state** | ❌ No disconnected state shown |

**What's missing:**
- 5 decorative buttons with no handlers (Phone, Archive, Delete, Mic, Open Gmail)
- No translate/summarize/tag/follow-up/note action buttons
- No Nora integration for thread analysis
- No adapter pattern for SMS/iMessage/WhatsApp
- No setup-required state for disconnected providers

**Priority:** 🟡 HIGH

---

### G. Contact Grouping

| Item | Status |
|------|--------|
| **Exists** | ⚠️ PARTIAL — thread `laneOverride` field exists (general/investor/staff) |
| **Dedicated UI** | ❌ No contact grouping panel |
| **Groups: investors/family/staff/others** | ⚠️ investor/staff exist, family/others missing |
| **Manual labels** | ⚠️ `/api/tags/apply` and `/api/tags/bulk-upload` exist |
| **Contact metadata** | ✅ `/api/contacts/import-names` exists |
| **AI suggestions** | ❌ No AI-based grouping |
| **Search contacts** | ❌ No contact search UI (thread search exists) |
| **Filter by group** | ⚠️ Lane filter exists in comms (investor/staff/general) |
| **Recent activity** | ❌ No activity counts shown |
| **Priority score** | ❌ No contact-level priority |
| **Linked messages/emails** | ❌ No cross-reference view |

**What's missing:**
- No dedicated Contact panel/page
- No family/others groups
- No AI-based contact categorization
- No contact detail view with linked items

**Priority:** 🟠 MEDIUM

---

### H. Notes System

| Item | Status |
|------|--------|
| **Exists** | ⚠️ PARTIAL |
| **API** | ✅ `/api/notes` (GET/POST) |
| **UI** | ✅ `components/sidebar/NotesPanel.tsx` exists in center view |
| **Quick capture** | ⚠️ Depends on NotesPanel implementation |
| **Title/body** | ⚠️ Depends on implementation |
| **Save/edit/delete** | ⚠️ API supports CRUD but needs verification |
| **Search** | ❌ No note search |
| **Link to contact/thread/email** | ❌ No linking |
| **Voice transcript to note** | ❌ Not connected |
| **AI cleanup/summarize** | ❌ Not connected |
| **Cockpit integration** | ❌ NotesPanel only in center view, not in cockpit |

**What's missing:**
- NotesPanel not exposed in cockpit view (only in center)
- No note linking to contacts/threads/emails/events
- No voice-to-note pipeline
- No AI summarization of notes
- No search

**Priority:** 🟡 HIGH

---

### I. Morning / Evening Briefings

| Item | Status |
|------|--------|
| **Morning briefing API** | ✅ `/api/briefing/today` — 483 lines, production-quality |
| **Evening briefing API** | ✅ `/api/briefing/evening` route exists |
| **Briefing UI** | ✅ `components/briefing/BriefingModal.tsx` exists |
| **Calendar events** | ✅ Included in briefing |
| **Urgent emails** | ⚠️ Not explicitly in briefing |
| **Urgent messages** | ✅ Unread counts by panel |
| **Missed follow-ups** | ✅ `pending_followups` section |
| **Investor activity** | ✅ `recent_investors` section |
| **Deadlines** | ✅ `expiring_invitations` section |
| **Active deals** | ✅ `active_deals` from Pipedrive |
| **Tenant filings** | ✅ `tenant_filings_today` from Inforuptcy |
| **Suggested priorities** | ✅ `suggested_focus` computed |
| **Generate/regenerate** | ⚠️ Depends on BriefingModal implementation |
| **Store briefing** | ⚠️ Redis-cached but not permanently stored |
| **Read-aloud** | ❌ No audio output |
| **Hebrew/English** | ❌ Not language-toggled |
| **Cockpit integration** | ❌ BriefingModal not visible in cockpit layout |

**What's missing:**
- BriefingModal not triggered from cockpit (only from center view)
- No audio/read-aloud briefing
- No language toggle for briefing output
- Evening briefing not exposed in UI
- No permanent briefing storage

**Priority:** 🟡 HIGH

---

### J. Pending Follow-ups

| Item | Status |
|------|--------|
| **Exists** | ⚠️ PARTIAL |
| **Create follow-up manually** | ✅ `/api/bucket` POST — bucket_items table |
| **Create from email** | ❌ No email-to-followup flow |
| **Create from message** | ❌ No message-to-followup flow |
| **Create from calendar** | ❌ No event-to-followup flow |
| **AI-detected follow-ups** | ❌ No AI detection |
| **Due date** | ✅ `due_at_soft` in schema |
| **Priority** | ✅ `priority` field (1-5) |
| **Mark done** | ✅ `/api/tasks` PATCH with `completed: true` |
| **Snooze** | ✅ `/api/bucket/[id]/remind` — reminder system |
| **Link to source** | ❌ No source linking |
| **Unread/needs-reply detection** | ⚠️ WhatsApp unread counts exist but not linked to follow-ups |
| **Dedicated panel** | ⚠️ Tasks Bucket in RightFlank shows bucket items but no follow-up-specific view |

**What's missing:**
- No dedicated follow-up panel with filtering
- No create-from-source workflows (email, message, calendar)
- No AI-detected follow-up suggestions
- No source linking

**Priority:** 🟡 HIGH

---

### K. Voice / Recording

| Item | Status |
|------|--------|
| **Voice API routes** | ✅ `/api/voice/speak`, `/api/voice/transcribe-en`, `/api/voice/transcribe-he` |
| **Voice lib** | ✅ `lib/voice/` directory exists, `lib/voiceClient.ts` |
| **ElevenLabs integration** | ✅ API key configured |
| **UI components** | ✅ `components/center/VoiceShell.tsx`, `VoiceShellFooter.tsx`, `VoiceModalsHost.tsx`, `v2/VoiceMicHero.tsx`, `v2/MicAmplitudeBars.tsx` |
| **Mic button in CommsPanel** | ⚠️ Exists but NO handler |
| **Recording state** | ⚠️ Components exist in center but not wired in cockpit |
| **Speech-to-text** | ✅ `/api/voice/transcribe-en` and `/api/voice/transcribe-he` |
| **Transcript preview** | ❌ Not in cockpit |
| **Send transcript to Nora** | ❌ Not connected |
| **Error handling** | ❌ No microphone permission handling in cockpit |

**What's missing:**
- Mic button in cockpit CommsPanel has no handler
- Voice components exist in center view but not wired into cockpit
- No microphone permission flow
- No transcript-to-Nora pipeline
- No "Voice setup required" fallback state

**Priority:** 🟠 MEDIUM

---

### L. Playback Speed

| Item | Status |
|------|--------|
| **Exists** | ❌ NO |
| **Audio output** | ✅ `/api/voice/speak` (ElevenLabs TTS) |
| **Speed controls** | ❌ No speed selector UI |
| **Affects briefings** | ❌ No audio briefing |
| **Affects Nora** | ❌ No Nora audio responses |

**What's missing:**
- Entire playback speed module
- Audio player component with speed controls

**Priority:** 🟢 LOW

---

### M. Hebrew / English Toggle

| Item | Status |
|------|--------|
| **Exists** | ⚠️ PARTIAL |
| **Auto-detection** | ✅ RTL detection in CommsPanel, Hebrew detection in Nora |
| **Manual toggle** | ❌ No EN/HE toggle UI in cockpit |
| **Persisted preference** | ❌ Not stored |
| **Affects AI summaries** | ⚠️ Nora responds in the language spoken to it |
| **Affects Nora responses** | ✅ Auto-switches |
| **Affects reply drafts** | ⚠️ Via Nora's system prompt |
| **Affects briefings** | ❌ Briefings always English |
| **Affects UI labels** | ❌ No i18n |

**What's missing:**
- No explicit EN/HE toggle button
- No persisted language preference
- No i18n for UI labels
- Briefings don't respect language preference

**Priority:** 🟠 MEDIUM

---

### N. Terminal Invitations

| Item | Status |
|------|--------|
| **Exists** | ✅ YES — extensive implementation |
| **API** | ✅ `/api/invitations` (GET/POST), `/api/invitations/[token]/calendar.ics`, `/api/invitations/[token]/reschedule`, `/api/invitations/add-attendee`, `/api/invitations/by-contact` |
| **Select contacts** | ✅ `/api/invitations/by-contact` |
| **Generate invitation** | ✅ Full invitation system |
| **Channel: email** | ✅ SendGrid integration |
| **Preview** | ⚠️ Depends on UI component |
| **Send confirmation** | ❌ No confirmation modal |
| **Log invitation** | ✅ Stored in `invitations` table |
| **Track response** | ✅ Status tracking, expiration |
| **Create follow-up** | ⚠️ Expiring invitations shown in briefing |
| **Booking system** | ✅ `/api/bookings/*` — full slot selection and confirmation |
| **UI components** | ✅ `components/bookings/BookingsPanel.tsx`, `SlotSelector.tsx`, `components/chat/InviteComposer.tsx` |

**What's missing:**
- No SMS/WhatsApp invitation channel (email only)
- No confirmation modal before sending
- Invitation UI not directly accessible from cockpit

**Priority:** 🟢 LOW (mostly complete)

---

### O. Zoom / Meeting Workflow

| Item | Status |
|------|--------|
| **Exists** | ⚠️ PARTIAL |
| **Detect Zoom/Meet links** | ✅ `meetingUrl` field in calendar events |
| **Join button** | ✅ Shown only when `meetingUrl` exists |
| **External open** | ✅ Opens in new tab |
| **Embedded Zoom** | ❌ Not implemented (lib/zoom/ exists) |
| **Meeting briefing** | ✅ Via `/api/briefing/today` |
| **Note-taking** | ❌ No in-meeting note UI |
| **Follow-up generation** | ❌ No post-meeting follow-up |
| **Zoom webhook** | ✅ `/api/zoom/webhook`, `/api/zoom/ai-companion-ingest` |

**What's missing:**
- No in-meeting note-taking
- No post-meeting follow-up generation
- Zoom AI companion ingest exists but not surfaced in UI

**Priority:** 🟢 LOW

---

### P. Backlog / Decisions

| Item | Status |
|------|--------|
| **Exists** | ⚠️ PARTIAL — bucket_items table serves as backlog |
| **Load from DB** | ✅ `/api/bucket` (GET) |
| **Display items** | ✅ RightFlank Tasks Bucket |
| **Status tracking** | ⚠️ Only open/completed, no planned/in-progress/parked/opted-out |
| **Client decisions** | ❌ Not tracked in current schema |
| **Update support** | ✅ `/api/bucket/[id]` PATCH |

**What's missing:**
- No rich status taxonomy (planned/in-progress/done/parked/opted-out)
- No client decision preservation
- No backlog-specific view

**Priority:** 🟢 LOW

---

## Backend / Data Audit

### Database Schema (Drizzle ORM)

| Table | Status | Notes |
|-------|--------|-------|
| `organizations` | ✅ | Multi-tenant support |
| `org_members` | ✅ | Role-based access |
| `org_invites` | ✅ | Invite flow |
| `threads` | ✅ | Unified messaging threads |
| `messages` | ✅ | Chat messages |
| `bucket_items` | ✅ | Tasks/reminders/follow-ups |
| `nora_memory` | ✅ | pgvector semantic memory |
| `whatsapp_threads` | ✅ | Used via Supabase (not Drizzle) |
| `whatsapp_messages` | ✅ | Real-time subscribed |
| `nora_chat_messages` | ✅ | Chat persistence |
| `invitations` | ✅ | Invitation tracking |
| `inforuptcy_filings` | ✅ | Tenant monitoring |

**Missing tables needed:**
- `notes` — dedicated notes table (may exist in Supabase but not in Drizzle schema)
- `follow_ups` — dedicated follow-up tracking
- `contact_groups` — contact grouping/labels
- `briefing_logs` — persisted briefings
- `audit_logs` — action audit trail
- `app_settings` — language preference, location, etc.

### API Routes Status

| Category | Routes | Status |
|----------|--------|--------|
| Health | 1 | ✅ Working |
| Nora AI | 2 | ✅ Working (chat + history) |
| AI | 3 | ✅ Working (nora, draft, concierge) |
| Briefing | 2 | ✅ Working (today + evening) |
| Calendar | 2 | ✅ Working |
| Email | 5 | ✅ Routes exist (draft, mark-read, send, sync, triage) |
| Gmail | 1 | ✅ Working |
| WhatsApp | 7 | ✅ Working |
| Voice | 3 | ✅ Routes exist (speak, transcribe-en, transcribe-he) |
| Center | 18 | ✅ Working (extensive feature set) |
| Contacts | 2 | ✅ Working |
| Tasks/Bucket | 4 | ✅ Working |
| Notes | 1 | ⚠️ Needs verification |
| Invitations | 5 | ✅ Working |
| Investors | 2 | ✅ Working |
| Pipedrive | 6 | ✅ Working |
| Secretary | 2 | ✅ Working |
| Tags | 2 | ✅ Working |
| Crew | 2 | ✅ Working |
| Cron jobs | 9 | ✅ Routes exist |
| Phone | 4 | ✅ Webhook routes exist |
| Webhooks | 5 | ✅ Listener routes exist |
| Zoom | 2 | ✅ Routes exist |
| Bookings | 4 | ✅ Working |
| Messages | 1 | ✅ Working |
| Auth | 2 | ✅ Working |
| Billing | 1 | ✅ Route exists |
| Outreach | 1 | ✅ Route exists |

### Integration Status

| Service | Connected | Key Present | Adapter |
|---------|-----------|-------------|---------|
| Anthropic (Claude) | ✅ | ✅ | Direct SDK |
| OpenAI | ⚠️ | ✅ | Not primary AI |
| Google Calendar | ✅ | ✅ | `lib/google/calendar.ts` |
| Gmail | ✅ | ✅ | `lib/google.ts` |
| Pipedrive | ✅ | ✅ | `lib/pipedrive/client.ts` |
| WhatsApp (Quo Vadis) | ✅ | ✅ | Direct API |
| Supabase | ✅ | ✅ | `lib/supabase/` |
| Upstash Redis | ✅ | ✅ | Direct SDK |
| ElevenLabs | ✅ | ✅ | `lib/voice/` |
| SendGrid | ✅ | ✅ | `lib/sendgrid/` |
| Zoom | ⚠️ | Unknown | `lib/zoom/` |
| Slack | ⚠️ | Unknown | `lib/slack/` |
| Stripe | ⚠️ | Unknown | Webhook only |
| Inforuptcy | ⚠️ | ⚠️ (password missing) | `lib/inforuptcy.ts` |
| SMS Provider | ❌ | ❌ | No adapter |
| iMessage | ❌ | ❌ | Webhook only |

---

## Decorative / Non-Functional Buttons

These buttons exist in the UI but have NO click handlers:

| Component | Button | Location |
|-----------|--------|----------|
| CommsPanel | 📞 Phone | Thread header |
| CommsPanel | 📁 Archive | Thread header |
| CommsPanel | 🗑️ Delete | Thread header |
| CommsPanel | 🎤 Mic | Reply compose box |
| LeftFlank | 📧 Open Gmail | Email card |

---

## Hardcoded / Fake Data

| Item | Location | What's hardcoded |
|------|----------|-----------------|
| Crew members | TopChrome.tsx L7-14 | 6 members hardcoded |
| "SHABBAT MONITOR ACTIVE" | TopChrome.tsx L50 | Always shown |
| "Shabbat lockout armed" | LeftFlank.tsx L188-191 | Always shown |
| Nora greeting | RightFlank.tsx L21 | "Hello Gideon. Ready to draft..." |
| "COCKPIT v0.3" | TopChrome.tsx L37 | Version hardcoded |

---

## Implementation Priority Summary

### 🔴 CRITICAL (Must implement)
1. **Fix Nora API routing** — RightFlank calls `/api/ai/nora` but route is at `/api/nora/chat`
2. **APEX priority card** — No current priority display
3. **Wire decorative buttons** — 5 buttons with no handlers
4. **Send cockpit context to Nora** — Currently sends nothing

### 🟡 HIGH (Should implement)
5. **Religious calendar** — Replace hardcoded Shabbat with real hebcal
6. **Email detail view** — Can't read emails in cockpit
7. **Notes in cockpit** — NotesPanel exists but not in cockpit layout
8. **Follow-up panel** — No dedicated follow-up management
9. **Briefing access** — BriefingModal not accessible from cockpit
10. **Contact grouping** — No dedicated contact management
11. **Evening briefing UI** — API exists, no UI trigger

### 🟠 MEDIUM (Should implement)
12. **EN/HE toggle** — No manual language switch
13. **Voice integration** — Components exist, not wired
14. **Adapter pattern** — No integration abstraction
15. **Loading/error states** — Some components missing error states
16. **Crew from DB** — Hardcoded crew list

### 🟢 LOW (Nice to have)
17. **Playback speed** — No audio playback
18. **Embedded Zoom** — External link is fine
19. **Backlog status** — Simple open/done is functional
20. **Invitation channels** — Email-only is functional
21. **Post-meeting follow-ups** — Manual is fine

---

## Required Schema Additions

```sql
-- Notes table (if not already in Supabase)
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255),
  body TEXT,
  linked_contact_phone VARCHAR(50),
  linked_thread_id UUID,
  linked_email_id VARCHAR(255),
  linked_event_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Follow-ups table  
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  source_type VARCHAR(50), -- 'email', 'message', 'calendar', 'manual', 'ai'
  source_id VARCHAR(255),
  contact_phone VARCHAR(50),
  due_at TIMESTAMP,
  priority INTEGER DEFAULT 3,
  status VARCHAR(50) DEFAULT 'pending', -- pending, snoozed, completed
  snoozed_until TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- App settings
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  language VARCHAR(5) DEFAULT 'en',
  location VARCHAR(255) DEFAULT 'Postville, IA',
  timezone VARCHAR(50) DEFAULT 'America/Chicago',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Next Steps

1. Fix critical Nora API routing mismatch
2. Implement APEX priority card component
3. Wire all decorative buttons to real handlers
4. Integrate hebcal for religious calendar
5. Add email detail view
6. Add notes panel to cockpit
7. Add briefing trigger to cockpit
8. Add follow-up management
9. Add EN/HE toggle
10. Connect voice handlers
11. Replace hardcoded data
12. Add missing loading/error/setup-required states
13. Run production build
14. Produce final implementation report
