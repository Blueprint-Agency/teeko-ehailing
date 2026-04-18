# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This repo contains the product requirements, technical specs, and docs web app for **Teeko**, a Malaysian e-hailing app. Source of truth for scope, UX, and architecture lives here — application code (Expo rider/driver apps) lives in sibling repos; the docs site in `docs/` renders the markdown to a Vercel-deployed reader.

## Folder Structure

```
docs/                                 — Next.js app (Vercel) that renders the markdown below
  app/, lib/, next.config.mjs …       — Docs viewer source
  v0.1/                               — ACTIVE version (mockup phase, frontend-only)
    claude-code/
      claude-code-guide.md            — Workflow for building Teeko features with Claude Code
    prd/
      teeko-prd.md                    — Core product requirements (single source of truth)
      teeko-rider-prd.md              — Rider (passenger) app flows & screens
      teeko-driver-prd.md             — Driver mobile app flows & screens
      teeko-driver-web-prd.md         — Driver web portal (onboarding / fleet ops)
      teeko-admin-prd.md              — Admin panel (web) requirements
      teeko-deferred.md               — Features deferred post-MVP
    tech/
      teeko-tech-stack.md             — Phased stack (v0.1 mockup → v1.0 production)
      teeko-frontend-architecture.md  — Monorepo layout (rider + driver Expo apps)
      teeko-driver-frontend-tech-stack.md
      teeko-driver-web-frontend-tech-stack.md
      react-native-getting-started.md
```

> The older `docs/prd/` and `docs/tech/` directories are gone — everything is under `docs/v0.1/`.

## GitHub

- Remote repo: https://github.com/Blueprint-Agency/teeko-ehailing
- GitHub token is stored in `.env` (never commit — already in `.gitignore`)

## Product Context

- **Product:** Teeko — a lower-cost e-hailing app competing with Grab, Bolt, inDriver in Malaysia
- **Target:** APAD/JPJ e-hailing operator licence application support
- **MVP timeline:** 1 month (aggressive — ruthless prioritisation)
- **Compliance:** APAD/JPJ Land Public Transport Act 2010, PDPA 2010, per-trip passenger accident insurance

## Phased Build

| Phase | Goal | Stack |
|-------|------|-------|
| **v0.1 — Mockup** (current) | Validate UX, stakeholder demos, support APAD application. Frontend only, mock data. | Expo + React Native, Expo Router, NativeWind, react-native-maps, Zustand + local JSON |
| **v1.0 — Production** | Launch live rides, payments, driver onboarding. | Node.js (Express/Fastify), Socket.io, PostgreSQL + Redis, Stripe + TNG + GrabPay + Google Pay, Clerk or Firebase Auth (phone OTP), GCS, FCM, GCP asia-southeast1, GitHub Actions |

## Frontend Architecture (v0.1)

Two separate Expo apps in a pnpm + Turborepo monorepo — **not** one app with role switching:

- `@teeko/rider` — passenger app
- `@teeko/driver` — driver app
- Shared packages: `@teeko/ui`, `@teeko/shared`, `@teeko/maps`, `@teeko/i18n`, `@teeko/api` (mock client + Zustand stores), `@teeko/config`

## MVP Scope (in)

- **Rider:** booking, ride types, advance booking, live tracking, card + e-wallet payments, SOS, trip sharing, ratings, 4-language
- **Driver:** onboarding/verification, trip acceptance, navigation, earnings dashboard
- **Admin:** driver approval, trip monitoring, surge control

## Out of Scope for MVP

Carpool, B2B corporate accounts, loyalty/rewards, Teeko Wallet top-up via FPX/ATM, advanced analytics, APAD documentation submission (system must *support* it; the filing itself is post-build).

## Working with This Repo

- When editing PRDs/tech docs, preserve existing Markdown structure (numbered sections, tables, code blocks).
- Substantive changes to scope, compliance, or the tech stack must be discussed before editing.
- Feature work should follow `docs/v0.1/claude-code/claude-code-guide.md` — spec → mockup (fresh session, `/frontend-design`) → plan → build.
- The `docs/` Next.js app is the published reader — changes to markdown auto-surface there; avoid breaking frontmatter or link structure.
