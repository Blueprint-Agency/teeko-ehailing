SHELL := /bin/bash

PG_CONTAINER := teeko-postgres
PG_USER      := teeko
PG_DB        := teeko
PG_PORT      := 5500
COMPOSE      := docker compose

.PHONY: help init reset dev worker logs psql migrate generate push studio install postgis wait-pg up

help:
	@echo "Teeko backend — make targets"
	@echo "  init      — start postgres, enable PostGIS, push schema"
	@echo "  reset     — stop postgres + delete its volume"
	@echo "  dev       — run the API server (tsx watch)"
	@echo "  worker    — run the BullMQ worker (tsx watch)"
	@echo "  logs      — tail postgres logs"
	@echo "  psql      — open psql against the running postgres"
	@echo "  migrate   — drizzle-kit migrate (apply migrations/)"
	@echo "  generate  — drizzle-kit generate (create new migration from schema)"
	@echo "  push      — drizzle-kit push (sync schema directly, dev only)"
	@echo "  studio    — open drizzle studio (http://localhost:4983)"

install:
	pnpm install

# Bring up postgres, wait for it, enable PostGIS, then push the current Drizzle schema.
# Uses prerequisites instead of recursive $(MAKE) so it works under GnuWin32 make
# whose path contains parentheses (C:/Program Files (x86)/...).
init: install up wait-pg postgis migrate
	@echo ""
	@echo "Postgres up on localhost:$(PG_PORT)  -  migrations applied."
	@echo "  next: make dev"

up:
	$(COMPOSE) up -d postgres

# Wait until postgres is fully ready for client connections.
# The PostGIS image starts Postgres twice (init phase on Unix socket only,
# then the real start that opens TCP). We must wait for the SECOND start by
# probing TCP (-h 127.0.0.1) — connections during init fail at the TCP layer.
wait-pg:
	@echo "waiting for postgres on $(PG_PORT)..."
	@for i in $$(seq 1 90); do \
	  if docker exec -u postgres $(PG_CONTAINER) psql -h 127.0.0.1 -U $(PG_USER) -d $(PG_DB) -c "SELECT 1" >/dev/null 2>&1; then \
	    echo "  ready."; exit 0; \
	  fi; \
	  sleep 1; \
	done; \
	echo "  postgres did not become ready in 90s"; exit 1

# CREATE EXTENSION postgis (idempotent).
postgis:
	@docker exec -u postgres $(PG_CONTAINER) psql -U $(PG_USER) -d $(PG_DB) -c "CREATE EXTENSION IF NOT EXISTS postgis;" >/dev/null
	@echo "  postgis: ready."

# Stop postgres AND remove its data volume — full clean slate.
reset:
	-$(COMPOSE) down -v
	@echo "✓ container removed and volume deleted."

dev:
	pnpm dev

worker:
	pnpm dev:worker

logs:
	$(COMPOSE) logs -f postgres

psql:
	docker exec -it $(PG_CONTAINER) psql -U $(PG_USER) -d $(PG_DB)

migrate:
	pnpm db:migrate

generate:
	pnpm db:generate

push:
	pnpm db:push

studio:
	pnpm db:studio
