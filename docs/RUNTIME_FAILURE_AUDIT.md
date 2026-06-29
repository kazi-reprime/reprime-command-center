# Prime/RePrime Command Center — Runtime Failure Audit

## Executive Summary
This document catalogs the functional state of the Command Center UI vs its actual runtime behavior. The audit reveals significant reliance on "optimistic" UI updates, mocked operations (especially around data syncing), and missing error boundaries for when API keys are absent.

---

## Dashboard & Core UI
| Feature | Route / Component | Expected Behavior | Actual Behavior | Root Cause | Fix Required | Status |
|---------|-------------------|-------------------|-----------------|------------|--------------|--------|
| **Page Load** | `/cockpit` | Dashboard loads without hydration errors | Loads correctly, but unhandled promises throw silent console errors when fetching threads | `CommsPanel` lacks proper error boundary on fetch | Add error boundary / try-catch | ⚠️ High |
| **Setup States** | All components | Show "Integration Offline" when API key is missing | Currently, UI just renders infinite spinners or silent failures (e.g., Twilio/WhatsApp) | Mocked keys lead to 500s instead of graceful degradation | Implement `validateConfig()` in adapters | ⚠️ High |

## Contacts & CRM (Pipedrive)
| Feature | Route / Component | Expected Behavior | Actual Behavior | Root Cause | Fix Required | Status |
|---------|-------------------|-------------------|-----------------|------------|--------------|--------|
| **Sync Contacts** | `ContactsModal.tsx` | Fetch from Pipedrive and update DB | Renders a simulated `setTimeout` and `alert('Pipedrive sync complete. (Simulated)')` | Feature is 100% mocked in the UI layer | Connect to `/api/pipedrive/bulk-import` | 🚨 Critical |
| **Investors Tab** | `ContactsModal.tsx` | Show CRM investors | Derives "investors" purely by filtering existing message threads (`laneOverride === 'investor'`) | No actual CRM fetch occurs | Wire to `/api/investors` | 🚨 Critical |

## Nora Assistant
| Feature | Route / Component | Expected Behavior | Actual Behavior | Root Cause | Fix Required | Status |
|---------|-------------------|-------------------|-----------------|------------|--------------|--------|
| **Chat Input** | `RightFlank.tsx` | Chat responds contextually | Works perfectly, but TTS playback sometimes blocked by browser auto-play policies | Browser restriction | Add manual "Play" button fallback | ✅ Low |
| **Missing API Key** | `api/ai/nora` | Graceful setup required | Handled properly via 400 error and fallback message | N/A | None | ✅ Fixed |

## Comms (WhatsApp, SMS, iMessage)
| Feature | Route / Component | Expected Behavior | Actual Behavior | Root Cause | Fix Required | Status |
|---------|-------------------|-------------------|-----------------|------------|--------------|--------|
| **Thread List** | `CommsPanel.tsx` | Load WhatsApp/SMS threads | Timelines API works, but Twilio/Meta fallback throws 502/500 due to mocked keys | Missing real env vars | Detect empty vars and show "Setup Required" | 🚨 Critical |
| **Send Message** | `CommsPanel.tsx` | Message is sent via API | Optimistically appended to UI, but if API fails, user is not notified (silent failure) | Lack of rollback on catch block | Add toast/error notification on failure | ⚠️ High |

## Deals / Payments / Memory
| Feature | Route / Component | Expected Behavior | Actual Behavior | Root Cause | Fix Required | Status |
|---------|-------------------|-------------------|-----------------|------------|--------------|--------|
| **Deals Dashboard** | `DealsDashboard.tsx` | Show pipeline | Hardcoded / empty arrays in most OS-level panels | UI built without backend plumbing | Wire to `api/deals` | 🚨 Critical |
| **Decision Log** | `DecisionLog.tsx` | Log strategic choices | Missing persistence layer completely | DB tables do not exist for Decisions | Create Supabase migration | 🚨 Critical |

## Briefings & Audio
| Feature | Route / Component | Expected Behavior | Actual Behavior | Root Cause | Fix Required | Status |
|---------|-------------------|-------------------|-----------------|------------|--------------|--------|
| **Briefing Generation**| `/api/briefing/today` | Returns generated brief | Throws 401 Unauthorized when triggered without active session token | Route assumes valid NextAuth/Supabase token | Ensure session is passed in headers | ⚠️ High |

---

## Action Plan
1. **Wipe out `alert('Simulated')`** code in `ContactsModal`.
2. Implement **Adapter Status Checkers** to safely disable UI when Twilio/Stripe keys are mocked.
3. Build persistence layer for **Decision Log** and **Deals**.
