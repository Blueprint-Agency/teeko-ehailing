.PHONY: dev dev-docs dev-web install install-docs install-web vercel-link vercel-deploy vercel-deploy-prod vercel-env vercel-logs

# --- Install ---
install: install-docs install-web

install-docs:
	cd docs && npm install

install-web:
	cd apps/web && npm install

# --- Dev Servers ---
dev-docs:
	cd docs && npm run dev

dev-web:
	cd apps/web && npm run dev

dev:
	make dev-docs & make dev-web

# --- Vercel (project linked in docs/; Root Directory = docs on Vercel) ---
vercel-link:
	cd docs && vercel link

vercel-deploy:
	cd docs && vercel deploy

vercel-deploy-prod:
	cd docs && vercel deploy --prod

vercel-env:
	cd docs && vercel env ls

vercel-logs:
	cd docs && vercel logs

vercel-status:
	cd docs && vercel ls
