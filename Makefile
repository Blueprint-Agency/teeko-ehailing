.PHONY: install build init reset studio \
	install-admin install-backend install-driver install-rider install-web \
	build-admin build-backend build-driver build-rider build-web build-docs \
	dev-docs dev-web dev-rider dev-driver dev-admin dev-backend

# The 5 projects live under apps/: admin, backend, driver, rider, web.
# (docs/ is the separate Vercel reader site — built via `make build-docs`.)

# --- Install ---
# pnpm is a single workspace: one `pnpm install` resolves and installs deps
# for ALL projects (admin, backend, driver, rider, web) + shared packages in
# one pass. The per-project install-* targets are provided for convenience.
install:
	pnpm install

install-admin:
	pnpm --filter @teeko/admin install

install-backend:
	pnpm --filter @teeko/backend install

install-driver:
	pnpm --filter @teeko/driver install

install-rider:
	pnpm --filter @teeko/rider install

install-web:
	pnpm --filter @teeko/web install

# --- Infra (postgres + redis) ---
# Delegate the DB/Redis lifecycle to the backend stack — single source of truth
# (apps/backend/Makefile + docker-compose.yml).
#   init  — start postgres + redis containers, enable PostGIS, apply migrations
#   reset — stop both containers and delete their volumes (full clean slate)
# Uses bare `make` (NOT $(MAKE)): $(MAKE) expands to the GnuWin32 path
# "C:/Program Files (x86)/GnuWin32/bin/make.exe" whose parentheses the shell
# mis-parses. Bare `make` is resolved via PATH, which handles the parens fine.
init:
	cd apps/backend && make init

reset:
	cd apps/backend && make reset

#   studio — open drizzle studio (https://local.drizzle.studio) against the DB
studio:
	cd apps/backend && make studio

# --- Build ---
# Build all 5 projects. Uses explicit prerequisites (not `pnpm -r build`, which
# silently skips rider — it has no plain `build` script) so every project is
# guaranteed to build.
build: build-admin build-backend build-driver build-rider build-web

build-admin:
	pnpm --filter @teeko/admin build

build-backend:
	pnpm --filter @teeko/backend build

build-driver:
	pnpm --filter @teeko/driver build

# rider has no plain `build` script (only EAS build:android/ios); mirror driver
# with a local expo export so it builds without an Expo account / cloud minutes.
build-rider:
	pnpm --filter @teeko/rider exec expo export --platform android --platform ios

build-web:
	pnpm --filter @teeko/web build

build-docs:
	pnpm --filter @teeko/docs build

# --- Dev Servers ---
dev-docs:
	pnpm --filter @teeko/docs dev

dev-web:
	pnpm --filter @teeko/web dev

dev-admin:
	pnpm --filter @teeko/admin dev

dev-backend:
	pnpm --filter @teeko/backend dev

dev-rider:
	pnpm --filter @teeko/rider dev

dev-driver:
	pnpm --filter @teeko/driver dev
