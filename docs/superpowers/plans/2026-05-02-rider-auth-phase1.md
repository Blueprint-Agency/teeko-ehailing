# Rider Auth Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up real rider signup/login (email + password + Google) against the Fastify backend using Clerk as the identity provider, and delete the in-app mock layer entirely.

**Architecture:** Clerk owns credentials, sessions, OAuth, and email verification (6-digit code). The rider Expo app uses `@clerk/clerk-expo` hooks for the auth flow and stores its session in `expo-secure-store`. Backend (`@teeko/backend`) verifies Clerk JWTs in middleware via `@clerk/backend`, JIT-creates a `users` row on first `/me` call (linked through `external_identities` with `provider='clerk'`), and syncs subsequent updates via a Svix-verified webhook. The rider app's mock layer (`packages/api/src/mock/`) is deleted; stores call a thin `fetch`-based client (`packages/api/src/client/`) that reads `EXPO_PUBLIC_API_URL` and injects the Clerk session token. Non-auth tabs (Home, Rides, Trip flow, Payments) render a `<NotImplementedScreen>` placeholder until their backend domains ship in later phases.

**Tech Stack:** Clerk (`@clerk/clerk-expo`, `@clerk/backend`), Svix (`svix`), Fastify 5, Drizzle ORM 0.36 + postgres-js, Expo SDK 54 + Expo Router 6, Zustand 5, `expo-secure-store`, `expo-auth-session`, `expo-web-browser`.

**Spec:** `docs/superpowers/specs/2026-05-02-rider-auth-phase1-design.md`

---

## File Structure

### Backend (`apps/backend/`)
| Path | Action | Responsibility |
|---|---|---|
| `package.json` | Modify | Add `@clerk/backend`, `svix`, `vitest` |
| `src/config/env.ts` | Modify | Add `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, optional `CLERK_PUBLISHABLE_KEY` |
| `src/db/schema/identity.ts` | Modify | Drop `NOT NULL` on `users.phone` |
| `drizzle/0001_*.sql` | Generated | Migration produced by `pnpm db:generate` |
| `src/external/clerk.ts` | Create | Wrap `@clerk/backend` `verifyToken` for use in middleware/webhook |
| `src/http/middleware/auth.ts` | Replace | Verify Clerk JWT, attach `req.clerkAuth` + best-effort `req.user` |
| `src/http/middleware/requireRole.ts` | Read-only check | Confirm it uses `req.user` (no change expected) |
| `src/modules/identity/repo.ts` | Create | Drizzle queries for users / external_identities / rider_profiles |
| `src/modules/identity/service.ts` | Replace | `jitProvisionRider`, `getRiderMe`, `updateRiderMe`, `syncFromClerkWebhook` |
| `src/api/rider/auth.routes.ts` | Replace | `GET /me`, `PATCH /me` |
| `src/api/rider/index.ts` | Modify | Swap `auth0Verify` import for `clerkAuthVerify` |
| `src/api/webhooks/clerk.routes.ts` | Create | Svix-verified webhook handler |
| `src/api/webhooks/index.ts` | Modify | Register `clerk.routes` under `/api/webhooks/clerk` |
| `tests/unit/auth.middleware.test.ts` | Create | Mock `verifyToken`, assert claim attachment + 401 paths |
| `tests/integration/rider-me.test.ts` | Create | JIT path against a test DB |
| `vitest.config.ts` | Create | Vitest config |
| `README.md` | Modify | Add Clerk env vars + ngrok webhook note |

### Rider app (`apps/rider/`)
| Path | Action | Responsibility |
|---|---|---|
| `package.json` | Modify | Add `@clerk/clerk-expo`, `expo-secure-store`, `expo-auth-session`, `expo-web-browser` |
| `app.config.ts` | Modify | Surface `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (validation only — Expo loads `EXPO_PUBLIC_*` automatically) |
| `lib/clerk.ts` | Create | `tokenCache` (`expo-secure-store`-backed) + `setTokenGetter` / `getToken` bridge |
| `app/_layout.tsx` | Modify | Wrap in `<ClerkProvider>`; on Clerk sign-in trigger `useAuthStore.fetchProfile()` |
| `app/(auth)/login.tsx` | Replace body | `useSignIn().create({ identifier, password })` |
| `app/(auth)/signup.tsx` | Replace body | `useSignUp().create(...)` + `prepareEmailAddressVerification` |
| `app/(auth)/verify-email.tsx` | Replace body | 6-digit code input + `attemptEmailAddressVerification` |
| `components/GoogleButton.tsx` | Replace handler | `useOAuth({ strategy: 'oauth_google' })` |
| `components/NotImplementedScreen.tsx` | Create | "Coming soon" placeholder per domain |
| `app/(main)/(tabs)/index.tsx` | Replace body | Render `<NotImplementedScreen domain="home" />` |
| `app/(main)/(tabs)/rides.tsx` | Replace body | Render `<NotImplementedScreen domain="rides" />` |
| `app/(main)/(tabs)/account.tsx` | Modify | Keep auth/profile rows; placeholder the payment-methods row |
| `app/(main)/account/payments.tsx` | Replace body | `<NotImplementedScreen domain="payments" />` |
| `app/(main)/search.tsx` | Replace body | `<NotImplementedScreen domain="search" />` |
| `app/(main)/confirm-destination.tsx` | Replace body | `<NotImplementedScreen domain="trips" />` |
| `app/(main)/ride-selection.tsx` | Replace body | `<NotImplementedScreen domain="trips" />` |
| `app/(main)/finding-driver.tsx` | Replace body | `<NotImplementedScreen domain="trips" />` |
| `app/(main)/driver-matched.tsx` | Replace body | `<NotImplementedScreen domain="trips" />` |
| `app/(main)/in-trip.tsx` | Replace body | `<NotImplementedScreen domain="trips" />` |
| `app/(main)/trip-complete.tsx` | Replace body | `<NotImplementedScreen domain="trips" />` |
| `app/(main)/receipt/[id].tsx` | Replace body | `<NotImplementedScreen domain="trips" />` |

### Shared package (`packages/api/`, `packages/shared/`)
| Path | Action | Responsibility |
|---|---|---|
| `packages/api/src/client/_fetch.ts` | Create | Base `api()` helper, `ApiError`, token getter registration |
| `packages/api/src/client/auth.ts` | Create | `getMe`, `updateMe` |
| `packages/api/src/client/places.ts` | Create | `recentPlaces`, `savedPlaces`, `searchPlaces` (stubs hitting real endpoints) |
| `packages/api/src/client/payments.ts` | Create | `listPaymentMethods`, `setDefaultPayment` (stubs) |
| `packages/api/src/client/trips.ts` | Create | Match existing `tripsApi` surface (stubs) |
| `packages/api/src/client/index.ts` | Create | Aggregate re-exports |
| `packages/api/src/index.ts` | Modify | Drop mock re-exports; add `client` re-exports |
| `packages/api/src/stores/auth-store.ts` | Replace | Reduced shape: `rider`, `languagePref`, `fetchProfile`, `updateProfile`, `setLanguage`, `clear` |
| `packages/api/src/stores/places-store.ts` | Modify | Import from `../client/places` |
| `packages/api/src/stores/payments-store.ts` | Modify | Import from `../client/payments` |
| `packages/api/src/stores/trip-store.ts` | Modify | Import from `../client/trips` |
| `packages/api/src/mock/` | Delete | Entire directory |
| `packages/shared/src/locales/en.json` | Modify | Update `auth.verifyEmailBody`; add `auth.verifyCodeLabel`, `notImplemented.*` |
| `packages/shared/src/locales/ms.json` | Modify | Same keys, MS translations |
| `packages/shared/src/locales/zh.json` | Modify | Same keys, ZH translations |
| `packages/shared/src/locales/ta.json` | Modify | Same keys, TA translations |

---

## Phase A — Backend (Clerk verify, JIT `/me`, webhook)

### Task A1: Install backend Clerk dependencies

**Files:**
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Install runtime + dev deps**

```bash
pnpm --filter @teeko/backend add @clerk/backend svix
pnpm --filter @teeko/backend add -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Add test scripts to `apps/backend/package.json`**

In the `"scripts"` block add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `apps/backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: [],
    pool: 'forks',
    testTimeout: 10000,
  },
});
```

- [ ] **Step 4: Verify install**

```bash
pnpm --filter @teeko/backend exec vitest --version
```
Expected: prints a vitest version.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/package.json apps/backend/vitest.config.ts pnpm-lock.yaml
git commit -m "build(backend): add @clerk/backend, svix, vitest"
```

---

### Task A2: Add Clerk env vars

**Files:**
- Modify: `apps/backend/src/config/env.ts`

