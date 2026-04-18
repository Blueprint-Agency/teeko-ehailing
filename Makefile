.PHONY: install build build-docs build-web build-rider build-driver dev-docs dev-web dev-rider dev-driver

# --- Install ---
install:
	pnpm install

# --- Build ---
build:
	pnpm -r build

build-docs:
	pnpm --filter @teeko/docs build

build-web:
	pnpm --filter @teeko/web build

build-rider:
	pnpm --filter @teeko/rider build

build-driver:
	pnpm --filter @teeko/driver build

# --- Dev Servers ---
dev-docs:
	pnpm --filter @teeko/docs dev

dev-web:
	pnpm --filter @teeko/web dev

dev-rider:
	pnpm --filter @teeko/rider dev

dev-driver:
	pnpm --filter @teeko/driver dev
