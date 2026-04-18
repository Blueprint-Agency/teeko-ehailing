.PHONY: install build dev-docs dev-web dev-rider dev-driver

# --- Install ---
install:
	pnpm install
	cd docs && npm install

# --- Build ---
build:
	pnpm -r build
	cd docs && npm run build

# --- Dev Servers ---
dev-docs:
	cd docs && npm run dev

dev-web:
	pnpm --filter @teeko/web dev

dev-rider:
	pnpm --filter @teeko/rider dev

dev-driver:
	pnpm --filter @teeko/driver dev