- [ ] **Step 1: Replace the `schema` block in `env.ts`**

```ts
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url(),

  // Clerk (Phase 1 rider auth)
  CLERK_SECRET_KEY: z.string(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string(),

  // Auth0 — unused this phase, kept for forward compatibility
  AUTH0_DOMAIN: z.string().optional(),
  AUTH0_AUDIENCE: z.string().optional(),
  AUTH0_ISSUER: z.string().optional(),
});
```

- [ ] **Step 2: Add to `apps/backend/.env` (or `.env.example` if it exists)**

If `.env` exists locally, append:
```
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
```
If `.env.example` exists, mirror with placeholder values. Do not commit real keys.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @teeko/backend typecheck
```
Expected: passes (no use sites yet).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/config/env.ts
git commit -m "feat(backend): add Clerk env vars to config schema"
```

---

### Task A3: Schema migration — `users.phone` nullable

**Files:**
- Modify: `apps/backend/src/db/schema/identity.ts`
- Generated: `apps/backend/drizzle/0001_*.sql`

- [ ] **Step 1: Edit `apps/backend/src/db/schema/identity.ts`**

Change the `phone` column:
```ts
// before
phone: text().notNull().unique(),
// after
phone: text().unique(),
```
Leave the rest of the file unchanged.

- [ ] **Step 2: Generate the migration**

```bash
pnpm --filter @teeko/backend db:generate
```
Expected: a new file in `apps/backend/drizzle/` is created (e.g. `0001_drop_phone_notnull.sql`). Inspect it — should contain `ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL`.

- [ ] **Step 3: Apply locally**

```bash
pnpm --filter @teeko/backend db:migrate
```
Expected: applies cleanly. If the `users` table already has rows with NULL phones blocked, it will succeed (we're loosening, not tightening).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/db/schema/identity.ts apps/backend/drizzle/
git commit -m "feat(backend): make users.phone nullable for email-first signups"
```

---

### Task A4: Clerk client wrapper

**Files:**
- Create: `apps/backend/src/external/clerk.ts`

- [ ] **Step 1: Create the file**

```ts
// External provider client — Clerk.
// Wraps @clerk/backend so middleware/webhook code never touches the SDK directly.
import { createClerkClient, type ClerkClient } from '@clerk/backend';

import { env } from '../config/env';

export const clerk: ClerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.CLERK_PUBLISHABLE_KEY,
});

export type ClerkClaims = {
  sub: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

/**
 * Verify a Clerk-issued JWT bearer token.
 * Throws if the token is missing, malformed, expired, or fails signature checks.
 * Returns the verified claims we care about.
 */
export async function verifyClerkToken(token: string): Promise<ClerkClaims> {
  const { verifyToken } = await import('@clerk/backend');
  const verified = await verifyToken(token, {
    secretKey: env.CLERK_SECRET_KEY,
  });
  return {
    sub: verified.sub,
    email: typeof verified.email === 'string' ? verified.email : undefined,
    firstName: typeof verified.first_name === 'string' ? verified.first_name : undefined,
    lastName: typeof verified.last_name === 'string' ? verified.last_name : undefined,
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @teeko/backend typecheck
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/external/clerk.ts
git commit -m "feat(backend): wrap @clerk/backend behind clerk.ts"
```

---

### Task A5: Replace auth middleware with Clerk verify (TDD)

**Files:**
- Test: `apps/backend/tests/unit/auth.middleware.test.ts`
- Replace: `apps/backend/src/http/middleware/auth.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/tests/unit/auth.middleware.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/external/clerk', () => ({
  verifyClerkToken: vi.fn(),
}));

vi.mock('../../src/modules/identity/repo', () => ({
  findUserByExternalId: vi.fn(),
}));

import { clerkAuthVerify } from '../../src/http/middleware/auth';
import { verifyClerkToken } from '../../src/external/clerk';
import { findUserByExternalId } from '../../src/modules/identity/repo';

