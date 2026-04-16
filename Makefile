.PHONY: dev dev-docs dev-web install install-docs install-web \
	vercel-link vercel-deploy vercel-deploy-prod vercel-env vercel-logs \
	vercel-web-link vercel-web-deploy vercel-web-deploy-prod vercel-web-env vercel-web-logs vercel-web-status

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

# --- Vercel Docs (project linked in docs/; Root Directory = docs on Vercel) ---
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

# --- Vercel Web (project linked in apps/web/; Root Directory = apps/web on Vercel) ---
vercel-web-link:
	cd apps/web && vercel link

vercel-web-deploy:
	cd apps/web && vercel deploy

vercel-web-deploy-prod:
	cd apps/web && vercel deploy --prod

vercel-web-env:
	cd apps/web && vercel env ls

vercel-web-logs:
	cd apps/web && vercel logs

vercel-web-status:
	cd apps/web && vercel ls
