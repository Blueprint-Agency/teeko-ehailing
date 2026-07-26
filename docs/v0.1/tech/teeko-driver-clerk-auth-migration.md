---
title: Driver Auth Migration — Clerk as Identity Provider
status: implemented
date: 2026-07-25
---

# Driver Auth Migration — Clerk as Identity Provider

## 1. Goal

Move driver authentication off our own email + password store and onto **Clerk**, so that:

- Registration happens in the **driver web portal** (`apps/web`), and the credential lives in Clerk.
- **Login works in both** the web portal (`apps/web`) and the Expo driver app (`apps/driver`) against the same Clerk identity.
- Driver activation stays **admin-approved** — exactly as today. Clerk authenticates; it never authorises driving.

## 2. Decisions

| Decision | Choice |
|---|---|
| Clerk instance | Reuse the **existing driver instance** (`CLERK_DRIVER_*`). `apps/web` gets a `ClerkProvider` on the same keys the Expo app already uses. |
| Sign-in methods | **Email + password** only (Clerk-managed), plus **our existing email OTP** verification step (`otp_codes`, `modules/auth_otp`). No Google/phone for driver in this change. |
| Approval gate | Login is **always allowed**. Access is gated by `driver_applications.state` — onboarding wizard, then a pending/in-review screen until an admin activates. |
| Existing accounts | **Migrate** current driver `users` rows into Clerk, link via `external_identities`, then **delete** the legacy password login. |

## 3. Target flow

### Register (web only)

1. `apps/web/app/auth/register` renders Clerk sign-up (email, password) plus our own `fullName` + **PDPA consent** checkbox (consent must stay ours — it is a PDPA 2010 record, not a Clerk field).
2. Clerk creates the user; the browser receives a Clerk session.
3. Web calls `GET /api/v1/driver-web/auth/me` with the Clerk bearer token.
4. Backend **JIT-provisions** on first call: `users` + `user_roles(driver)` + `external_identities(clerk, sub)` + `driver_profiles(approval_status='pending')` + `driver_applications(state='phone_entered')`, one transaction.
5. Email OTP is auto-sent (same trigger as the rider path) unless Clerk already reports the email verified.
6. Redirect to `/onboarding/agreement`.

### Login (web **and** Expo)

Either app authenticates with Clerk, then calls `GET /auth/me`. The route is idempotent — the app that gets there first provisions; the other reads. Routing after login is driven by `driver_applications.state`:

- `phone_entered … vehicle_docs_submitted` → onboarding wizard (web) / onboarding stubs (Expo)
- `in_review` → pending screen
- `rejected` → resubmission screen
- `activated` → dashboard / trip features

### Approval (unchanged)

`apps/backend/src/api/admin/drivers.routes.ts` — per-document review → `evp_records` → `POST /evp/:recordId/open-account` sets `driver_applications.state='activated'`. **Add:** the same handler must also set `driver_profiles.approval_status='approved'` so the two approval sources cannot diverge.

## 4. Backend changes

| File | Change |
|---|---|
| `src/api/driver-web/index.ts:20` | `auth0Verify` → **`driverClerkAuthVerify`**. Today driver-web verifies tokens against the **rider** Clerk instance; web-issued driver tokens would fail. |
| `src/api/driver-web/auth.routes.ts` | Delete `POST /login` and `POST /register`. Replace with `GET /auth/me` (JIT provision, mirrors `api/driver/auth.routes.ts`) and move it inside the authed group. |
| `src/http/middleware/auth.ts:75` | Add the dev-header bypass (`X-Teeko-User` / `DEV_AUTH_BYPASS`) to `driverClerkAuthVerify`, which currently lacks it — otherwise local/staging dev auth breaks. |
| `src/modules/identity/repo.ts:99-123` | `provisionDriver`: `approvalStatus` `'approved'` → **`'pending'`** (current value silently pre-approves every driver), and insert the `driver_applications` row (`state:'phone_entered'`) that web register used to create. |
| `src/modules/identity/service.ts:157` | `getOrProvisionDriverMe`: return `applicationState` alongside `approvalStatus` so both clients can route off one call. |
| `src/modules/auth_otp/service.ts:4,122` | Uses the **rider** `clerk` client. Accept a client parameter so driver OTP verification resolves against `driverClerk`. |
| `src/lib/password.ts`, `users.password_hash` | Password helper deleted after migration. Keep the column nullable for one release, then drop in a follow-up migration. |