function makeReq(headers: Record<string, string> = {}) {
  return {
    headers,
    log: { warn: vi.fn(), error: vi.fn() },
  } as never;
}
function makeReply() {
  const reply: { code: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } = {
    code: vi.fn().mockReturnThis() as never,
    send: vi.fn().mockReturnThis() as never,
  };
  return reply as never;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('clerkAuthVerify', () => {
  it('401s when Authorization header is missing', async () => {
    const req = makeReq({});
    const reply = makeReply();
    await clerkAuthVerify(req, reply);
    expect((reply as { code: ReturnType<typeof vi.fn> }).code).toHaveBeenCalledWith(401);
  });

  it('401s when token verification fails', async () => {
    (verifyClerkToken as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('bad token'));
    const req = makeReq({ authorization: 'Bearer abc' });
    const reply = makeReply();
    await clerkAuthVerify(req, reply);
    expect((reply as { code: ReturnType<typeof vi.fn> }).code).toHaveBeenCalledWith(401);
  });

  it('attaches clerkAuth and req.user when row exists', async () => {
    (verifyClerkToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: 'user_clerk_123',
      email: 'a@b.com',
    });
    (findUserByExternalId as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'uuid-1',
      role: 'rider',
    });
    const req = makeReq({ authorization: 'Bearer abc' }) as unknown as {
      headers: Record<string, string>;
      clerkAuth?: unknown;
      user?: unknown;
    };
    await clerkAuthVerify(req as never, makeReply());
    expect(req.clerkAuth).toEqual({ sub: 'user_clerk_123', email: 'a@b.com' });
    expect(req.user).toEqual({ id: 'uuid-1', role: 'rider', clerkUserId: 'user_clerk_123' });
  });

  it('attaches only clerkAuth when no row exists yet (first-signup)', async () => {
    (verifyClerkToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: 'user_clerk_456',
    });
    (findUserByExternalId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = makeReq({ authorization: 'Bearer abc' }) as unknown as {
      headers: Record<string, string>;
      clerkAuth?: unknown;
      user?: unknown;
    };
    await clerkAuthVerify(req as never, makeReply());
    expect(req.clerkAuth).toEqual({ sub: 'user_clerk_456' });
    expect(req.user).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @teeko/backend test
```
Expected: FAIL with "Cannot find module ../../src/modules/identity/repo" or "clerkAuthVerify is not exported".

- [ ] **Step 3: Replace `apps/backend/src/http/middleware/auth.ts`**

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';

import { verifyClerkToken, type ClerkClaims } from '../../external/clerk';
import { findUserByExternalId } from '../../modules/identity/repo';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      role: 'rider' | 'driver' | 'admin_super' | 'admin_ops' | 'admin_finance';
      clerkUserId: string;
    };
    clerkAuth?: ClerkClaims;
  }
}

export async function clerkAuthVerify(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return reply.code(401).send({ error: 'unauthorized', message: 'missing bearer token' });
  }
  const token = header.slice(7).trim();
  let claims: ClerkClaims;
  try {
    claims = await verifyClerkToken(token);
  } catch (err) {
    req.log.warn({ err }, 'clerk token verification failed');
    return reply.code(401).send({ error: 'unauthorized', message: 'invalid token' });
  }
  req.clerkAuth = claims;
  const row = await findUserByExternalId('clerk', claims.sub);
  if (row) {
    req.user = { id: row.id, role: row.role, clerkUserId: claims.sub };
  }
}

// Backwards-compat re-export for any module that still imports `auth0Verify`.
// Will be removed in the cleanup task once all imports are migrated.
export { clerkAuthVerify as auth0Verify };
```

- [ ] **Step 4: Run tests**

Tests will still fail because `findUserByExternalId` doesn't exist yet. That's expected — Task A6 creates the repo. Skip this test for now:
```bash
pnpm --filter @teeko/backend test -- --reporter=verbose tests/unit/auth.middleware.test.ts
```
Expected: still FAILs on import. **Do not commit yet.** Continue to Task A6.

---

### Task A6: Identity repo (`findUserByExternalId`, `provisionRider`, `updateRider`)

**Files:**
- Create: `apps/backend/src/modules/identity/repo.ts`

- [ ] **Step 1: Create the repo**

```ts
// modules/identity/repo.ts
// Drizzle queries for the identity domain. Private to the module; routes
// must go through the service.
import { and, eq } from 'drizzle-orm';

import { db } from '../../config/db';
import {
  users,
  userRoles,
  externalIdentities,
  type localeEnum,
} from '../../db/schema/identity';
import { riderProfiles } from '../../db/schema/riders';

type Locale = (typeof localeEnum)['enumValues'][number];
type Role = 'rider' | 'driver' | 'admin_super' | 'admin_ops' | 'admin_finance';

export type IdentityRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  locale: Locale;
  status: 'active' | 'suspended' | 'deactivated';
  role: Role;
};

export async function findUserByExternalId(
  provider: string,
  providerSub: string,
): Promise<IdentityRow | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      locale: users.locale,
      status: users.status,
      role: userRoles.role,
    })
    .from(externalIdentities)
    .innerJoin(users, eq(users.id, externalIdentities.userId))
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(
      and(
        eq(externalIdentities.provider, provider),
        eq(externalIdentities.providerSub, providerSub),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export type ProvisionInput = {
  clerkUserId: string;
  email?: string;
  fullName?: string;
  locale?: Locale;
};

/**
 * Atomic upsert: create user + rider role + clerk external_identity + rider_profile.
 * Returns the new user id. Caller is responsible for re-reading via findUserByExternalId.
 */
export async function provisionRider(input: ProvisionInput): Promise<string> {
  return await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: input.email ?? null,
        fullName: input.fullName ?? null,
        locale: input.locale ?? 'en',
      })
      .returning({ id: users.id });
    if (!user) throw new Error('failed to insert user');

    await tx.insert(userRoles).values({ userId: user.id, role: 'rider' });
    await tx
      .insert(externalIdentities)
      .values({
        userId: user.id,
        provider: 'clerk',
        providerSub: input.clerkUserId,
      });
    await tx.insert(riderProfiles).values({ userId: user.id });

    return user.id;
  });
}

export async function updateRiderFields(
  userId: string,
  patch: { fullName?: string; locale?: Locale; email?: string | null },
): Promise<void> {
  await db
    .update(users)
    .set({
      ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
      ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
    })
    .where(eq(users.id, userId));
}

export async function softDeleteUser(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ status: 'deactivated' })
    .where(eq(users.id, userId));
}

export async function getRiderProfileBundle(userId: string) {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      locale: users.locale,
      status: users.status,
      ratingAvg: riderProfiles.ratingAvg,
      ratingCount: riderProfiles.ratingCount,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(riderProfiles, eq(riderProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}
```

- [ ] **Step 2: Run middleware unit tests**

```bash
pnpm --filter @teeko/backend test -- tests/unit/auth.middleware.test.ts
```
Expected: PASS — all four cases.

- [ ] **Step 3: Commit middleware + repo together**

```bash
git add apps/backend/src/http/middleware/auth.ts \
        apps/backend/src/modules/identity/repo.ts \
        apps/backend/tests/unit/auth.middleware.test.ts
git commit -m "feat(backend): clerk JWT auth middleware + identity repo"
```

---

### Task A7: Identity service — JIT provision + read + update

**Files:**
- Replace: `apps/backend/src/modules/identity/service.ts`

- [ ] **Step 1: Replace the file**

```ts
// modules/identity/service.ts
// Identity domain orchestration. Routes call into this service; repo stays
// private to the module.
import type { ClerkClaims } from '../../external/clerk';

import {
  findUserByExternalId,
  provisionRider,
  updateRiderFields,
  softDeleteUser,
  getRiderProfileBundle,
  type IdentityRow,
} from './repo';

export type RiderMeResponse = {
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    locale: 'en' | 'ms' | 'zh' | 'ta';
    status: 'active' | 'suspended' | 'deactivated';
  };
  riderProfile: {
    ratingAvg: number | null;
    ratingCount: number | null;
  };
};

/**
 * Get-or-create the rider's row. Used by GET /me.
 * Returns the full bundle. Idempotent.
 */
export async function getOrProvisionRiderMe(claims: ClerkClaims): Promise<RiderMeResponse> {
  let row: IdentityRow | null = await findUserByExternalId('clerk', claims.sub);
  if (!row) {
    const fullName = [claims.firstName, claims.lastName].filter(Boolean).join(' ').trim();
    await provisionRider({
      clerkUserId: claims.sub,
      email: claims.email,
      fullName: fullName || undefined,
    });
    row = await findUserByExternalId('clerk', claims.sub);
    if (!row) throw new Error('provisionRider succeeded but row not found');
  }
  const bundle = await getRiderProfileBundle(row.id);
  if (!bundle) throw new Error('user row exists but profile bundle missing');
  return {
    user: {
      id: bundle.id,
      email: bundle.email,
      fullName: bundle.fullName,
      locale: bundle.locale,
      status: bundle.status,
    },
    riderProfile: {
      ratingAvg: bundle.ratingAvg !== null ? Number(bundle.ratingAvg) : null,
      ratingCount: bundle.ratingCount,
    },
  };
}

export type RiderMePatch = {
  fullName?: string;
  locale?: 'en' | 'ms' | 'zh' | 'ta';
};

export async function patchRiderMe(userId: string, patch: RiderMePatch): Promise<void> {
  await updateRiderFields(userId, patch);
}

/**
 * Sync handler for Clerk `user.updated` and `user.deleted` webhooks.
 */
export async function applyClerkWebhook(event: {
  type: 'user.updated' | 'user.deleted';
  clerkUserId: string;
  email?: string | null;
  fullName?: string | null;
}): Promise<void> {
  const row = await findUserByExternalId('clerk', event.clerkUserId);
  if (!row) return; // never provisioned on our side; ignore

  if (event.type === 'user.deleted') {
    await softDeleteUser(row.id);
    return;
  }
  await updateRiderFields(row.id, {
    email: event.email ?? null,
    fullName: event.fullName ?? undefined,
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @teeko/backend typecheck
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/identity/service.ts
git commit -m "feat(backend): identity service with JIT provision + webhook sync"
```

---

### Task A8: `GET /api/v1/rider/auth/me` and `PATCH /me` routes

**Files:**
- Replace: `apps/backend/src/api/rider/auth.routes.ts`

- [ ] **Step 1: Replace the file**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  getOrProvisionRiderMe,
  patchRiderMe,
  type RiderMePatch,
} from '../../modules/identity/service';

const PatchBody = z.object({
  fullName: z.string().min(1).max(100).optional(),
  locale: z.enum(['en', 'ms', 'zh', 'ta']).optional(),
});

export async function routes(app: FastifyInstance) {
  app.get('/auth/me', async (req, reply) => {
    if (!req.clerkAuth) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const me = await getOrProvisionRiderMe(req.clerkAuth);
    return me;
  });

  app.patch('/auth/me', async (req, reply) => {
    if (!req.user) {
      // No row exists yet — caller must hit GET /me first to JIT-provision.
      return reply.code(404).send({ error: 'profile_not_provisioned' });
    }
    const patch = PatchBody.parse(req.body) satisfies RiderMePatch;
    await patchRiderMe(req.user.id, patch);
    return { ok: true };
  });
}
```

- [ ] **Step 2: Update `apps/backend/src/api/rider/index.ts`**

Replace the `auth0Verify` import and hook with `clerkAuthVerify`. The file should look like:
```ts
import type { FastifyInstance } from 'fastify';
import { clerkAuthVerify } from '../../http/middleware/auth';
import { requireRole } from '../../http/middleware/requireRole';

import { routes as auth } from './auth.routes';
import { routes as profile } from './profile.routes';
import { routes as trips } from './trips.routes';
import { routes as pricing } from './pricing.routes';
import { routes as maps } from './maps.routes';
import { routes as ratings } from './ratings.routes';
import { routes as safety } from './safety.routes';
import { routes as chat } from './chat.routes';
import { routes as notifications } from './notifications.routes';

export async function riderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', clerkAuthVerify);

  // Auth route runs without requireRole — it's responsible for JIT-provisioning
  // the row that requireRole then checks for. Register it first, separately.
  await app.register(auth);

  // Everything else requires an existing rider row.
  app.addHook('preHandler', requireRole('rider'));
  await app.register(profile);
  await app.register(trips, { prefix: '/trips' });
  await app.register(pricing, { prefix: '/quotes' });
  await app.register(maps);
  await app.register(ratings, { prefix: '/ratings' });
  await app.register(safety);
  await app.register(chat);
  await app.register(notifications, { prefix: '/notifications' });
}
```

> **Why split:** `requireRole('rider')` reads `req.user.role`. On the first ever request (signup → first `/me`), `req.user` is undefined because no row exists yet. The `/auth/me` route handles that case explicitly; the rest of the rider routes can safely require it.

> **Note:** Splitting hooks across two `register` calls in Fastify only works because hooks added with `app.addHook` apply to routes registered *after* the hook. If the existing `requireRole` setup turns out to apply globally regardless, fix it by wrapping the post-auth routes in `app.register(async (scope) => { scope.addHook(...); ... })` — Fastify scopes encapsulate hooks by plugin instance.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @teeko/backend typecheck
```
Expected: passes.

- [ ] **Step 4: Boot the server and smoke-test**

```bash
pnpm --filter @teeko/backend dev
```
In another terminal, with a real Clerk test JWT (grab one from your Clerk dashboard test user → JWT template, or call `Clerk.session.getToken()` from a dev rider build later):
```bash
curl -i -H "Authorization: Bearer <CLERK_TEST_JWT>" http://localhost:3000/api/v1/rider/auth/me
```
Expected: `200 OK`, JSON body with `user` and `riderProfile`. The first call provisions; subsequent calls return the same row.

Without a header:
```bash
curl -i http://localhost:3000/api/v1/rider/auth/me
```
Expected: `401`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/api/rider/auth.routes.ts apps/backend/src/api/rider/index.ts
git commit -m "feat(backend): GET/PATCH /api/v1/rider/auth/me with JIT provision"
```

---

### Task A9: Clerk webhook (Svix-verified)

**Files:**
- Create: `apps/backend/src/api/webhooks/clerk.routes.ts`
- Modify: `apps/backend/src/api/webhooks/index.ts`

- [ ] **Step 1: Create `apps/backend/src/api/webhooks/clerk.routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { Webhook } from 'svix';

import { env } from '../../config/env';
import { applyClerkWebhook } from '../../modules/identity/service';

type ClerkUserEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: {
    id: string;
    email_addresses?: Array<{ id: string; email_address: string }>;
    primary_email_address_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
};

export async function routes(app: FastifyInstance) {
  // Svix verification needs the raw body — register a content type parser
  // that hands us the raw buffer in addition to the parsed JSON.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        done(null, { raw: body, parsed: JSON.parse(body as string) });
      } catch (err) {
        done(err as Error);
      }
    },
  );

  app.post('/clerk', async (req, reply) => {
    const svixId = req.headers['svix-id'];
    const svixTs = req.headers['svix-timestamp'];
    const svixSig = req.headers['svix-signature'];
    if (
      typeof svixId !== 'string' ||
      typeof svixTs !== 'string' ||
      typeof svixSig !== 'string'
    ) {
      return reply.code(400).send({ error: 'missing_svix_headers' });
    }

    const payload = req.body as { raw: string; parsed: ClerkUserEvent };
    const wh = new Webhook(env.CLERK_WEBHOOK_SIGNING_SECRET);
    let evt: ClerkUserEvent;
    try {
      evt = wh.verify(payload.raw, {
        'svix-id': svixId,
        'svix-timestamp': svixTs,
        'svix-signature': svixSig,
      }) as ClerkUserEvent;
    } catch (err) {
      req.log.warn({ err }, 'clerk webhook signature verification failed');
      return reply.code(400).send({ error: 'invalid_signature' });
    }

    if (evt.type === 'user.created') {
      // No-op: JIT handles creation on first /me call.
      return { ok: true, ignored: 'user.created (handled by JIT)' };
    }

    const primary = evt.data.email_addresses?.find(
      (e) => e.id === evt.data.primary_email_address_id,
    );
    const email = primary?.email_address ?? null;
    const fullName =
      [evt.data.first_name, evt.data.last_name].filter(Boolean).join(' ').trim() ||
      null;

    await applyClerkWebhook({
      type: evt.type,
      clerkUserId: evt.data.id,
      email,
      fullName,
    });
    return { ok: true };
  });
}
```

- [ ] **Step 2: Register in `apps/backend/src/api/webhooks/index.ts`**

```ts
import type { FastifyInstance } from 'fastify';

