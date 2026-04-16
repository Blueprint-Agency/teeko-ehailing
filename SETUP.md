# Teeko Driver Portal — Setup

## Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9 (`npm install -g pnpm`)

## Install & Run

```bash
# From repo root
pnpm install

# Start dev server
pnpm dev
# → http://localhost:3000
```

## Monorepo Structure

```
teeko-ehailing/
  apps/web/          ← Next.js 15 Driver Portal (this app)
  packages/shared/   ← Shared types, Zod schemas, locale JSON
  docs/              ← PRD and tech stack documents
```

## Dev Mode Toggle

The landing page (`/`) has a **Dev Mode** panel (bottom-right corner):
- **New Driver** — unauthenticated user, walks through full registration flow
- **Returning** — simulates a logged-in driver with submitted documents, goes directly to `/dashboard`

## Routes

| Path | Screen |
|------|--------|
| `/` | Landing page |
| `/auth/login` | Phone login |
| `/auth/verify` | OTP (any 6 digits in v0.1) |
| `/auth/register` | Account creation |
| `/onboarding/agreement` | Driver T&C |
| `/onboarding/personal-docs` | Personal document upload |
| `/onboarding/vehicle-details` | Vehicle form |
| `/onboarding/vehicle-docs` | Vehicle document upload |
| `/onboarding/confirmation` | Success + app download |
| `/dashboard` | Application status tracker |
| `/dashboard/resubmit/:docId` | Document resubmission |
| `/profile` | Account settings |

## Notes
- v0.1 is frontend-only — no backend, no real auth, no file uploads to cloud
- All state is mock data in `apps/web/data/` loaded into Zustand stores
- Onboarding progress persists to `localStorage` (driver can resume after closing browser)
- OTP: any 6-digit code is accepted in v0.1
