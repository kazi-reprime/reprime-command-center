# Prime/RePrime Command Center — Environment Variable Audit

## 1. Database & Core Services
| Variable | Required | Client/Server | Purpose | Status in Code | Fallback Behavior |
|----------|----------|---------------|---------|----------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Both | Supabase instance URL | Present | Fails to mock URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Both | Public API access | Present | Fails to mock key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server | Admin API access | Present | Crashes protected routes |
| `UPSTASH_REDIS_REST_URL` | Yes | Server | Rate limiting & caching | Present | Silent errors in caching layer |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Server | Upstash auth | Present | Silent errors |

## 2. Artificial Intelligence
| Variable | Required | Client/Server | Purpose | Status in Code | Fallback Behavior |
|----------|----------|---------------|---------|----------------|-------------------|
| `OPENAI_API_KEY` | Primary | Server | Nora / extraction tasks | Present | Skips OpenAI, tries Anthropic/Groq |
| `ANTHROPIC_API_KEY` | Primary | Server | Claude 3 Haiku for Nora | Present | Features 500 error out |
| `GROQ_API_KEY` | Optional | Server | Fast LLM inference | Present | Uses OpenAI fallback |
| `GEMINI_API_KEY` | Optional | Server | Audio transcription/vision | Present | Falls back to OpenAI |
| `ELEVENLABS_API_KEY` | Yes | Server | Nora Text-to-Speech | Present | Audio generation fails |
| `ELEVENLABS_VOICE_ID` | Yes | Server | specific voice configuration| Present | Defaults to internal fallback |

## 3. Communication & CRM
| Variable | Required | Client/Server | Purpose | Status in Code | Fallback Behavior |
|----------|----------|---------------|---------|----------------|-------------------|
| `TIMELINES_API_KEY` | Yes | Server | WhatsApp Sync (Primary) | Present | 500 on thread load |
| `PIPEDRIVE_API_KEY` | Yes | Server | CRM Sync (Investors) | Present | Setup-required or 500 |
| `SENDGRID_API_KEY` | Yes | Server | Outbound Email via OS | Present | Fails silently on `sgMail.send` |
| `QUO_API_KEY` | Yes | Server | SMS / OpenPhone routing | Present | Comms fail |
| `TWILIO_AUTH_TOKEN` | No | Server | SMS (Legacy/Fallback) | Present | Unused mostly, throws if called |
| `BLUEBUBBLES_WEBHOOK_SECRET` | No | Server | iMessage integration | Present | Webhook rejects 401 |

## 4. Google Workspace
| Variable | Required | Client/Server | Purpose | Status in Code | Fallback Behavior |
|----------|----------|---------------|---------|----------------|-------------------|
| `GOOGLE_CLIENT_ID` | Yes | Server | OAuth for Gmail/Calendar | Present | OAuth flow broken |
| `GOOGLE_CLIENT_SECRET` | Yes | Server | OAuth security | Present | OAuth flow broken |
| `GOOGLE_REFRESH_TOKEN` | Yes | Server | Background sync auth | Present | Fails to pull emails/events |

## 5. Security & App Configuration
| Variable | Required | Client/Server | Purpose | Status in Code | Fallback Behavior |
|----------|----------|---------------|---------|----------------|-------------------|
| `NEXT_PUBLIC_APP_URL` | Yes | Both | Base URL for webhooks | Present | Defaults to `project-7e87w.vercel.app` |
| `AUTH_ACCESS_CODE` | Yes | Server | Login gate protection | Present | Defaults to `REPRIME` |
| `CRON_SECRET` | Yes | Server | Secures Vercel Cron jobs | Present | Rejects chron execution |

---

## Conclusion & Fixes
The primary vulnerability lies in how the Next.js routes handle missing keys. Many adapters do not check `Boolean(process.env.KEY)` before initializing their SDKs (e.g., Anthropic, Google, Timelines). This results in hard crashes (`TypeError: Cannot read properties of undefined`) or 500 errors instead of passing a clean `{ status: 'offline', requiresSetup: true }` state to the frontend.

**Action:** Step 7 (Integration Adapter Audit) will enforce strict validation checks for these environment variables.