import { routes as clerk } from './clerk.routes';

export async function webhookRoutes(app: FastifyInstance) {
  await app.register(clerk);

  // Existing stubs — still placeholders.
  app.post('/stripe', async () => ({ stub: 'stripe webhook · verify Stripe-Signature' }));
  app.post('/tng', async () => ({ stub: 'tng webhook' }));
  app.post('/grabpay', async () => ({ stub: 'grabpay webhook' }));
  app.post('/auth0', async () => ({ stub: 'auth0 hooks (post-registration)' }));
}
```

- [ ] **Step 3: Typecheck and boot**

```bash
pnpm --filter @teeko/backend typecheck && pnpm --filter @teeko/backend dev
```

- [ ] **Step 4: Smoke-test signature rejection**

```bash
curl -i -X POST -H "Content-Type: application/json" -d '{}' http://localhost:3000/api/webhooks/clerk
```
Expected: `400` with `missing_svix_headers`.

End-to-end webhook signing is verified later when Clerk is connected via ngrok.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/api/webhooks/clerk.routes.ts apps/backend/src/api/webhooks/index.ts
git commit -m "feat(backend): Svix-verified Clerk webhook for user.updated/deleted"
```

---

### Task A10: Backend README — Clerk + ngrok notes

**Files:**
- Modify: `apps/backend/README.md`

- [ ] **Step 1: Add a `## Clerk (Phase 1 rider auth)` section after the existing `## Auth in v0.1` section**

Append:
```markdown
## Clerk (Phase 1 rider auth)

Rider auth uses Clerk. Required env vars (see `src/config/env.ts`):

- `CLERK_SECRET_KEY` — backend secret key from Clerk dashboard
- `CLERK_WEBHOOK_SIGNING_SECRET` — Svix signing secret for the `/api/webhooks/clerk` endpoint
- `CLERK_PUBLISHABLE_KEY` (optional) — only needed if you want the SDK to embed it

### Local webhook reachability

Clerk delivers webhooks over the public internet. For local dev, expose the
backend with ngrok (or cloudflared) and register the URL in the Clerk
dashboard under Webhooks → Add endpoint:

```bash
ngrok http 3000
# then in Clerk dashboard: <ngrok-url>/api/webhooks/clerk
# subscribe to: user.updated, user.deleted
```

Test the JIT path with a Clerk session JWT:

```bash
curl -i -H "Authorization: Bearer $CLERK_JWT" \
  http://localhost:3000/api/v1/rider/auth/me
```
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/README.md
git commit -m "docs(backend): Clerk env vars + local webhook setup"
```

---

## Phase B — Add Clerk to the rider app

### Task B1: Install rider Clerk dependencies

**Files:**
- Modify: `apps/rider/package.json`

- [ ] **Step 1: Install**

```bash
pnpm --filter @teeko/rider add @clerk/clerk-expo expo-secure-store expo-auth-session expo-web-browser
```

- [ ] **Step 2: Verify Expo SDK alignment**

```bash
pnpm --filter @teeko/rider exec expo doctor
```
If it suggests `expo install --check` for any of the four packages, run that to align versions with SDK 54.

- [ ] **Step 3: Commit**

```bash
git add apps/rider/package.json pnpm-lock.yaml
git commit -m "build(rider): add @clerk/clerk-expo + secure-store + oauth deps"
```

---

### Task B2: Token cache + token getter bridge

**Files:**
- Create: `apps/rider/lib/clerk.ts`

- [ ] **Step 1: Create the file**

```ts
// lib/clerk.ts
// Clerk token cache (expo-secure-store-backed) + a getter bridge so
// non-React code (the api client) can read the current Clerk token.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { TokenCache } from '@clerk/clerk-expo/dist/cache';

export const tokenCache: TokenCache = {
  async getToken(key) {
    try {
      if (Platform.OS === 'web') return null; // Clerk web SDK uses cookies
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key, value) {
    if (Platform.OS === 'web') return;
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore — secure-store may be unavailable in some environments
    }
  },
};

// Bridge: the client/_fetch.ts module calls getToken() to inject Authorization.
// _layout.tsx registers the actual getter once Clerk is mounted.
let tokenGetter: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>): void {
  tokenGetter = fn;
}

export async function getToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  return tokenGetter();
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @teeko/rider typecheck
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/rider/lib/clerk.ts
git commit -m "feat(rider): clerk token cache + getter bridge"
```

---

### Task B3: Wrap `_layout.tsx` in `<ClerkProvider>`

**Files:**
- Modify: `apps/rider/app/_layout.tsx`

- [ ] **Step 1: Edit `apps/rider/app/_layout.tsx`**

At the top, add imports:
```ts
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo';
import { tokenCache, setTokenGetter } from '../lib/clerk';
```

Define a fragment that registers the token getter once the Clerk session is available, and triggers `fetchProfile` on sign-in:
```tsx
function ClerkBridge({ children }: { children: React.ReactNode }) {
  const { getToken: clerkGetToken, isSignedIn } = useAuth();
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const clearProfile = useAuthStore((s) => s.clear);

  useEffect(() => {
    setTokenGetter(async () => clerkGetToken());
  }, [clerkGetToken]);

  useEffect(() => {
    if (isSignedIn) {
      fetchProfile().catch(() => {
        // ignore; UI will surface its own error if needed
      });
    } else {
      clearProfile();
    }
  }, [isSignedIn, fetchProfile, clearProfile]);

  return <>{children}</>;
}
```

