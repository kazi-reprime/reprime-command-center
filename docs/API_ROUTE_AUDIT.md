# Prime/RePrime Command Center — API Route Audit

## General Observation
Most endpoints utilize the standard Next.js App Router format (`route.ts`). Almost all authenticated endpoints rely on a custom NextAuth-style session layer or expect `AUTH_ACCESS_CODE` / Supabase auth headers.

## 1. Core Endpoints
| Route | Method | Purpose | Auth Required | Status | Fix Needed |
|-------|--------|---------|---------------|--------|------------|
| `/api/health` | GET | System uptime / env check | No | ✅ Working | None |
| `/api/bucket` | GET/POST/PATCH | Manage APEX task list | Yes (Session) | ✅ Working | Add pagination handling |
| `/api/notes` | GET/POST/DEL | CRUD for standard notes | Yes | ❌ 401 Auth fail | Validate auth middleware |
| `/api/deals` | GET | List deal pipeline | Yes | ❌ Fake Data | Mocked response. Connect to Supabase |
| `/api/investors` | GET/POST | List/Manage CRM Investors | Yes | ❌ Fake Data | Mocked response. Connect to Pipedrive |

## 2. Artificial Intelligence (Nora)
| Route | Method | Purpose | Auth Required | Status | Fix Needed |
|-------|--------|---------|---------------|--------|------------|
| `/api/ai/nora` | POST | Primary assistant inference | Yes | ✅ Working | Graceful UI fallback if `ANTHROPIC_API_KEY` missing |
| `/api/ai/draft` | POST | Auto-draft emails/texts | Yes | ✅ Working | None |
| `/api/briefing/today` | GET | Generate daily brief | Yes | ❌ 401 | Validate token passing on fetch |
| `/api/voice/speak` | POST | ElevenLabs TTS Generation | Yes | ✅ Working | Fails if API key mocked (needs catch block) |

## 3. Communication & Comms
| Route | Method | Purpose | Auth Required | Status | Fix Needed |
|-------|--------|---------|---------------|--------|------------|
| `/api/whatsapp/threads`| GET | Load chats via Timelines | Yes | ❌ 500 / 401 | API key mocked. Return 503 Service Unavailable |
| `/api/email/sync` | POST | Force Gmail resync | Yes | ✅ Working | Add status flag for "Offline" if OAuth fails |
| `/api/gmail` | GET | Load inbox | Yes | ✅ Working | None |
| `/api/invitations` | POST | Send Terminal Invites | Yes | ❌ Hardcoded | Sends to hardcoded lists. Wire to real contacts |

## 4. Webhooks & Cron
| Route | Method | Purpose | Auth Required | Status | Fix Needed |
|-------|--------|---------|---------------|--------|------------|
| `/api/webhooks/sms` | POST | Twilio/Quo inbound SMS | HMAC Check | ❌ 500 | `TWILIO_AUTH_TOKEN` is mock, fails validation |
| `/api/webhooks/stripe`| POST | Stripe payments | Stripe Sig | ❌ 500 | Signature check fails on mock key |
| `/api/cron/*` | GET | Vercel Cron dispatchers | `CRON_SECRET` | ✅ Active | None |

---

## Action Plan for API Layer
1. **Remove Hardcoded JSON:** `/api/deals` and `/api/investors` must fetch from Supabase and Pipedrive respectively.
2. **Standardize Auth:** Fix `/api/notes` and `/api/briefing/*` which are throwing 401 Unauthorized even when the user is logged into the frontend.
3. **Graceful Failures:** Catch missing environment variables in `/api/whatsapp/threads` and return a structured `{ error: "setup_required", service: "timelines" }` response instead of throwing 500 errors.