## 5. Web changes (`apps/web`)

- Add `@clerk/nextjs`; wrap the app in `ClerkProvider` with the **driver** publishable key.
- `middleware.ts` — **deleted.** `clerkMiddleware()` requires `CLERK_SECRET_KEY`, and the secret key belongs to the backend only; the web app must never hold it. Route protection is client-side instead (see §7).
- `stores/authStore.ts` — drop persisted credentials; Clerk owns the session. Keep only derived profile/application state.
- `lib/api.ts:6-11` — replace `X-Teeko-User` / `X-Teeko-Role` dev headers with `Authorization: Bearer <Clerk token>` via `getToken()`; keep the dev headers behind a flag for local work.
- Delete the dead OTP mock routes under `apps/web/app/api/v1/driver-web/auth/**`.

## 6. Expo changes (`apps/driver`)

Minimal — it already uses Clerk (`useSignIn` in `app/(auth)/login.tsx`) on the same instance. Only change: route off `applicationState` from `/auth/me` instead of assuming approval, so a driver who registered on web lands on the correct onboarding/pending screen.

## 7. What was built (deltas from the plan above)

- **PDPA consent** is stored in a new `users.pdpa_consent_at` column (migration `0017_driver_clerk_auth`, journal `when` hand-bumped to `1786000000000` to clear staging's `1785900000000` ceiling — see the Drizzle journal pitfall). Recorded via `POST /auth/consent`, first consent wins.
- The same migration creates a **partial unique index on `lower(email)`** — but only if no duplicate groups exist; otherwise it raises a `NOTICE` naming the count rather than failing the deploy.
- **No migration script** for existing password-based drivers (per decision). `users.password_hash` is left in place but nothing reads it any more, so those accounts cannot log in until they are re-created through Clerk.
- **Expo registration now deep-links to the web portal** (`register-choice.tsx` → `EXPO_PUBLIC_DRIVER_PORTAL_URL/auth/register`). The in-app sign-up screens captured no PDPA consent, so leaving them reachable would have created accounts with no consent record. `app/(auth)/register.tsx` is left in the tree but unreferenced.
- **Clerk's own email verification is handled inline.** The driver instance requires the email address to be verified before sign-up completes, so `signUp.create` returns `missing_requirements` rather than `complete`. The register page runs `prepareEmailAddressVerification({ strategy: 'email_code' })` and shows a code field; login does the same for `needs_second_factor` / `needs_client_trust` via `prepareSecondFactor`. Both work either way — if the instance stops requiring verification, `status === 'complete'` and the step is skipped.
  - Consequence: our own email OTP self-skips for these signups. JIT provisioning only fires it when Clerk reports the address unverified, and by then Clerk has verified it — so `users.email_verified` is seeded `true` and no second code is sent. The OTP path remains for identities Clerk does not verify.
  - Nothing is written to our DB until verification succeeds; `GET /auth/me` is only called after `setActive`.
- **No secret key in the web app.** `apps/web` holds only `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; `CLERK_SECRET_KEY` stays backend-only (`CLERK_DRIVER_SECRET_KEY`). Two layers replace `clerkMiddleware`:
  1. **`middleware.ts` — networkless JWT verification.** Derives the Frontend API host by base64-decoding the publishable key (so the JWKS host can never drift from the key the browser signs in against; override with `NEXT_PUBLIC_CLERK_FRONTEND_API`), then verifies the `__session` cookie against the instance's public JWKS with `jose`. No secret, no round-trip to our own API.
     - **Expired ≠ rejected.** `jose` checks the signature before the claims, so `JWTExpired` proves the token is genuinely ours and merely stale. Clerk session tokens live ~60s and are refreshed by the client SDK, so an expired cookie is the *normal* state on a cold navigation after idle — redirecting there would log drivers out constantly. Expired falls through to the client guard; only a bad signature / wrong issuer / missing cookie redirects.
     - Fails **open** on missing or malformed publishable key (logs a warning) so a config slip cannot lock every driver out. Safe because this layer is defence in depth, never the enforcement point.
  2. **`components/RequireAuth.tsx`** — client guard applied via `app/{onboarding,dashboard,profile}/layout.tsx`, which refreshes the session and redirects if it really is gone. Needed regardless: `/dashboard` and `/profile` previously had no auth check of their own.
  - The real enforcement point remains the backend: every read carries a bearer token that `driverClerkAuthVerify` validates independently of anything the browser claims.
- **Run `pnpm db:migrate` before testing sign-up.** `GET /auth/me` selects `users.pdpa_consent_at`, so an unapplied `0017` makes sign-up appear to hang after the OTP step: Clerk completes, `setActive` succeeds, then provisioning 500s. Retrying then fails with Clerk's `session_exists` ("You've signed in"), because the credential already exists.
- **Sign-up is resumable.** `provisionAndEnter()` is split out of `finishSignUp()`, so a driver whose Clerk sign-up succeeded but whose provisioning failed is offered a "Continue" button instead of a form Clerk would reject. `session_exists` is also caught and resumed. `clerkError()` falls back to a plain `Error.message`, so backend failures surface verbatim rather than as a generic string.
- **Routing helpers**: `apps/web/lib/routeForApplicationState.ts` and `apps/driver/lib/routeAfterAuth.ts`.
- **Token plumbing**: `apps/web/components/ClerkTokenBridge.tsx` registers Clerk's `getToken` into `lib/api` and rehydrates the (now unpersisted) auth store on refresh.

## 8. Migration of existing drivers

**Not implemented** — deliberately skipped. If it is ever needed, the shape would be a one-off script (`apps/backend/scripts/`):

1. Select `users` joined to `user_roles(driver)` where `password_hash IS NOT NULL` and no `external_identities` row.
2. Create each in Clerk (driver instance) via the admin API with the existing email; Clerk cannot import scrypt hashes, so users get a **password-reset invite** rather than a silent transfer.
3. Insert `external_identities(provider='clerk', provider_sub=<clerk id>)`.
4. Report any email Clerk rejects as duplicate — `users.email` has **no unique constraint** today, so duplicates may exist and must be resolved by hand.

## 9. Risks / open points

- **Two Clerk instances remain** (rider + driver). Unifying them is deliberately out of scope here.
- **Locally they are in fact the same instance.** As of 2026-07-26 `CLERK_RIDER_PUBLISHABLE_KEY` and `CLERK_DRIVER_PUBLISHABLE_KEY` in `apps/backend/.env` both resolve to `touching-yeti-11.clerk.accounts.dev`, as does `apps/web` and `apps/driver`. So rider and driver tokens are mutually verifiable in local dev, and the rider-vs-driver verifier distinction is currently untested there. The `driverClerkAuthVerify` switch still matters for staging/prod, where the keys are expected to differ (`apps/driver/.env` carries a separate commented-out staging key). Do not rely on local behaviour to prove instance isolation.
- `users.email` lacks a unique index; add one during migration to stop the race in the old register path from recurring.
- OTP-vs-Clerk verification: `users.email_verified` stays our source of truth (as documented in `auth_otp/service.ts:118`).
- Clerk publishable key for the driver instance must be exposed to `apps/web` as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Secret keys stay backend-only — do not reintroduce `CLERK_SECRET_KEY` to `apps/web`, and note that adding any Clerk server-side helper (`auth()`, `currentUser()`, `clerkClient`) or restoring `clerkMiddleware` would demand it.