Replace the existing `return (...)` block with:
```tsx
return (
  <ClerkProvider
    publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
    tokenCache={tokenCache}
  >
    <ClerkLoaded>
      <ClerkBridge>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(main)" />
            <Stack.Screen name="(auth)" options={{ presentation: 'modal', gestureEnabled: true }} />
          </Stack>
        </SafeAreaProvider>
      </ClerkBridge>
    </ClerkLoaded>
  </ClerkProvider>
);
```

Remove the `useAuthStore.hydrate()` call and the `setLanguage(locale)` call **if** they're no longer used (they will be after auth-store reduction in Task D1; for now, leave `setLanguage` in place — it's still part of the reduced store).

- [ ] **Step 2: Add the env var to your local environment**

```bash
echo "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_..." >> apps/rider/.env
echo "EXPO_PUBLIC_API_URL=http://localhost:3000" >> apps/rider/.env
```
(Expo loads `EXPO_PUBLIC_*` from `.env` automatically.)

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @teeko/rider typecheck
```
Expected: passes (or fails only on the still-unmodified `fetchProfile` reference — that's resolved in Task D1; if it's an error you can stub `fetchProfile` to a no-op temporarily).

- [ ] **Step 4: Commit (do not start the app yet — auth store and screens still talk to mocks)**

```bash
git add apps/rider/app/_layout.tsx
git commit -m "feat(rider): wrap _layout in ClerkProvider + token bridge"
```

---

## Phase C — Frontend client layer

### Task C1: `client/_fetch.ts`

**Files:**
- Create: `packages/api/src/client/_fetch.ts`

- [ ] **Step 1: Create the file**

```ts
// client/_fetch.ts
// Base HTTP helper used by every domain client. Reads EXPO_PUBLIC_API_URL,
// injects the Clerk session token via the bridge in apps/rider/lib/clerk.ts.
//
// The token getter is registered at app boot (apps/rider/app/_layout.tsx).
// Outside the rider app (e.g. in tests), it returns null and requests are
// sent unauthenticated.

let tokenGetter: () => Promise<string | null> = async () => null;

export function setApiTokenGetter(fn: () => Promise<string | null>): void {
  tokenGetter = fn;
}

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.body = body;
  }
}

function baseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. Add it to apps/rider/.env (e.g. http://localhost:3000)',
    );
  }
  return url;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenGetter();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

- [ ] **Step 2: Wire the getter into the rider app**

In `apps/rider/lib/clerk.ts`, at the bottom of `setTokenGetter`, also forward to the api client. Edit `apps/rider/lib/clerk.ts`:

```ts
import { setApiTokenGetter } from '@teeko/api';

export function setTokenGetter(fn: () => Promise<string | null>): void {
  tokenGetter = fn;
  setApiTokenGetter(fn);
}
```

(`setApiTokenGetter` is exported from the package index in Task C6.)

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/client/_fetch.ts apps/rider/lib/clerk.ts
git commit -m "feat(api): client/_fetch with token getter bridge"
```

---

### Task C2: `client/auth.ts`

**Files:**
- Create: `packages/api/src/client/auth.ts`

- [ ] **Step 1: Create the file**

```ts
// client/auth.ts
// Wraps GET /api/v1/rider/auth/me and PATCH /me.
import type { Locale, Rider } from '@teeko/shared';

import { api } from './_fetch';

type RiderMeResponse = {
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    locale: Locale;
    status: 'active' | 'suspended' | 'deactivated';
  };
  riderProfile: {
    ratingAvg: number | null;
    ratingCount: number | null;
  };
};

function toRider(res: RiderMeResponse): Rider {
  return {
    id: res.user.id,
    name: res.user.fullName ?? '',
    phone: '', // not collected this phase
    email: res.user.email ?? undefined,
    rating: res.riderProfile.ratingAvg ?? 0,
    languagePref: res.user.locale,
    verified: true, // Clerk verifies email at signup
    signupDate: undefined,
  };
}

export async function getMe(): Promise<Rider> {
  const res = await api<RiderMeResponse>('/api/v1/rider/auth/me');
  return toRider(res);
}

