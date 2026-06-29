# Prime/RePrime Command Center — Frontend Handler Audit

## Overview
There are over 250 explicit `onClick` and `onSubmit` handlers in the frontend. This audit focuses on the critical interactions dictated by the OS specification.

## Core Interaction Handlers
| Component | UI Label | Expected Behavior | Current Handler | Status / Fix Needed |
|-----------|----------|-------------------|-----------------|---------------------|
| `RightFlank.tsx` | "Dictate to Nora" | Start speech recognition | `recognition.start()` | ✅ Uses Web Speech API. Fails if browser blocks. Add error toast. |
| `RightFlank.tsx` | "Instruct Nora" (Enter) | Send message to AI | `handlePromptSend()` | ✅ Works, but TTS playback sometimes auto-blocked. |
| `ContactsModal.tsx` | "Sync Pipedrive" | Fetch CRM updates | `handleSync()` | ❌ FAKE: Triggers `setTimeout` and `alert()`. Wire to `/api/pipedrive`. |
| `LeftFlank.tsx` | Zoom Link in Event | Open Zoom | `<a href={event.meetingUrl}>` | ✅ Works via heuristic parser. Should be handled by Calendar Adapter natively. |
| `DecisionLog.tsx` | "Record Decision" | Save to DB | N/A | ❌ Empty Component. Needs DB wiring and `onClick` handler. |
| `DealsDashboard.tsx` | "View Deal" | Open details | N/A | ❌ Hardcoded mock list. Needs proper handler and state. |
| `MeetingCockpit.tsx` | "Generate Briefing" | Build prep document | `handleBriefing()` | ❌ Missing UI handler in some views, and API throws 401. |
| `EmailModal.tsx` | "Send" / "Reply" | Dispatch email | `handleSend()` | ✅ Works via `/api/email/send`. |
| `CommsPanel.tsx` | "Send" (WhatsApp) | Dispatch message | `handleReply()` | ❌ Assumes API works. Fails silently if `TIMELINES_API_KEY` is missing. |
| `NotesPanel.tsx` | "Save Note" | Persist note | `handleSave()` | ❌ Throws 401 because `/api/notes` is rejecting auth. |

## Actionable Fixes for Phase 2
1. **Disable Buttons for Offline Adapters:** If WhatsApp/SMS keys are mocked, the "Send" button in `CommsPanel.tsx` must be disabled with a tooltip reading "Integration Offline".
2. **Remove Fake Alerts:** Remove `alert('Simulated')` across the app and wire to actual API routes, even if those routes just return `501 Not Implemented` for now.
3. **Build Missing Forms:** Create forms for `DecisionLog` and `DealsDashboard` to capture user input, which currently just render static mocks.
