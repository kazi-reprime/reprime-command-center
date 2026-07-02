# Contributing to RePrime Command Center

Thank you for contributing! This guide explains how to set up, develop, and submit changes.

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

## Local Setup

```bash
# Clone
git clone https://github.com/kazi-reprime/reprime-command-center.git
cd reprime-command-center

# Install
npm install --legacy-peer-deps

# Environment
cp .env.example .env.local
# Fill in your API keys — see .env.example for descriptions

# Database
npx drizzle-kit push

# Run
npm run dev
```

---

## Project Structure

| Path | Purpose |
|------|---------|
| `app/cockpit/` | AI Business OS modules (new in v0.1) |
| `app/center/` | Legacy kiosk (WhatsApp/iMessage/SMS/Email/Phone) |
| `app/api/` | All 105+ API routes (server-side) |
| `components/cockpit/` | Cockpit-specific UI components |
| `components/ui/shared.tsx` | Shared UI component library |
| `lib/data/seed.ts` | Centralized seed/demo data |
| `lib/adapters/` | Integration adapters (Timelines, BlueBubbles, etc.) |
| `lib/store/` | Zustand state management |
| `db/schema.ts` | Drizzle ORM database schema |

---

## Code Conventions

### TypeScript
- All new files must be TypeScript (`.ts` / `.tsx`)
- Use strict types — avoid `any` where possible
- Interfaces over type aliases for object shapes

### Components
- All client components start with `'use client'`
- Use the shared UI library (`@/components/ui/shared`) for consistency
- Modals go in `components/cockpit/modals/`
- Panels go in `components/cockpit/panels/`

### Styling
- The cockpit uses CSS-in-JS with the navy+gold brand palette
- Brand colors: `#040e22` (dark navy), `#0a1628` (card bg), `#FFCC33` (gold accent)
- Legacy kiosk uses Tailwind CSS
- Never use browser `alert()` — use `useToast()` from `@/lib/contexts/ToastContext`

### API Routes
- All routes in `app/api/` use Next.js Route Handlers
- Use `NextResponse.json()` for responses
- Multi-tenant headers: check `X-Active-Identity` where applicable

### State Management
- **Server state**: `@tanstack/react-query` (React Query)
- **Client state**: `zustand` (via `@/lib/store/useStore`)
- **UI feedback**: `useToast()` from `@/lib/contexts/ToastContext`

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production — deployed to Vercel |
| `feature/*` | New features (branch from main) |
| `fix/*` | Bug fixes |
| `docs/*` | Documentation updates |

### Workflow

1. Create a branch: `git checkout -b feature/your-feature`
2. Make changes
3. Test locally: `npm run build` (must pass)
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request to `main`

---

## Building & Testing

```bash
# Lint
npm run lint

# Production build (must pass before merging)
npm run build

# Push database changes
npx drizzle-kit push
```

---

## Key Files to Know

| File | What It Does |
|------|-------------|
| `components/cockpit/CockpitShell.tsx` | Main layout — sidebar, topbar, command palette |
| `components/ui/shared.tsx` | 15+ shared UI components used everywhere |
| `lib/data/seed.ts` | All seed/demo data for cockpit modules |
| `lib/contexts/ToastContext.tsx` | Toast notification system |
| `lib/store/useStore.ts` | Global Zustand store |
| `db/schema.ts` | Complete database schema (Drizzle ORM) |
| `middleware.ts` | Auth and routing middleware |

---

## Questions?

Contact **Kazi** at kazi@reprime.com or open an issue on GitHub.