export async function updateMe(patch: { fullName?: string; locale?: Locale }): Promise<void> {
  await api<{ ok: true }>('/api/v1/rider/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @teeko/api typecheck
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/client/auth.ts
git commit -m "feat(api): client/auth getMe/updateMe"
```

---

### Task C3: `client/places.ts`, `client/payments.ts`, `client/trips.ts` (stubs that hit real endpoints)

**Files:**
- Create: `packages/api/src/client/places.ts`
- Create: `packages/api/src/client/payments.ts`
- Create: `packages/api/src/client/trips.ts`

These match the existing mock handler signatures so the stores can keep their current method names.

- [ ] **Step 1: Create `packages/api/src/client/places.ts`**

```ts
import type { Place } from '@teeko/shared';

import { api } from './_fetch';

export async function recentPlaces(): Promise<Place[]> {
  return api<Place[]>('/api/v1/rider/places/recent');
}

export async function savedPlaces(): Promise<Place[]> {
  return api<Place[]>('/api/v1/rider/places/saved');
}

export async function searchPlaces(q: string): Promise<Place[]> {
  return api<Place[]>(`/api/v1/rider/places/search?q=${encodeURIComponent(q)}`);
}
```

- [ ] **Step 2: Create `packages/api/src/client/payments.ts`**

```ts
import type { PaymentMethod } from '@teeko/shared';

import { api } from './_fetch';

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  return api<PaymentMethod[]>('/api/v1/rider/payments');
}

export async function setDefaultPayment(id: string): Promise<PaymentMethod[]> {
  return api<PaymentMethod[]>(`/api/v1/rider/payments/${encodeURIComponent(id)}/default`, {
    method: 'POST',
  });
}
```

- [ ] **Step 3: Create `packages/api/src/client/trips.ts`**

Match every method `trip-store.ts` imports. Inspect the current import surface first:
```bash
pnpm --filter @teeko/api exec grep -nE "tripsApi\.[a-zA-Z]+" packages/api/src/stores/trip-store.ts
```
Then create one wrapper per method. Example structure (replace method names + payloads with what the grep returns):
```ts
import type { Fare, Place, Trip, RideCategory } from '@teeko/shared';

import { api } from './_fetch';

export async function quote(input: { pickup: Place; destination: Place }): Promise<Fare[]> {
  return api<Fare[]>('/api/v1/rider/quotes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function create(input: {
  pickup: Place;
  destination: Place;
  rideType: RideCategory;
  paymentMethodId: string;
}): Promise<Trip> {
  return api<Trip>('/api/v1/rider/trips', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function cancel(tripId: string, reason: string): Promise<void> {
  await api<{ ok: true }>(`/api/v1/rider/trips/${encodeURIComponent(tripId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function get(tripId: string): Promise<Trip> {
  return api<Trip>(`/api/v1/rider/trips/${encodeURIComponent(tripId)}`);
}

export async function listHistory(): Promise<Trip[]> {
  return api<Trip[]>('/api/v1/rider/trips');
}

export async function rate(tripId: string, rating: number, comment?: string): Promise<void> {
  await api<{ ok: true }>(`/api/v1/rider/ratings`, {
    method: 'POST',
    body: JSON.stringify({ tripId, rating, comment }),
  });
}
```

> **Important:** the exact set of exports must match what `trip-store.ts` imports. If your grep shows methods not listed above (e.g. `selectRideType`, `selectPayment` — these are likely *store* methods, not api calls), do not add them here. Only mock-handler functions become client functions.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @teeko/api typecheck
```
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/client/places.ts packages/api/src/client/payments.ts packages/api/src/client/trips.ts
git commit -m "feat(api): real-fetch clients for places/payments/trips"
```

---

### Task C4: `client/index.ts` aggregate + package re-exports

**Files:**
- Create: `packages/api/src/client/index.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Create `packages/api/src/client/index.ts`**

```ts
export * as authApi from './auth';
export * as placesApi from './places';
export * as paymentsApi from './payments';
export * as tripsApi from './trips';
export { api, ApiError, setApiTokenGetter } from './_fetch';
```

- [ ] **Step 2: Update `packages/api/src/index.ts`**

Replace the four mock re-export lines:
```ts
// REMOVE:
// export * as authApi from './mock/handlers/auth';
// export * as placesApi from './mock/handlers/places';
// export * as paymentsApi from './mock/handlers/payments';
// export * as tripsApi from './mock/handlers/trips';

// ADD:
export { authApi, placesApi, paymentsApi, tripsApi, api, ApiError, setApiTokenGetter } from './client';
```

Also remove the `simulateLatency` re-export — it's only used by mocks. The `simulateDriverMovement` utility stays.

The file should now be:
```ts
// @teeko/api — real HTTP clients + Zustand stores. No mocks.
// All mutations and fetches go through this package; components never import
// JSON or call fetch directly.

export { simulateDriverMovement, type MovementTick } from './utils/movement';

export {
  authApi,
  placesApi,
  paymentsApi,
  tripsApi,
  api,
  ApiError,
  setApiTokenGetter,
} from './client';

export { useAuthStore, type AuthState } from './stores/auth-store';
export { useLocationStore, type LocationState } from './stores/location-store';
export { usePlacesStore, type PlacesState } from './stores/places-store';
export { usePaymentsStore, type PaymentsState } from './stores/payments-store';
export { useTripStore, type TripState } from './stores/trip-store';
export { useUIStore, type UIState, type Toast } from './stores/ui-store';

export const API_PACKAGE_VERSION = '0.2.0';
```

> Note `AuthStatus` is no longer exported — it's replaced by Clerk's `useAuth().isSignedIn`.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @teeko/api typecheck
```
Expected: **fails** in `stores/*.ts` because they still import from `../mock/handlers/*`. That's resolved in Task F1. **Don't commit yet** — finish Phase D first so stores can be migrated as a coherent change.

---

## Phase D — Auth-store reduction + Clerk-driven screens + locale strings

### Task D1: Reduce `auth-store.ts`

**Files:**
- Replace: `packages/api/src/stores/auth-store.ts`

- [ ] **Step 1: Replace the file**

```ts
import type { Locale, Rider } from '@teeko/shared';
import { create } from 'zustand';

import * as authApi from '../client/auth';

export type AuthState = {
  rider: Rider | null;
  languagePref: Locale;

  fetchProfile: () => Promise<void>;
  updateProfile: (patch: { fullName?: string; locale?: Locale }) => Promise<void>;
  setLanguage: (locale: Locale) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  rider: null,
  languagePref: 'en',

  async fetchProfile() {
    const rider = await authApi.getMe();
    set({ rider, languagePref: rider.languagePref });
  },

  async updateProfile(patch) {
    await authApi.updateMe(patch);
    const current = get().rider;
    if (current) {
      set({
        rider: {
          ...current,
          ...(patch.fullName !== undefined ? { name: patch.fullName } : {}),
          ...(patch.locale !== undefined ? { languagePref: patch.locale } : {}),
        },
      });
    }
  },

  setLanguage(languagePref) {
    set({ languagePref });
  },

  clear() {
    set({ rider: null });
  },
}));
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @teeko/api typecheck
```
Expected: still fails in `places-store.ts`/`payments-store.ts`/`trip-store.ts` (mock imports), but `auth-store.ts` is clean. Continue.

- [ ] **Step 3: Do not commit yet** — auth-store is consumed by screens not yet rewritten. Hold this commit until Task D6 so the rider app stays compileable across commits (or commit now and accept a temporary broken state in HEAD; chris's call). Recommended: wait.

---

### Task D2: Audit `useAuthStore` consumers in the rider app

**Files (grep first):**
```bash
pnpm --filter @teeko/rider exec grep -rn "useAuthStore" apps/rider --include="*.tsx" --include="*.ts"
```

Find every consumer that reads removed fields (`status`, `pendingEmail`, `pendingName`, `pendingToken`, `signInWithEmail`, `signUpWithEmail`, `signInWithGoogle`, `verifyEmail`, `resendVerification`, `resetVerification`, `hydrate`, `logout`, `updateRider`).

- [ ] **Step 1: For each consumer, replace per this map:**

| Old | New |
|---|---|
| `useAuthStore((s) => s.status)` → `'authed'`/`'guest'` checks | `useAuth().isSignedIn` (from `@clerk/clerk-expo`) |
| `useAuthStore((s) => s.signInWithEmail)` etc. | Inline Clerk hooks in the calling screen — see Tasks D3–D5 |
| `useAuthStore((s) => s.logout)` | `const { signOut } = useClerk(); await signOut(); useAuthStore.getState().clear();` |
| `useAuthStore((s) => s.hydrate)` | Removed — Clerk handles session restoration |
| `useAuthStore((s) => s.updateRider)(...)` | `useAuthStore((s) => s.updateProfile)({ fullName, locale })` (returns Promise; await it) |
| `useAuthStore((s) => s.pendingEmail)` (verify-email screen) | `useSignUp().signUp.emailAddress` (Clerk holds pending state) |

- [ ] **Step 2: Apply edits to every file the grep found.** Common locations:
  - `app/(main)/(tabs)/account.tsx` — sign-out button, verified badge
  - `app/(main)/account/personal.tsx` — name/email display + edit
  - `app/(main)/account/security.tsx` — sign-out, password change link (link out to Clerk-hosted UserProfile if you want, otherwise placeholder)
  - `app/index.tsx` — initial routing based on auth status

- [ ] **Step 3: Hold commit** — final auth-store + consumers + screens commit together (Task D7).

---

### Task D3: Rewrite `(auth)/login.tsx` with Clerk

**Files:**
- Modify: `apps/rider/app/(auth)/login.tsx`

- [ ] **Step 1: Replace the screen body**

Keep all UI structure; replace the `submit` handler and remove store imports for `signInWithEmail`/`signInWithGoogle`. Replace the imports block:
```tsx
import { useState } from 'react';
import { Keyboard, TouchableWithoutFeedback, View } from 'react-native';

import { useUIStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { Button, Input, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

import { GoogleButton } from '../../components/GoogleButton';
```

Replace the `submit` body:
```tsx
const { signIn, setActive, isLoaded } = useSignIn();

const submit = async () => {
  if (!isLoaded || !signIn || !setActive) return;
  setEmailError(undefined);
  setPasswordError(undefined);
  setSubmitting(true);
  try {
    const attempt = await signIn.create({ identifier: email.trim(), password });
    if (attempt.status === 'complete') {
      await setActive({ session: attempt.createdSessionId });
      router.back();
    } else {
      pushToast({ kind: 'error', message: 'Login incomplete. Try again.' });
    }
  } catch (err) {
    const code = (err as { errors?: Array<{ code?: string }> }).errors?.[0]?.code;
    if (code === 'form_identifier_not_found' || code === 'form_param_format_invalid') {
      setEmailError(t('auth.invalidEmail'));
    } else if (code === 'form_password_incorrect') {
      setPasswordError(t('auth.invalidPassword'));
    } else {
      pushToast({ kind: 'error', message: 'Something went wrong. Try again.' });
    }
  } finally {
    setSubmitting(false);
  }
};
```

Delete `signInWithGoogle`/`onGoogle` from this file — `<GoogleButton>` will own that flow internally (Task D6).

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @teeko/rider typecheck
```

- [ ] **Step 3: Hold commit** — see D7.

---

### Task D4: Rewrite `(auth)/signup.tsx`

**Files:**
- Modify: `apps/rider/app/(auth)/signup.tsx`

- [ ] **Step 1: Replace the `submit` handler and imports**

Imports:
```tsx
import { useSignUp } from '@clerk/clerk-expo';
```

Body:
```tsx
const { signUp, isLoaded } = useSignUp();

const submit = async () => {
  if (!isLoaded || !signUp) return;
  setEmailError(undefined);
  setPasswordError(undefined);
  setSubmitting(true);
  try {
    await signUp.create({
      emailAddress: email.trim(),
      password,
      firstName: name.trim() || undefined,
    });
    await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    router.replace('/(auth)/verify-email');
  } catch (err) {
    const code = (err as { errors?: Array<{ code?: string }> }).errors?.[0]?.code;
    if (code === 'form_identifier_exists' || code === 'form_param_format_invalid') {
      setEmailError(t('auth.invalidEmail'));
    } else if (code === 'form_password_pwned' || code === 'form_password_length_too_short') {
      setPasswordError(t('auth.invalidPassword'));
    } else {
      pushToast({ kind: 'error', message: 'Sign-up failed. Try again.' });
    }
  } finally {
    setSubmitting(false);
  }
};
```

- [ ] **Step 2: Typecheck and hold commit (D7).**

---

### Task D5: Rewrite `(auth)/verify-email.tsx` for 6-digit code

**Files:**
- Modify: `apps/rider/app/(auth)/verify-email.tsx`

- [ ] **Step 1: Replace the screen**

```tsx
import { useState } from 'react';
import { View } from 'react-native';

import { useUIStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { Button, Icon, Input, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useSignUp, useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const t = useT();
  const { signUp, setActive, isLoaded } = useSignUp();
  const clerk = useClerk();
  const pushToast = useUIStore((s) => s.pushToast);

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [codeError, setCodeError] = useState<string | undefined>();

  const pendingEmail = signUp?.emailAddress ?? null;

  const onVerify = async () => {
    if (!isLoaded || !signUp || !setActive) return;
    setCodeError(undefined);
    setVerifying(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.dismissAll?.();
        router.back();
      } else {
        setCodeError(t('auth.codeIncorrect'));
      }
    } catch (err) {
      const errCode = (err as { errors?: Array<{ code?: string }> }).errors?.[0]?.code;
      if (errCode === 'form_code_incorrect' || errCode === 'verification_failed') {
        setCodeError(t('auth.codeIncorrect'));
      } else {
        pushToast({ kind: 'error', message: 'Verification failed. Try again.' });
      }
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    if (!isLoaded || !signUp) return;
    setResending(true);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      pushToast({ kind: 'info', message: t('auth.resendToast') });
    } finally {
      setResending(false);
    }
  };

  const onClose = async () => {
    // Abandon the in-progress sign-up: sign out (no session yet) and bounce to login.
    try {
      await clerk.signOut();
    } catch {
      // ignore
    }
    router.replace('/(auth)/login');
  };

  return (
    <ScreenContainer>
      <View className="flex-1 justify-between pb-6 pt-8">
        <View>
          <Pressable onPress={onClose} haptic="selection" accessibilityRole="button" className="mb-6 h-10 w-10 items-center justify-center">
            <Icon name="close" size={24} color="#111111" />
          </Pressable>

          <View className="items-center">
            <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Icon name="mail-outline" size={36} color="#E11D2E" />
            </View>
            <Text weight="bold" className="text-center text-3xl leading-tight">
              {t('auth.verifyEmailTitle')}
            </Text>
            <Text tone="secondary" className="mt-3 text-center text-base">
              {t('auth.verifyEmailBody', { email: pendingEmail ?? 'your email' })}
            </Text>
          </View>

          <View className="mt-8">
            <Input
              label={t('auth.verifyCodeLabel')}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(v) => {
                setCode(v.replace(/\D/g, ''));
                if (codeError) setCodeError(undefined);
              }}
              error={codeError}
            />
          </View>
        </View>

        <View className="gap-3">
          <Button
            label={t('auth.verifyCta')}
            onPress={onVerify}
            loading={verifying}
            disabled={code.length !== 6}
          />
          <Button
            label={t('auth.resend')}
            variant="ghost"
            onPress={onResend}
            loading={resending}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Typecheck and hold commit (D7).**

---

### Task D6: Rewrite `GoogleButton` to use `useOAuth`

**Files:**
- Modify: `apps/rider/components/GoogleButton.tsx`

- [ ] **Step 1: Open the file and read current shape**

```bash
cat apps/rider/components/GoogleButton.tsx
```

It currently exposes a presentational button with an `onPress` prop. Change it to own the OAuth flow internally so callers don't need to wire it.

- [ ] **Step 2: Replace the file**

```tsx
import { Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useOAuth } from '@clerk/clerk-expo';
import { useUIStore } from '@teeko/api';
import { Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();

export type GoogleButtonProps = {
  label: string;
  disabled?: boolean;
};

export function GoogleButton({ label, disabled }: GoogleButtonProps) {
  const router = useRouter();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const pushToast = useUIStore((s) => s.pushToast);

  const onPress = async () => {
    try {
      const { createdSessionId, setActive } = await startOAuthFlow();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.back();
      }
    } catch {
      pushToast({ kind: 'error', message: 'Google sign-in failed. Try again.' });
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="h-12 flex-row items-center justify-center rounded-xl border border-border bg-white"
    >
      <View className="mr-2 h-5 w-5 rounded-full bg-[#4285F4]" />
      <Text weight="bold" className="text-base">
        {label}
      </Text>
    </Pressable>
  );
}
```

> **If the existing component had a richer Google glyph (SVG), preserve it** — only replace the handler logic. Re-read the file before editing to avoid losing branding.

- [ ] **Step 3: Update callers in `login.tsx` / `signup.tsx`** to drop the `onPress` prop:
```tsx
<GoogleButton label={t('auth.continueWithGoogle')} disabled={submitting} />
```

- [ ] **Step 4: Typecheck.**

---

### Task D7: Update locale strings + commit Phase D as one

**Files:**
- Modify: `packages/shared/src/locales/en.json`
- Modify: `packages/shared/src/locales/ms.json`
- Modify: `packages/shared/src/locales/zh.json`
- Modify: `packages/shared/src/locales/ta.json`

- [ ] **Step 1: For each locale file, in the `auth` block add/update**

EN:
```json
"verifyEmailBody": "We sent a 6-digit code to {{email}}. Enter it below to finish signing up.",
"verifyCodeLabel": "Verification code",
"codeIncorrect": "Incorrect code"
```

MS:
```json
"verifyEmailBody": "Kami menghantar kod 6-digit ke {{email}}. Masukkan kod di bawah untuk selesaikan pendaftaran.",
"verifyCodeLabel": "Kod pengesahan",
"codeIncorrect": "Kod tidak betul"
```

ZH:
```json
"verifyEmailBody": "我们已将 6 位验证码发送至 {{email}}。请在下方输入以完成注册。",
"verifyCodeLabel": "验证码",
"codeIncorrect": "验证码错误"
```

TA:
```json
"verifyEmailBody": "{{email}} க்கு 6 இலக்க குறியீட்டை அனுப்பியுள்ளோம். பதிவை முடிக்க கீழே உள்ளிடவும்.",
"verifyCodeLabel": "சரிபார்ப்பு குறியீடு",
"codeIncorrect": "தவறான குறியீடு"
```

- [ ] **Step 2: Typecheck the whole monorepo**

```bash
pnpm -r typecheck
```
Expected: still fails on the three non-auth stores (mock imports). That's OK — Phase F resolves it.

- [ ] **Step 3: Commit Phase D as a single change**

```bash
git add packages/api/src/stores/auth-store.ts \
        apps/rider/app/_layout.tsx \
        apps/rider/app/\(auth\)/login.tsx \
        apps/rider/app/\(auth\)/signup.tsx \
        apps/rider/app/\(auth\)/verify-email.tsx \
        apps/rider/components/GoogleButton.tsx \
        apps/rider/app/\(main\)/\(tabs\)/account.tsx \
        apps/rider/app/\(main\)/account/personal.tsx \
        apps/rider/app/\(main\)/account/security.tsx \
        apps/rider/app/index.tsx \
        packages/shared/src/locales/en.json \
        packages/shared/src/locales/ms.json \
        packages/shared/src/locales/zh.json \
        packages/shared/src/locales/ta.json
git commit -m "feat(rider): clerk-driven auth screens, reduced auth store, code-based verify"
```

(Adjust paths to whichever consumer files Task D2 actually changed.)

---

## Phase E — `<NotImplementedScreen>` for non-auth tabs

### Task E1: Create the placeholder + locale strings

**Files:**
- Create: `apps/rider/components/NotImplementedScreen.tsx`
- Modify: `packages/shared/src/locales/{en,ms,zh,ta}.json`

- [ ] **Step 1: Create the component**

```tsx
import { View } from 'react-native';

import { useT } from '@teeko/i18n';
import { Icon, ScreenContainer, Text } from '@teeko/ui';

export type NotImplementedDomain = 'home' | 'rides' | 'trips' | 'payments' | 'search';

export function NotImplementedScreen({ domain }: { domain: NotImplementedDomain }) {
  const t = useT();
  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Icon name="construct-outline" size={36} color="#666" />
        </View>
        <Text weight="bold" className="text-center text-2xl">
          {t(`notImplemented.${domain}.title`)}
        </Text>
        <Text tone="secondary" className="mt-3 text-center text-base">
          {t(`notImplemented.${domain}.body`)}
        </Text>
      </View>
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Add locale keys**

To each `packages/shared/src/locales/*.json`, add a top-level `notImplemented` block. EN example:
```json
"notImplemented": {
  "home": {
    "title": "Home is coming soon",
    "body": "We're building the booking flow next. Check back soon."
  },
  "rides": {
    "title": "Ride history coming soon",
    "body": "Once you take your first trip, it'll show up here."
  },
  "trips": {
    "title": "Trip flow coming soon",
    "body": "We're wiring up dispatch and tracking next."
  },
  "payments": {
    "title": "Payments coming soon",
    "body": "Add a card or e-wallet once we launch payment integration."
  },
  "search": {
    "title": "Search coming soon",
    "body": "Place search lights up alongside the booking flow."
  }
}
```

Translate to MS / ZH / TA following the existing tone in those files (or paste short literal translations and refine later — MVP timeline).

- [ ] **Step 3: Typecheck and commit**

```bash
git add apps/rider/components/NotImplementedScreen.tsx \
        packages/shared/src/locales/en.json \
        packages/shared/src/locales/ms.json \
        packages/shared/src/locales/zh.json \
        packages/shared/src/locales/ta.json
git commit -m "feat(rider): NotImplementedScreen placeholder for unbuilt domains"
```

---

### Task E2: Wrap affected screens

**Files (all in `apps/rider/app/(main)/`):**
- Replace body: `(tabs)/index.tsx`, `(tabs)/rides.tsx`, `account/payments.tsx`, `search.tsx`, `confirm-destination.tsx`, `ride-selection.tsx`, `finding-driver.tsx`, `driver-matched.tsx`, `in-trip.tsx`, `trip-complete.tsx`, `receipt/[id].tsx`
- Modify: `(tabs)/account.tsx` (placeholder only the payments row)

- [ ] **Step 1: For each "Replace body" file above, replace the entire file with**

(Adjust the `domain` argument per the table in the spec.)
```tsx
import { NotImplementedScreen } from '../../components/NotImplementedScreen';
// path depth varies — use ../../../components/NotImplementedScreen for nested files

export default function Screen() {
  return <NotImplementedScreen domain="trips" />;
}
```

Use this domain mapping:
- `(tabs)/index.tsx` → `home`
- `(tabs)/rides.tsx` → `rides`
- `account/payments.tsx` → `payments`
- `search.tsx` → `search`
- everything in the trip flow (`confirm-destination`, `ride-selection`, `finding-driver`, `driver-matched`, `in-trip`, `trip-complete`, `receipt/[id]`) → `trips`

- [ ] **Step 2: For `(tabs)/account.tsx`** — keep all rows that only need auth (profile, security, personal, language). For the row that previously navigated to `/account/payments` or rendered the default payment, leave the row visible but on press navigate to `/account/payments` (which now shows the placeholder). No code change needed if it already navigates by route.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @teeko/rider typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/rider/app/\(main\)/
git commit -m "feat(rider): placeholder unbuilt domains with NotImplementedScreen"
```

---

## Phase F — Mock removal + verification

### Task F1: Switch non-auth stores to client imports

**Files:**
- Modify: `packages/api/src/stores/places-store.ts`
- Modify: `packages/api/src/stores/payments-store.ts`
- Modify: `packages/api/src/stores/trip-store.ts`

- [ ] **Step 1: In each file, change the import line only**

```ts
// places-store.ts
import * as placesApi from '../client/places';

// payments-store.ts
import * as paymentsApi from '../client/payments';

// trip-store.ts
import * as tripsApi from '../client/trips';
```

The store bodies stay unchanged (that's why the client functions match the mock signatures).

- [ ] **Step 2: Typecheck — should now pass**

```bash
pnpm -r typecheck
```
If `trip-store.ts` references a function not exported from `client/trips.ts`, add the missing client wrapper. Do not stub at the store level — every call must resolve.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/stores/
git commit -m "refactor(api): point non-auth stores at real-fetch client"
```

---

### Task F2: Delete the mock layer

**Files:**
- Delete: `packages/api/src/mock/` (entire directory)

- [ ] **Step 1: Delete**

```bash
git rm -r packages/api/src/mock/
```

- [ ] **Step 2: Confirm nothing else imports from there**

```bash
pnpm --filter @teeko/api exec grep -rn "mock/handlers\|mock/data\|mock/delay" packages apps
```
Expected: no matches.

- [ ] **Step 3: Final typecheck**

```bash
pnpm -r typecheck
```
Expected: passes everywhere.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(api): delete mock layer (handlers, data, delay)"
```

---

### Task F3: End-to-end smoke

- [ ] **Step 1: Set the env vars locally**

```bash
# apps/backend/.env
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
DATABASE_URL=postgres://...

# apps/rider/.env
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

> **For mobile devices** (not iOS sim / Android emulator on the same machine), `EXPO_PUBLIC_API_URL` must be your machine's LAN IP, not `localhost`.

- [ ] **Step 2: Boot backend + rider**

```bash
# terminal 1
pnpm --filter @teeko/backend dev

# terminal 2
pnpm --filter @teeko/rider dev
```

- [ ] **Step 3: Walk the flow**

1. Open the rider app in a dev build (or simulator).
2. Open the (auth) modal (tap any sign-in CTA).
3. Tap "Sign up". Enter name + new email + password.
4. Receive the 6-digit code by email.
5. Enter the code on `verify-email`. Confirm landing on Home (placeholder).
6. Open the Account tab → personal info shows the email and name from `/me`.
7. Sign out via Account → security.
8. Sign back in with the same email + password. Confirm `/me` returns the same row.
9. (Optional) Sign up via Google: tap "Continue with Google" on signup, complete OAuth, confirm landing on Home.

- [ ] **Step 4: Inspect the database**

```bash
pnpm --filter @teeko/backend db:studio
```
Verify the new `users` row, the matching `external_identities` row with `provider='clerk'`, and the `rider_profiles` row.

- [ ] **Step 5: (If ngrok available) verify the webhook**

Update the rider's name in Clerk dashboard → check that `users.fullName` updates within ~5s.

- [ ] **Step 6: Commit any small fixes that came up; if none, this is the wrap-up.**

```bash
git status
# if clean, just push
git push
```

---

## Self-Review

**1. Spec coverage:**

| Spec section | Tasks |
|---|---|
| 5.1 Schema (`phone` nullable) | A3 |
| 5.2 Auth middleware | A5 + A6 (repo) |
| 5.3 `/me` endpoints | A7 (service) + A8 (routes) |
| 5.4 Webhook | A9 |
| 5.5 Env additions | A2 |
| 5.6 Auth0 files left in place | (no task — explicit no-op) |
| 6.1 New deps | B1 |
| 6.2 Provider wiring | B2 + B3 |
| 6.3 Screen rewrites | D3, D4, D5 |
| 6.4 Strings | D7 + E1 |
| 6.5 Auth-store reduction | D1 |
| 6.6 Mock removal | F2 |
| 6.7 Frontend client layer | C1, C2, C3, C4 |
| 6.8 NotImplementedScreen | E1 + E2 |
| 7 Env vars summary | A2 + B3 + F3 |
| 8 Sequencing | Phases A → B → C → D → E → F |
| 10 Success criteria | F3 smoke |

All sections covered.

**2. Placeholder scan:** No "TBD", "implement later", or "fill in details" in any task body. All code blocks are concrete. Two tasks ask the engineer to grep before writing (C3 trip exports, D2 auth-store consumers) — both include the exact grep command and the rule for what to do with the output.

**3. Type consistency:**
- `clerkAuthVerify` exported from `auth.ts` — used in A5, A6, A8.
- `verifyClerkToken`, `ClerkClaims` from `external/clerk.ts` — used in A4, A5, A7.
- `findUserByExternalId`, `provisionRider`, `updateRiderFields`, `softDeleteUser`, `getRiderProfileBundle` — defined in A6 (repo), used in A7 (service).
- `getOrProvisionRiderMe`, `patchRiderMe`, `applyClerkWebhook`, `RiderMePatch` — defined in A7, used in A8 + A9.
- `setApiTokenGetter` exported from `client/_fetch.ts` (C1), re-exported through `client/index.ts` (C4) and the package index (C4), consumed in `apps/rider/lib/clerk.ts` (C1 step 2).
- `tokenCache`, `setTokenGetter`, `getToken` from `lib/clerk.ts` (B2) — `tokenCache` and `setTokenGetter` consumed in `_layout.tsx` (B3).
- `useAuthStore` reduced shape (D1): `rider`, `languagePref`, `fetchProfile`, `updateProfile`, `setLanguage`, `clear` — D2 audit + ClerkBridge in B3 use only these.
- `<NotImplementedScreen>` (E1) — used in E2.

All consistent.

**Known caveat:** The Fastify hook split in Task A8 (auth route runs without `requireRole`, others run with it) depends on hook-after-register semantics. If on first run the engineer finds `requireRole` is being applied to `/auth/me` anyway (and 404s the first call), the fix is to wrap the protected routes in an inner `app.register(async (scope) => { scope.addHook('preHandler', requireRole('rider')); ... })`. This is called out inline in A8.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-rider-auth-phase1.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Good for this plan because tasks are well-bounded and most have clear pass/fail signals (typecheck, vitest, smoke curl).

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Faster end-to-end but heavier on context.

**Which approach?**
