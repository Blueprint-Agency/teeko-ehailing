.PHONY: dev install vercel-link vercel-deploy vercel-deploy-prod vercel-env vercel-logs

# --- Docs Dev Server ---
install:
	cd docs && npm install

dev:
	cd docs && npm run dev

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
