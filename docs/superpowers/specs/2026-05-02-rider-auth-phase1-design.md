# Rider Auth — Phase 1 Design

**Date:** 2026-05-02
**Status:** Approved (in brainstorming); pending implementation plan
**Owner:** chris
**Scope:** First real signup/login flow for the Teeko rider app, replacing the v0.1 mockup wiring.

---

## 1. Goal

Stand up a real, end-to-end rider authentication flow against the existing Fastify backend, using **Clerk** as the identity provider. Email + password and Google OAuth at signup. As part of this work, **delete the in-app mock layer entirely** — the rider app speaks only to the real backend from this point forward.

Phone + SMS OTP, multi-factor, and account linking are explicitly deferred to a later phase.

## 2. Decisions locked in

| Decision | Choice | Rationale |
|---|---|---|
| Auth provider | **Clerk** (`@clerk/clerk-expo`, `@clerk/backend`) | Hosted; ships email+password, Google OAuth, email verification, session management out of the box. |
| Primary channel | **Email + password + Google OAuth** | Matches existing rider screen UX. Phone-OTP deferred. |
| Mock strategy | **Big-bang remove** (`packages/api/src/mock/` deleted) | No in-code switch. Rider app speaks only HTTP to `EXPO_PUBLIC_API_URL`. Non-auth tabs broken until their backend ships. |
| User-row creation | **JIT on first `/me` call** | Survives webhook delays/failures. Clerk webhook is a sync mechanism for updates/deletes only. |
| Non-auth tab UX | **`<NotImplementedScreen domain="..." />`** placeholder for tabs whose backend doesn't exist yet | Cleaner demo than raw error toasts; ~30 min of work. |
| Schema | `users.phone` becomes nullable; `externalIdentities` already supports Clerk via `provider='clerk'` | Minimal migration. No `passwordHash` column — Clerk owns credentials. |
| Token storage | `expo-secure-store` on native (Clerk's standard `tokenCache`) | Standard pattern from Clerk Expo docs. |

## 3. In scope

- Clerk integration in the rider Expo app (provider, hooks-based screens, OAuth, secure-store).
- Backend Clerk JWT verification middleware.
- Backend `GET /api/v1/rider/auth/me` and `PATCH /api/v1/rider/auth/me`.
- Backend `POST /api/webhooks/clerk` (Svix-verified) for `user.updated`, `user.deleted`.
- Drizzle migration: `users.phone` → nullable.
- Frontend `packages/api/src/client/` — thin `fetch` wrappers for `auth/places/payments/trips`, all reading `EXPO_PUBLIC_API_URL` and injecting Clerk session token.
- Deletion of `packages/api/src/mock/` and the mock re-exports in `packages/api/src/index.ts`.
- Rewrite of `(auth)/login.tsx`, `(auth)/signup.tsx`, `(auth)/verify-email.tsx`.
- `<NotImplementedScreen>` placeholder rendered by Home, Rides, Account, search, payments, trip-flow screens (everything that previously called `placesApi`/`paymentsApi`/`tripsApi`).
- Auth-store reduced to: rider profile (from `/me`) + `languagePref`. Session/user state lives in Clerk.

## 4. Out of scope (deferred)

- Phone + SMS OTP signup/verify (will be added later for APAD compliance).
- Multi-factor auth.
- Account linking (e.g., merge a Google account into an existing email account post-signup).
- Apple Sign-In, Facebook, other OAuth providers.
- Real `places/payments/trips` backend logic — those domains stay placeholder until their own phase.
- Backend tests beyond a smoke test on `/me` (proper integration tests in their own task).
- Driver and admin auth flows — this spec is rider-only.

## 5. Backend changes (`apps/backend/`)

### 5.1 Schema (`src/db/schema/identity.ts`)

```diff
 export const users = pgTable('users', {
   id: uuid().primaryKey().defaultRandom(),
-  phone: text().notNull().unique(),
+  phone: text().unique(),
   email: text(),
   fullName: text(),
   locale: localeEnum().notNull().default('en'),
   status: userStatus().notNull().default('active'),
   createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
 });
```

`externalIdentities` is unchanged — it already keys on `(userId, provider)` with `providerSub` unique. We use `provider='clerk'`, `providerSub=<clerk_user_id>`.

### 5.2 Auth middleware (`src/http/middleware/auth.ts`)

Replace the `X-Teeko-User` header stub:

- Verify the `Authorization: Bearer <token>` JWT with `@clerk/backend`'s `verifyToken()`. **401 on missing/invalid token.**
- On verified token, **always** attach `req.clerkUserId = <sub>` and the verified claims (`email`, `firstName`, `lastName`).
- Then attempt a lookup against `externalIdentities` where `provider='clerk' AND providerSub=<sub>`. If found, also attach `req.user = { id: <our uuid>, role: 'rider', clerkUserId }`. If not found, leave `req.user` undefined — that's normal for a first-time signup whose JIT hasn't run yet.
- **Does NOT JIT-create here.** JIT is the `/me` route's job, so middleware stays read-only and other routes (which require `req.user`) can 404 cleanly if a stale call somehow lands before `/me` runs.

### 5.3 Endpoints (`src/api/rider/auth.routes.ts`)

- **`GET /api/v1/rider/auth/me`** — verifies token, then:
  1. If `req.user` resolved (row exists) → return `{ user, riderProfile }`.
  2. If token verified but no row exists → atomic upsert: `INSERT INTO users (...) RETURNING id`, then `INSERT INTO external_identities (...)` and `INSERT INTO rider_profiles (user_id) VALUES (...)`. Pull `email`, `firstName`+`lastName` from the verified Clerk JWT claims. All in one transaction.
  3. Return the full `{ user, riderProfile }` shape.
- **`PATCH /api/v1/rider/auth/me`** — body `{ fullName?: string, locale?: 'en'|'ms'|'zh'|'ta' }`. Updates the bits Clerk doesn't own. (Clerk-owned fields like email are updated through Clerk and synced via webhook.)

Auth middleware change: middleware does verification only; the `/me` route handler runs the JIT logic for itself when it sees a verified token without a matching row.

### 5.4 Webhook (`src/api/webhooks/clerk.routes.ts`, new)

- **`POST /api/webhooks/clerk`** — Svix-signed.
  - `user.updated` → `UPDATE users SET email=?, fullName=? WHERE id=(SELECT user_id FROM external_identities WHERE provider='clerk' AND provider_sub=?)`.
  - `user.deleted` → `UPDATE users SET status='deactivated' WHERE id=...` (soft delete).
  - `user.created` → no-op (JIT handles it).
- Registered under the existing `webhookRoutes` plugin (`/api/webhooks`).
- Requires `CLERK_WEBHOOK_SIGNING_SECRET` env var.

### 5.5 Env additions (`src/config/env.ts`)

```diff
+  CLERK_SECRET_KEY: z.string(),
+  CLERK_WEBHOOK_SIGNING_SECRET: z.string(),
   AUTH0_DOMAIN: z.string().optional(),       // can stay; unused this phase
   AUTH0_AUDIENCE: z.string().optional(),
   AUTH0_ISSUER: z.string().optional(),
```

### 5.6 Files removed/repurposed

- `src/external/auth0.ts`, `src/config/auth0.ts` — left in place but unused; no production touch this phase. (Cleanup task tracked separately when Auth0 is fully retired.)

## 6. Rider app changes (`apps/rider/`)

### 6.1 New dependencies

- `@clerk/clerk-expo`
- `expo-secure-store`
- `expo-auth-session` (Clerk OAuth requires it for the redirect URI)
- `expo-web-browser`

### 6.2 Provider wiring (`app/_layout.tsx`)

Wrap the existing `<SafeAreaProvider>` tree in `<ClerkProvider publishableKey={EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>`. `tokenCache` is the standard `expo-secure-store`-backed cache from Clerk's Expo docs.

The existing `useAuthStore.hydrate()` call is removed — Clerk handles session restoration. The `_layout` continues to call `useAuthStore.fetchProfile()` once Clerk reports a signed-in session, which fetches `/me` from the backend.

### 6.3 Screen rewrites (`app/(auth)/`)

- **`login.tsx`** — keep all UI. Replace the `signInWithEmail` store call with Clerk's `useSignIn()`:
  ```ts
  await signIn.create({ identifier: email, password });
  await setActive({ session: signIn.createdSessionId });
  router.back();
  ```
- **`signup.tsx`** — replace `signUpWithEmail` with Clerk `useSignUp()`:
  ```ts
  await signUp.create({ emailAddress: email, password, firstName: name });
  await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
  router.push('/(auth)/verify-email');
  ```
- **`verify-email.tsx`** — **UX change**: Clerk sends a 6-digit code, not a magic link. Replace the single "Verify" button with:
  - 6-digit OTP code input (use the `Input` component with `keyboardType='number-pad'` and `maxLength={6}`).
  - "Verify" button calls `signUp.attemptEmailAddressVerification({ code })` then `setActive({ session: signUp.createdSessionId })`.
  - Resend button calls `signUp.prepareEmailAddressVerification({ strategy: 'email_code' })`.
- **`GoogleButton`** — wire to Clerk's `useOAuth({ strategy: 'oauth_google' })`. Renders the same as today; the underlying handler changes.

### 6.4 Strings (`packages/shared/src/locales/*.json`)

- Update `auth.verifyEmailBody` to mention "code" instead of "link".
- Add `auth.verifyCodeLabel`, `auth.verifyCodePlaceholder`.

### 6.5 Auth store reduction (`packages/api/src/stores/auth-store.ts`)

Old shape: held the full rider object, status, pendingEmail/Token, signIn/signUp actions.

New shape:
```ts
type AuthState = {
  rider: Rider | null;            // from GET /me
  languagePref: Locale;
  fetchProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Rider, 'name' | 'email'>>) => Promise<void>;
  setLanguage: (l: Locale) => void;
  clear: () => void;              // called on Clerk sign-out
};
```

`status` is gone — components use Clerk's `useAuth().isSignedIn`. The `(auth)` group is opened from any screen that requires sign-in (Account tab, "ride now" action) just like today.

### 6.6 Mock removal

- Delete the entire `packages/api/src/mock/` directory (handlers, data, delay).
- Delete the `export * as authApi/placesApi/paymentsApi/tripsApi` lines from `packages/api/src/index.ts`.
- Add `export * from './client'`.
- `packages/api/src/utils/movement.ts` is **kept** (it's a pure utility, not a mock) and re-exported as today.

### 6.7 Frontend client layer (`packages/api/src/client/`, new)

Four files: `auth.ts`, `places.ts`, `payments.ts`, `trips.ts`. Each is a thin `fetch` wrapper:

```ts
// client/_fetch.ts
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getClerkToken();   // injected via setTokenGetter() at app boot
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}
```

`places/payments/trips` clients implement the same surface their store consumers expect. Until those backends exist, calls 404 — and the consuming screens are wrapped in `<NotImplementedScreen>` so they never make the call.

### 6.8 Non-auth tab placeholder (`apps/rider/components/NotImplementedScreen.tsx`, new)

Single component:
```tsx
<NotImplementedScreen domain="trips" />
```
Renders a centred icon + "Coming soon" + a short copy line. Used by:
- `app/(main)/(tabs)/index.tsx` (Home — uses places + trips)
- `app/(main)/(tabs)/rides.tsx` (Rides — uses trips)
- `app/(main)/(tabs)/account.tsx` (Account — uses payments + auth) → keeps the auth bits, placeholders the payments rows
- `app/(main)/search.tsx`, `confirm-destination.tsx`, `ride-selection.tsx`, `finding-driver.tsx`, `driver-matched.tsx`, `in-trip.tsx`, `trip-complete.tsx`, `receipt/[id].tsx`
- `app/(main)/account/payments.tsx`

Account tab keeps the profile/security/personal screens working (those only need `auth`, which is now real).

## 7. Env vars summary

| Var | Where | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | rider app | Backend base URL (e.g. `http://localhost:3000`). |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | rider app | Clerk publishable key (frontend). |
| `CLERK_SECRET_KEY` | backend | Clerk secret (backend JWT verify). |
| `CLERK_WEBHOOK_SIGNING_SECRET` | backend | Svix signature verification for the webhook. |

## 8. Sequencing (high level — full plan in writing-plans)

1. **Backend**: schema migration + middleware + `/me` + webhook + env. Smoke test with `curl` and a Clerk-issued test token.
2. **Frontend client layer**: build `packages/api/src/client/` and `_fetch.ts`. (No screens use it yet.)
3. **Mock removal**: delete `packages/api/src/mock/`, fix the index re-exports, add `<NotImplementedScreen>` to the affected screens. App should compile with all non-auth tabs showing placeholders.
4. **Clerk wiring + screen rewrites**: provider in `_layout`, rewrite the three auth screens, wire Google OAuth.
5. **Auth-store reduction**: shrink to just `rider + languagePref`, fetch profile on sign-in.
6. **End-to-end smoke**: sign up → verify code → land on Home (placeholder) → tap Account → see real profile → log out.

Each step is independently testable.

## 9. Risks / things to watch

- **Clerk OAuth on Expo Go vs. dev client.** Google OAuth via `expo-auth-session` works in dev clients but is awkward in Expo Go. We're already using EAS dev builds, so this should be fine, but worth confirming on first run.
- **`expo-secure-store` on web.** Rider app builds for web (`react-native-web` is in deps). Clerk's Expo SDK falls back to localStorage on web; verify the dev-server flow still works.
- **Webhook reachability in local dev.** The Clerk webhook needs a public URL. Use `cloudflared`/`ngrok` for local dev; document this in the backend README.
- **Rider profile shape mismatch.** The rider app's `Rider` type (`packages/shared/src/types/rider.ts`) was modeled around the mock data. The `/me` response must map cleanly to it; we may need to drop or rename a field. Verify before rewriting screens.
- **NotImplementedScreen blast radius.** ~10 files touched for placeholders. Mechanical change but easy to typo. Lint rule or shared index should make this safer.

## 10. Success criteria

- A new rider can sign up with email + password, receive a 6-digit code, verify, and land on the Home screen (showing the placeholder) — all against the real backend.
- A returning rider can log in with the same credentials.
- A rider can sign up via Google OAuth (on a dev build).
- The backend `users` table contains exactly one row per Clerk user, linked via `external_identities`.
- A Clerk dashboard `user.updated` event syncs to our DB within 5s.
- No file under `packages/api/src/mock/` exists.
- No `process.env.EXPO_PUBLIC_USE_MOCKS`-style switch exists anywhere.
- `apps/backend` typechecks; `apps/rider` typechecks and boots in Expo without runtime errors on a cold start.
