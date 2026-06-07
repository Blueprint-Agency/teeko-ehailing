# Teeko

Teeko is a lower-cost e-hailing app built for Malaysia, designed to compete with Grab, Bolt, and inDriver by offering affordable rides with full regulatory compliance.

## What is Teeko?

Teeko connects riders with drivers through a mobile app that prioritises affordability, safety, and compliance with Malaysian transport regulations (APAD/JPJ Land Public Transport Act 2010, PDPA 2010).

### Key Features

- **Ride booking** — real-time matching of riders and drivers, live tracking
- **Multiple payment options** — Stripe, Touch 'n Go eWallet, GrabPay
- **Driver management** — onboarding, verification, and earnings tracking
- **Admin tooling** — driver approval, trip monitoring, surge control
- **Regulatory compliance** — built to support APAD/JPJ e-hailing operator licence requirements (per-trip passenger accident insurance, PDPA)

## Monorepo Structure

This is a [pnpm](https://pnpm.io) workspace. Five apps under `apps/`, six shared packages under `packages/`, plus the docs reader.

```
apps/
  rider/      @teeko/rider     — passenger app (Expo / React Native)
  driver/     @teeko/driver    — driver app (Expo / React Native)
  web/        @teeko/web       — marketing / rider web (Next.js 15)
  admin/      @teeko/admin     — admin panel (Next.js 15)
  backend/    @teeko/backend   — API + workers (Fastify 5, Drizzle, Socket.IO)
packages/
  shared/     @teeko/shared    — cross-app TypeScript types & zod schemas
  api/        @teeko/api        ui/  @teeko/ui        maps/   @teeko/maps
  i18n/       @teeko/i18n       config/ @teeko/config
docs/                          — Next.js app (Vercel) that renders the markdown specs
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile (rider & driver) | Expo / React Native 0.81 — Expo Router, NativeWind, Zustand, react-native-maps |
| Web & admin | Next.js 15 (React) |
| Backend | Fastify 5, Drizzle ORM, Socket.IO, Zod |
| Database | PostgreSQL + PostGIS, Redis |
| Auth | Clerk (rider & driver); Auth0 placeholder for v1.0 |
| Payments | Stripe, Touch 'n Go eWallet, GrabPay |
| Maps | Google Maps |
| File storage | Cloudflare R2 |
| Tooling | pnpm workspace, TypeScript |
| Deployment | Backend: Docker image → VPS via GitHub Actions (Traefik). Docs: Vercel |

> Phased build: **v0.1** is the current mockup/MVP phase. The production cloud target
> (GCP `asia-southeast1`) is documented in the specs but not yet provisioned.

## Getting Started

**Prerequisites:** Node.js ≥ 20, pnpm ≥ 9, Docker Desktop (runs Postgres + Redis locally).

```bash
pnpm install            # or: make install — installs all workspace projects in one pass

# Backend (Postgres + Redis run as local Docker containers)
cd apps/backend
make init               # start postgres + redis containers, enable PostGIS, run migrations
make dev                # tsx watch src/server.ts  ->  http://localhost:3000
```

`make init`, `make reset`, and `make studio` also work from the repo root. Per-app dev
servers: `make dev-rider`, `make dev-driver`, `make dev-web`, `make dev-admin`,
`make dev-backend`. See [`apps/backend/README.md`](apps/backend/README.md) for the full
backend workflow (database, migrations, Redis, troubleshooting).

## Documentation

Product and technical specs are markdown under [`docs/v0.1/`](docs/v0.1/), rendered by the
Next.js reader in `docs/` (deployed to Vercel):

- [`docs/v0.1/prd/`](docs/v0.1/prd/) — product requirements (core, rider, driver, driver-web, admin)
- [`docs/v0.1/tech/`](docs/v0.1/tech/) — tech stack & frontend architecture
- [`docs/v0.1/claude-code/`](docs/v0.1/claude-code/) — Claude Code build workflow

## License

Proprietary. All rights reserved.
</content>
