# Teeko Backend

Modular monolith for the Teeko e-hailing platform — Fastify + Drizzle + PostgreSQL/PostGIS.
Schema and architecture are documented in [`docs/public/backend.html`](../../docs/public/backend.html).

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | ≥ 20 | matches root `engines` |
| **pnpm** | ≥ 9 | this repo is a pnpm workspace |
| **Docker Desktop** | latest | provides Postgres + PostGIS |
| **make** | any | GnuWin32 on Windows works |

The backend is registered as the `@teeko/backend` workspace and is auto-discovered
by the root `pnpm-workspace.yaml`.

---

## Quickstart

```bash
cd apps/backend
make init      # install deps, start postgres, enable PostGIS, run migrations
make dev       # tsx watch src/server.ts
```

Server boots at **http://localhost:3000**. Hit `/` for an index payload, `/healthz` for liveness.

---

## Make targets

```text
make help        list all targets
make install     pnpm install (root workspace)
make init        full bootstrap: install → up → wait-pg → postgis → migrate
make up          docker compose up -d postgres
make wait-pg     block until postgres accepts TCP queries (handles PostGIS double-start)
make postgis     CREATE EXTENSION IF NOT EXISTS postgis
make migrate     drizzle-kit migrate (apply files in drizzle/)
make generate    drizzle-kit generate (after editing src/db/schema/*.ts)
                 also runs scripts/fix-geography.ts to unquote PostGIS types
make push        drizzle-kit push (sync schema directly — dev only, may prompt)
make dev         tsx watch src/server.ts
make worker      tsx watch src/worker.ts (BullMQ stub)
make studio      open Drizzle Studio at https://local.drizzle.studio
make psql        open psql against the running postgres
make logs        tail postgres container logs
make reset       docker compose down -v (delete container AND data volume)
make build       tsc → dist/
```

---

## Day-to-day workflow

### First time / after pulling new schema changes

```bash
make init
```

Idempotent — re-running on an already-initialised DB just re-applies any new migrations.

### Run the API

```bash
make dev
```

`tsx watch` hot-reloads on file changes. Logs are pretty-printed via `pino-pretty`.

### Browse / edit data

In a **separate terminal**:

```bash
make studio
```

Drizzle Studio runs in the foreground at https://local.drizzle.studio — `Ctrl+C` to stop.

### Edit schema

1. Edit any file under `src/db/schema/*.ts`.
2. `make generate` — produces a new SQL migration in `drizzle/` (and unquotes geography types).
3. `make migrate` — applies it.

Don't hand-edit migration files unless you know what you're doing.

### Wipe and start fresh

```bash
make reset      # deletes container + volume — all data gone
make init       # rebuild from scratch
```

### Production build

```bash
make build      # tsc → dist/
node dist/server.js
```

Or use the Dockerfile: `docker build -t teeko-backend .`

---

## Configuration

Copy `.env.example` to `.env` and edit. Defaults that work out of the box:

```ini
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://teeko:teeko@localhost:5500/teeko
LOG_LEVEL=debug
```

Postgres listens on host port **5500** (mapped from container 5432) so it doesn't
clash with any local Postgres install on the default 5432.

---

## Auth in v0.1

Auth0 JWT verification is stubbed (see `src/http/middleware/auth.ts`). For local
testing, send the user via headers:

```bash
curl -H "x-teeko-user: 00000000-0000-0000-0000-000000000001" \
     -H "x-teeko-role: rider" \
     http://localhost:3000/api/v1/rider/__stub/profile
```

Roles: `rider` · `driver` · `admin_super` · `admin_ops` · `admin_finance`.
Public routes (`/api/public/*`, `/healthz`, `/`) need no auth.

---

## Clerk (Phase 1 rider auth)

Rider auth uses Clerk. Required env vars (see `src/config/env.ts`):

- `CLERK_SECRET_KEY` — backend secret key from Clerk dashboard
- `CLERK_WEBHOOK_SIGNING_SECRET` — Svix signing secret for the `/api/webhooks/clerk` endpoint
- `CLERK_PUBLISHABLE_KEY` (optional) — only needed if you want the SDK to embed it

### Local webhook reachability

Clerk delivers webhooks over the public internet. For local dev, expose the
backend with ngrok (or cloudflared) and register the URL in the Clerk
dashboard under Webhooks → Add endpoint:

```bash
ngrok http 5000
# then in Clerk dashboard: <ngrok-url>/api/webhooks/clerk
# subscribe to: user.updated, user.deleted
```

Test the JIT path with a Clerk session JWT:

```bash
curl -i -H "Authorization: Bearer $CLERK_JWT" \
  http://localhost:5000/api/v1/rider/auth/me
```

`user.created` events from Clerk are intentionally a no-op on this endpoint —
JIT provisioning (in `src/modules/identity/service.ts:getOrProvisionRiderMe`)
creates the row on the first authenticated `/me` call.

---

## Project layout

```
apps/backend/
├── Makefile             # all dev workflow lives here
├── docker-compose.yml   # postgis/postgis:16-3.4-alpine on :5500
├── drizzle.config.ts    # drizzle-kit config
├── drizzle/             # generated SQL migrations
├── scripts/
│   └── fix-geography.ts # post-process geography types after generate
└── src/
    ├── server.ts        # API process bootstrap
    ├── worker.ts        # BullMQ worker bootstrap (stub)
    ├── app.ts           # Fastify mount + middleware
    ├── config/          # env · db · logger · auth0
    ├── db/schema/       # 11 schema files — 62 tables
    ├── api/             # routes by audience: rider / driver / driver-web / admin / webhooks / public / ws
    ├── modules/         # 18 bounded contexts (single source of truth per domain)
    ├── http/middleware/ # auth · requireRole · errorHandler · rateLimit · idempotencyKey
    ├── jobs/            # BullMQ worker stubs
    ├── events/          # in-process event bus
    ├── shared/          # errors · ids · time (Asia/KL) · money (cents) · geo (WKT)
    └── external/        # auth0 · googleMaps · stripe · tng · grabpay · fcm · gcs (stubs)
```

---

## Troubleshooting

**`make init` fails with `cannot find //./pipe/dockerDesktopLinuxEngine`**
Docker Desktop isn't running. Start it from the system tray, wait for "Running",
then re-run `make init`.

**`the database system is starting up` during migrate**
The `wait-pg` target should prevent this, but if it slips through (very slow
machine, busy CPU), wait a few seconds and run `make migrate` directly.

**`Method 'GET' already declared for route ...`**
Two route files in the same audience are using the same path. Each stub uses
`/__stub/<file-basename>` — if you replace a stub with a real handler, give it
a real path that doesn't collide with siblings.

**Drizzle generate prompts `create table` vs `rename`**
PostGIS adds `spatial_ref_sys` and `tiger`/`topology` schemas. The
`schemaFilter`/`tablesFilter` in `drizzle.config.ts` should hide these from
drizzle-kit. If you see this, confirm your config matches what's checked in.

**Port 3000 already in use**
Another process owns it (often a previous `make dev` that didn't clean up).
Find and kill it, or change `PORT` in `.env`.

**Port 5500 already in use**
Same idea — another Postgres instance (Teeko's or otherwise) is on 5500. Change
the port mapping in `docker-compose.yml` and update `DATABASE_URL` in `.env`.
