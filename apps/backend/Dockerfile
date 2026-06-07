# syntax=docker/dockerfile:1
#
# IMPORTANT: the build context is the REPO ROOT, not apps/backend
# (see .github/workflows/deploy-backend.yml -> context: . , file: apps/backend/Dockerfile).
# @teeko/backend depends on the workspace package @teeko/shared ("workspace:*"),
# which only resolves with the root pnpm-workspace.yaml + pnpm-lock.yaml + packages/shared.
# A standalone apps/backend context cannot resolve it (pnpm aborts on the unresolved
# workspace dependency).

FROM node:22-alpine AS base
WORKDIR /app
# Match the repo's package manager (root packageManager + lockfileVersion 9.0).
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# --- deps: install the backend's closure, cached on manifests + lockfile only ---
FROM base AS deps
# Root workspace files first, then EVERY package manifest so --frozen-lockfile can
# validate the whole workspace graph. --filter limits what is actually installed to
# @teeko/backend and its dependencies (@teeko/shared), not the Expo/Next apps.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
# pnpm.patchedDependencies (root package.json) references patches/*.patch — pnpm hashes
# these on every install, even when filtered, so they must be present.
COPY patches ./patches
COPY apps/admin/package.json   ./apps/admin/
COPY apps/backend/package.json ./apps/backend/
COPY apps/driver/package.json  ./apps/driver/
COPY apps/rider/package.json   ./apps/rider/
COPY apps/web/package.json     ./apps/web/
COPY docs/package.json         ./docs/
COPY packages/api/package.json    ./packages/api/
COPY packages/config/package.json ./packages/config/
COPY packages/i18n/package.json   ./packages/i18n/
COPY packages/maps/package.json   ./packages/maps/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json     ./packages/ui/
# Full deps (incl. dev: tsx + drizzle-kit) — needed at runtime for tsx and the db:* scripts.
RUN pnpm install --frozen-lockfile --filter @teeko/backend...

# --- build: typecheck gate (runtime runs from source via tsx; dist is not used) ---
FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend
RUN pnpm --filter @teeko/backend build

# --- runtime ---
FROM base AS runtime
ENV NODE_ENV=production
# Installed workspace (node_modules incl. tsx + drizzle-kit, with pnpm symlinks) + sources.
COPY --from=build /app /app
WORKDIR /app/apps/backend
EXPOSE 3000
# tsx runs the TS source directly (avoids ERR_MODULE_NOT_FOUND from tsc-emitted ESM
# imports without .js extensions). The deploy runs db:postgis/migrate/seed from this WORKDIR.
CMD ["pnpm", "exec", "tsx", "src/server.ts"]
