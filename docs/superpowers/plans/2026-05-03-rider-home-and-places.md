# Rider Home + Real-Maps Places Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the rider home screen (idle state only — map + WhereTo + recents/saved) and wire it end-to-end through new backend rider-place routes that proxy Google Places, ending at destination selection.

**Architecture:** Backend gains a real `mapsService` (Google Places Autocomplete + Details proxy) and `ridersService` CRUD over the existing `saved_places` / `recent_places` Drizzle tables. The `@teeko/api` client + Zustand store swap from mocks to real fetches. The rider app restores `index.tsx` (home) and `search.tsx` from git ref `6d85edd`, stripped to idle-only flow, plus an "Add place" entry in the account tab.

**Tech Stack:** Fastify, Zod, Drizzle (PostGIS), vitest (backend tests). Expo / React Native, Zustand, expo-location, react-native-maps, expo-router (frontend).

**Spec:** `docs/superpowers/specs/2026-05-03-rider-home-and-places-design.md`

---

## File Structure

**Backend (modify / replace stubs):**
- `apps/backend/src/config/env.ts` — add `GOOGLE_MAPS_API_KEY` to schema
- `apps/backend/src/modules/maps/service.ts` — real Google Places client (autocomplete + details)
- `apps/backend/src/modules/maps/index.ts` — export the service
- `apps/backend/src/modules/riders/repo.ts` — **NEW**: Drizzle queries for `savedPlaces` / `recentPlaces`
- `apps/backend/src/modules/riders/service.ts` — CRUD orchestration
- `apps/backend/src/modules/riders/index.ts` — export the service
- `apps/backend/src/api/rider/maps.routes.ts` — replace stub with real /places/* routes

**Backend (tests):**
- `apps/backend/tests/unit/maps.service.test.ts` — autocomplete + details, Google fetch mocked
- `apps/backend/tests/unit/riders.service.test.ts` — saved/recent CRUD with mocked db

**Frontend `@teeko/api`:**
- `packages/api/src/client/places.ts` — extend with details/upsert/delete/push/searchNear
- `packages/api/src/stores/places-store.ts` — call real backend, drop silent-404 fallback

**Frontend rider app:**
- `apps/rider/app/(main)/(tabs)/index.tsx` — restore (idle only)
- `apps/rider/app/(main)/search.tsx` — restore + real autocomplete + details flow
- `apps/rider/app/(main)/(tabs)/account.tsx` — add "Add place" row + custom-place rendering
- `apps/rider/app/(main)/confirm-destination.tsx` — wire Continue → NotImplementedScreen

---

## Task 1: Add `GOOGLE_MAPS_API_KEY` to env schema

**Files:**
- Modify: `apps/backend/src/config/env.ts`

- [ ] **Step 1: Edit env.ts to add the key**

Find the schema's last entry (the Auth0 block) and append a new section before the closing `})`:

```ts
  // Google Maps (server-side proxy — never exposed to mobile clients)
  GOOGLE_MAPS_API_KEY: z.string().min(20),
```

The full delta around the Auth0 block:

```ts
  // Auth0 — unused this phase, kept for forward compatibility
  AUTH0_DOMAIN: z.string().optional(),
  AUTH0_AUDIENCE: z.string().optional(),
  AUTH0_ISSUER: z.string().optional(),

  // Google Maps (server-side proxy — never exposed to mobile clients)
  GOOGLE_MAPS_API_KEY: z.string().min(20),
});
```

- [ ] **Step 2: Verify .env.example already has the key**

Run: `grep GOOGLE_MAPS_API_KEY apps/backend/.env.example`
Expected: a line `GOOGLE_MAPS_API_KEY=` (already present at line 16).

- [ ] **Step 3: Verify the schema parses**

Run: `pnpm --filter @teeko/backend exec tsc -noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/config/env.ts
git commit -m "feat(backend): require GOOGLE_MAPS_API_KEY in env schema"
```

---

## Task 2: Implement `mapsService.autocomplete` (Google Places New API)

**Files:**
- Modify: `apps/backend/src/modules/maps/service.ts`
- Test: `apps/backend/tests/unit/maps.service.test.ts`

The service uses Google's **Places API (New)** — POST `https://places.googleapis.com/v1/places:autocomplete`. It returns a list of `suggestions[].placePrediction` objects with `placeId`, `text.text`, `structuredFormat.mainText.text`, `structuredFormat.secondaryText.text`. We normalize to `{ id, name, address }` (no lat/lng yet — that requires a Details call).

- [ ] **Step 1: Write the failing autocomplete test**

Create `apps/backend/tests/unit/maps.service.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mapsService } from '../../src/modules/maps/service';

const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe('mapsService.autocomplete', () => {
  it('normalizes Google predictions into { id, name, address }', async () => {
    const googleResponse = {
      suggestions: [
        {
          placePrediction: {
            placeId: 'ChIJabc',
            text: { text: 'Suria KLCC, Kuala Lumpur, Malaysia' },
            structuredFormat: {
              mainText: { text: 'Suria KLCC' },
              secondaryText: { text: 'Kuala Lumpur, Malaysia' },
            },
          },
        },
      ],
    };
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify(googleResponse), { status: 200 }),
    ) as unknown as typeof fetch;

    const out = await mapsService.autocomplete({ q: 'klcc' });

    expect(out).toEqual([
      { id: 'ChIJabc', name: 'Suria KLCC', address: 'Kuala Lumpur, Malaysia' },
    ]);
  });

  it('passes location bias when near is provided', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ suggestions: [] }), { status: 200 }),
    ) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    await mapsService.autocomplete({ q: 'klcc', near: { lat: 3.158, lng: 101.711 } });

    const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.locationBias).toEqual({
      circle: {
        center: { latitude: 3.158, longitude: 101.711 },
        radius: 50000,
      },
    });
  });

  it('throws MapsError on Google 5xx', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('upstream error', { status: 503 }),
    ) as unknown as typeof fetch;
    await expect(mapsService.autocomplete({ q: 'klcc' })).rejects.toMatchObject({
      name: 'MapsError',
      statusCode: 502,
    });
  });
});
```

- [ ] **Step 2: Run test — confirm failure**

Run: `pnpm --filter @teeko/backend test -- maps.service`
Expected: FAIL — `mapsService.autocomplete is not a function`.

- [ ] **Step 3: Implement autocomplete in service.ts**

Replace `apps/backend/src/modules/maps/service.ts` entirely:

```ts
// modules/maps/service.ts
// Google Maps (Places New API) proxy. Routes call into this; the API key never
// leaves the server. Errors normalize to MapsError so route handlers can map
// them to HTTP cleanly.

import { env } from '../../config/env';

const PLACES_BASE = 'https://places.googleapis.com/v1';
const DEFAULT_BIAS_RADIUS_M = 50_000; // ~Greater KL
const REGION_CODE = 'MY';

export type MapsPrediction = {
  id: string;
  name: string;
  address: string;
};

export type MapsPlaceDetails = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export class MapsError extends Error {
  readonly name = 'MapsError';
  constructor(
    message: string,
    readonly statusCode: number,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

type AutocompleteInput = {
  q: string;
  near?: { lat: number; lng: number };
};

async function callGoogle(
  path: string,
  init: RequestInit & { fieldMask?: string },
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.fieldMask) headers['X-Goog-FieldMask'] = init.fieldMask;
  const res = await fetch(`${PLACES_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    // 4xx from Google → 502 (we sent a malformed request); 5xx → 502 too.
    throw new MapsError(`google places ${res.status}: ${body}`, 502);
  }
  return res.json();
}

export const mapsService = {
  async autocomplete(input: AutocompleteInput): Promise<MapsPrediction[]> {
    const body: Record<string, unknown> = {
      input: input.q,
      regionCode: REGION_CODE,
    };
    if (input.near) {
      body.locationBias = {
        circle: {
          center: { latitude: input.near.lat, longitude: input.near.lng },
          radius: DEFAULT_BIAS_RADIUS_M,
        },
      };
    }
    const json = (await callGoogle('/places:autocomplete', {
      method: 'POST',
      body: JSON.stringify(body),
    })) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId: string;
          text?: { text?: string };
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
        };
      }>;
    };
    const out: MapsPrediction[] = [];
    for (const s of json.suggestions ?? []) {
      const p = s.placePrediction;
      if (!p?.placeId) continue;
      const main = p.structuredFormat?.mainText?.text;
      const secondary = p.structuredFormat?.secondaryText?.text;
      out.push({
        id: p.placeId,
        name: main ?? p.text?.text ?? '',
        address: secondary ?? '',
      });
    }
    return out;
  },

  // placeDetails added in Task 3
};
```

- [ ] **Step 4: Run test — confirm pass**

Run: `pnpm --filter @teeko/backend test -- maps.service`
Expected: 3 passed (the 3 autocomplete tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/maps/service.ts apps/backend/tests/unit/maps.service.test.ts
git commit -m "feat(backend): mapsService.autocomplete via Google Places (New)"
```

---

## Task 3: Implement `mapsService.placeDetails`

**Files:**
- Modify: `apps/backend/src/modules/maps/service.ts`
- Modify: `apps/backend/tests/unit/maps.service.test.ts`

Google Places Details (New) is a GET to `/places/{placeId}` with a field mask. We need `id`, `displayName.text`, `formattedAddress`, `location.latitude`, `location.longitude`.

- [ ] **Step 1: Add the failing details test**

Append to `apps/backend/tests/unit/maps.service.test.ts`:

```ts
describe('mapsService.placeDetails', () => {
  it('resolves a placeId to lat/lng + canonical address', async () => {
    const googleResponse = {
      id: 'ChIJabc',
      displayName: { text: 'Suria KLCC' },
      formattedAddress: 'Kuala Lumpur City Centre, 50088 Kuala Lumpur, Malaysia',
      location: { latitude: 3.1581, longitude: 101.7117 },
    };
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify(googleResponse), { status: 200 }),
    ) as unknown as typeof fetch;

    const out = await mapsService.placeDetails('ChIJabc');

    expect(out).toEqual({
      id: 'ChIJabc',
      name: 'Suria KLCC',
      address: 'Kuala Lumpur City Centre, 50088 Kuala Lumpur, Malaysia',
      lat: 3.1581,
      lng: 101.7117,
    });
  });

  it('sends the correct field mask', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'x',
          displayName: { text: 'x' },
          formattedAddress: 'x',
          location: { latitude: 0, longitude: 0 },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    await mapsService.placeDetails('ChIJabc');

    const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = call[1].headers as Record<string, string>;
    expect(headers['X-Goog-FieldMask']).toBe(
      'id,displayName,formattedAddress,location',
    );
  });
});
```

- [ ] **Step 2: Run test — confirm failure**

Run: `pnpm --filter @teeko/backend test -- maps.service`
Expected: 2 new tests fail with `mapsService.placeDetails is not a function`.

- [ ] **Step 3: Implement placeDetails**

Add to `mapsService` in `apps/backend/src/modules/maps/service.ts` (replace the `// placeDetails added in Task 3` line):

```ts
  async placeDetails(placeId: string): Promise<MapsPlaceDetails> {
    const json = (await callGoogle(`/places/${encodeURIComponent(placeId)}`, {
      method: 'GET',
      fieldMask: 'id,displayName,formattedAddress,location',
    })) as {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
    };
    if (
      !json.id ||
      !json.location ||
      typeof json.location.latitude !== 'number' ||
      typeof json.location.longitude !== 'number'
    ) {
      throw new MapsError('google places details missing required fields', 502);
    }
    return {
      id: json.id,
      name: json.displayName?.text ?? '',
      address: json.formattedAddress ?? '',
      lat: json.location.latitude,
      lng: json.location.longitude,
    };
  },
```

- [ ] **Step 4: Run test — confirm pass**

Run: `pnpm --filter @teeko/backend test -- maps.service`
Expected: all 5 tests pass.

- [ ] **Step 5: Update module barrel**

Replace `apps/backend/src/modules/maps/index.ts` with:

```ts
export { mapsService, MapsError } from './service';
export type { MapsPrediction, MapsPlaceDetails } from './service';
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/maps/service.ts apps/backend/src/modules/maps/index.ts apps/backend/tests/unit/maps.service.test.ts
git commit -m "feat(backend): mapsService.placeDetails via Google Places (New)"
```

---

## Task 4: Riders repo — Drizzle queries for saved + recent places

**Files:**
- Create: `apps/backend/src/modules/riders/repo.ts`

PostGIS GEOGRAPHY columns store as WKT strings. Insert: `ST_GeogFromText('SRID=4326;POINT(<lng> <lat>)')`. Read coords back: `ST_X(location::geometry)`, `ST_Y(location::geometry)` — wrapped in `sql<number>` from Drizzle.

- [ ] **Step 1: Create repo.ts**

Create `apps/backend/src/modules/riders/repo.ts`:

```ts
// modules/riders/repo.ts
// Drizzle queries for the riders domain (saved/recent places).
// Private to the module; routes must go through the service.
import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '../../config/db';
import { recentPlaces, savedPlaces } from '../../db/schema/riders';

export type SavedLabel = 'home' | 'work' | 'custom';

export type StoredPlace = {
  id: string;
  label: SavedLabel | string;
  address: string;
  lat: number;
  lng: number;
};

const wktPoint = (lat: number, lng: number) =>
  sql`ST_GeogFromText(${`SRID=4326;POINT(${lng} ${lat})`})`;

const lngExpr = (col: typeof savedPlaces.location | typeof recentPlaces.location) =>
  sql<number>`ST_X(${col}::geometry)`;
const latExpr = (col: typeof savedPlaces.location | typeof recentPlaces.location) =>
  sql<number>`ST_Y(${col}::geometry)`;

// ---------- saved ----------

export async function listSavedPlacesForUser(userId: string): Promise<StoredPlace[]> {
  const rows = await db
    .select({
      id: savedPlaces.id,
      label: savedPlaces.label,
      address: savedPlaces.address,
      lat: latExpr(savedPlaces.location),
      lng: lngExpr(savedPlaces.location),
    })
    .from(savedPlaces)
    .where(eq(savedPlaces.userId, userId));
  return rows.map((r) => ({ ...r, lat: Number(r.lat), lng: Number(r.lng) }));
}

export async function upsertSavedPlace(input: {
  userId: string;
  label: SavedLabel;
  address: string;
  lat: number;
  lng: number;
}): Promise<StoredPlace> {
  if (input.label === 'home' || input.label === 'work') {
    // Replace existing row for this label.
    await db
      .delete(savedPlaces)
      .where(
        and(eq(savedPlaces.userId, input.userId), eq(savedPlaces.label, input.label)),
      );
  }
  const [row] = await db
    .insert(savedPlaces)
    .values({
      userId: input.userId,
      label: input.label,
      address: input.address,
      location: wktPoint(input.lat, input.lng) as unknown as string,
    })
    .returning({
      id: savedPlaces.id,
      label: savedPlaces.label,
      address: savedPlaces.address,
    });
  if (!row) throw new Error('insert savedPlaces returned no row');
  return { ...row, lat: input.lat, lng: input.lng };
}

export async function deleteSavedPlaceForUser(
  userId: string,
  id: string,
): Promise<void> {
  await db
    .delete(savedPlaces)
    .where(and(eq(savedPlaces.userId, userId), eq(savedPlaces.id, id)));
}

// ---------- recent ----------

export async function listRecentPlacesForUser(
  userId: string,
  limit = 10,
): Promise<StoredPlace[]> {
  const rows = await db
    .select({
      id: recentPlaces.id,
      label: recentPlaces.label,
      address: recentPlaces.address,
      lat: latExpr(recentPlaces.location),
      lng: lngExpr(recentPlaces.location),
    })
    .from(recentPlaces)
    .where(eq(recentPlaces.userId, userId))
    .orderBy(desc(recentPlaces.lastUsedAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, lat: Number(r.lat), lng: Number(r.lng) }));
}

export async function pushRecentPlaceForUser(input: {
  userId: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}): Promise<StoredPlace> {
  return await db.transaction(async (tx) => {
    // De-dupe by (userId, address): bump lastUsedAt if it exists, else insert.
    const existing = await tx
      .select({ id: recentPlaces.id })
      .from(recentPlaces)
      .where(
        and(
          eq(recentPlaces.userId, input.userId),
          eq(recentPlaces.address, input.address),
        ),
      )
      .limit(1);

    let row: { id: string; label: string; address: string };
    if (existing[0]) {
      const [updated] = await tx
        .update(recentPlaces)
        .set({ lastUsedAt: new Date() })
        .where(eq(recentPlaces.id, existing[0].id))
        .returning({
          id: recentPlaces.id,
          label: recentPlaces.label,
          address: recentPlaces.address,
        });
      if (!updated) throw new Error('update recentPlaces returned no row');
      row = updated;
    } else {
      const [inserted] = await tx
        .insert(recentPlaces)
        .values({
          userId: input.userId,
          label: input.label,
          address: input.address,
          location: wktPoint(input.lat, input.lng) as unknown as string,
        })
        .returning({
          id: recentPlaces.id,
          label: recentPlaces.label,
          address: recentPlaces.address,
        });
      if (!inserted) throw new Error('insert recentPlaces returned no row');
      row = inserted;
    }

    // Trim: keep top 10 by lastUsedAt; delete older rows.
    const keep = await tx
      .select({ id: recentPlaces.id })
      .from(recentPlaces)
      .where(eq(recentPlaces.userId, input.userId))
      .orderBy(desc(recentPlaces.lastUsedAt))
      .limit(10);
    if (keep.length === 10) {
      const keepIds = keep.map((r) => r.id);
      await tx
        .delete(recentPlaces)
        .where(
          and(
            eq(recentPlaces.userId, input.userId),
            sql`${recentPlaces.id} NOT IN ${keepIds}`,
          ),
        );
    }

    return { ...row, lat: input.lat, lng: input.lng };
  });
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm --filter @teeko/backend exec tsc -noEmit`
Expected: no errors. (No tests yet — repo is exercised via service tests in Task 5.)

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/riders/repo.ts
git commit -m "feat(backend): riders repo for saved/recent places"
```

---

## Task 5: Riders service — orchestration + tests (DB mocked)

**Files:**
- Modify: `apps/backend/src/modules/riders/service.ts`
- Modify: `apps/backend/src/modules/riders/index.ts`
- Test: `apps/backend/tests/unit/riders.service.test.ts`

The service is a thin wrapper that maps stored rows to the wire `Place` shape (`@teeko/shared`'s `Place` interface). Tests mock the repo functions.

- [ ] **Step 1: Write the failing service test**

Create `apps/backend/tests/unit/riders.service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/riders/repo', () => ({
  listSavedPlacesForUser: vi.fn(),
  upsertSavedPlace: vi.fn(),
  deleteSavedPlaceForUser: vi.fn(),
  listRecentPlacesForUser: vi.fn(),
  pushRecentPlaceForUser: vi.fn(),
}));

import * as repo from '../../src/modules/riders/repo';
import { ridersService } from '../../src/modules/riders/service';

describe('ridersService.listSavedPlaces', () => {
  it('maps stored rows to the wire Place shape with category', async () => {
    vi.mocked(repo.listSavedPlacesForUser).mockResolvedValue([
      { id: 'a', label: 'home', address: '1 KLCC', lat: 3.158, lng: 101.711 },
      { id: 'b', label: 'work', address: 'Mont Kiara', lat: 3.171, lng: 101.651 },
      { id: 'c', label: 'custom', address: 'Mid Valley', lat: 3.118, lng: 101.677 },
    ]);
    const out = await ridersService.listSavedPlaces('user-1');
    expect(out).toEqual([
      { id: 'a', name: '1 KLCC', address: '1 KLCC', lat: 3.158, lng: 101.711, category: 'home' },
      { id: 'b', name: 'Mont Kiara', address: 'Mont Kiara', lat: 3.171, lng: 101.651, category: 'work' },
      { id: 'c', name: 'Mid Valley', address: 'Mid Valley', lat: 3.118, lng: 101.677, category: 'saved' },
    ]);
  });
});

describe('ridersService.upsertSavedPlace', () => {
  it('passes through to repo with the right label', async () => {
    vi.mocked(repo.upsertSavedPlace).mockResolvedValue({
      id: 'new', label: 'home', address: '1 KLCC', lat: 3.158, lng: 101.711,
    });
    const out = await ridersService.upsertSavedPlace('user-1', {
      label: 'home', address: '1 KLCC', lat: 3.158, lng: 101.711,
    });
    expect(repo.upsertSavedPlace).toHaveBeenCalledWith({
      userId: 'user-1', label: 'home', address: '1 KLCC', lat: 3.158, lng: 101.711,
    });
    expect(out.category).toBe('home');
  });
});

describe('ridersService.pushRecentPlace', () => {
  it('passes through to repo and returns recent-categorized Place', async () => {
    vi.mocked(repo.pushRecentPlaceForUser).mockResolvedValue({
      id: 'r1', label: 'Suria KLCC', address: '1 KLCC', lat: 3.158, lng: 101.711,
    });
    const out = await ridersService.pushRecentPlace('user-1', {
      label: 'Suria KLCC', address: '1 KLCC', lat: 3.158, lng: 101.711,
    });
    expect(out).toEqual({
      id: 'r1', name: 'Suria KLCC', address: '1 KLCC', lat: 3.158, lng: 101.711, category: 'recent',
    });
  });
});
```

- [ ] **Step 2: Run test — confirm failure**

Run: `pnpm --filter @teeko/backend test -- riders.service`
Expected: FAIL — `ridersService.listSavedPlaces is not a function`.

- [ ] **Step 3: Implement service**

Replace `apps/backend/src/modules/riders/service.ts`:

```ts
// modules/riders/service.ts
// Saved + recent places orchestration. Routes call into this; the repo stays
// private to the module. Maps stored rows to the wire Place shape.
import type { Place, PlaceCategory } from '@teeko/shared';

import {
  deleteSavedPlaceForUser,
  listRecentPlacesForUser,
  listSavedPlacesForUser,
  pushRecentPlaceForUser,
  upsertSavedPlace as repoUpsertSavedPlace,
  type SavedLabel,
  type StoredPlace,
} from './repo';

function savedToPlace(row: StoredPlace): Place {
  const category: PlaceCategory =
    row.label === 'home' ? 'home' : row.label === 'work' ? 'work' : 'saved';
  return {
    id: row.id,
    name: row.address, // saved rows store only address; reuse as display name
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    category,
  };
}

function recentToPlace(row: StoredPlace): Place {
  return {
    id: row.id,
    name: row.label,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    category: 'recent',
  };
}

export type SavedPlaceInput = {
  label: SavedLabel;
  address: string;
  lat: number;
  lng: number;
};

export type RecentPlaceInput = {
  label: string;
  address: string;
  lat: number;
  lng: number;
};

export const ridersService = {
  async listSavedPlaces(userId: string): Promise<Place[]> {
    const rows = await listSavedPlacesForUser(userId);
    return rows.map(savedToPlace);
  },

  async upsertSavedPlace(userId: string, input: SavedPlaceInput): Promise<Place> {
    const row = await repoUpsertSavedPlace({ userId, ...input });
    return savedToPlace(row);
  },

  async deleteSavedPlace(userId: string, id: string): Promise<void> {
    await deleteSavedPlaceForUser(userId, id);
  },

  async listRecentPlaces(userId: string, limit = 10): Promise<Place[]> {
    const rows = await listRecentPlacesForUser(userId, limit);
    return rows.map(recentToPlace);
  },

  async pushRecentPlace(userId: string, input: RecentPlaceInput): Promise<Place> {
    const row = await pushRecentPlaceForUser({ userId, ...input });
    return recentToPlace(row);
  },
};
```

- [ ] **Step 4: Update module barrel**

Replace `apps/backend/src/modules/riders/index.ts`:

```ts
export { ridersService } from './service';
export type { SavedPlaceInput, RecentPlaceInput } from './service';
```

- [ ] **Step 5: Run test — confirm pass**

Run: `pnpm --filter @teeko/backend test -- riders.service`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/riders/service.ts apps/backend/src/modules/riders/index.ts apps/backend/tests/unit/riders.service.test.ts
git commit -m "feat(backend): ridersService for saved/recent places"
```

---

## Task 6: Wire `/places/*` routes

**Files:**
- Modify: `apps/backend/src/api/rider/maps.routes.ts`

The route registers under the rider scope (already gated by `clerkAuthVerify` + `requireRole('rider')`), so `req.user.id` is guaranteed by this point. No prefix is set on register, so URLs are `/api/v1/rider/places/...`.

- [ ] **Step 1: Replace maps.routes.ts**

Replace `apps/backend/src/api/rider/maps.routes.ts` entirely:

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { MapsError, mapsService } from '../../modules/maps';
import { ridersService } from '../../modules/riders';

const SavePlaceBody = z.object({
  label: z.enum(['home', 'work', 'custom']),
  address: z.string().min(1).max(500),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

const RecentPlaceBody = z.object({
  label: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

const SearchQuery = z.object({
  q: z.string().min(2).max(200),
  lat: z.coerce.number().gte(-90).lte(90).optional(),
  lng: z.coerce.number().gte(-180).lte(180).optional(),
});

const DetailsQuery = z.object({
  placeId: z.string().min(1).max(500),
});

export async function routes(app: FastifyInstance) {
  // ---- saved ----
  app.get('/places/saved', async (req) => {
    return ridersService.listSavedPlaces(req.user!.id);
  });

  app.post('/places/saved', async (req) => {
    const input = SavePlaceBody.parse(req.body);
    return ridersService.upsertSavedPlace(req.user!.id, input);
  });

  app.delete<{ Params: { id: string } }>('/places/saved/:id', async (req, reply) => {
    await ridersService.deleteSavedPlace(req.user!.id, req.params.id);
    return reply.code(204).send();
  });

  // ---- recent ----
  app.get('/places/recent', async (req) => {
    return ridersService.listRecentPlaces(req.user!.id);
  });

  app.post('/places/recent', async (req) => {
    const input = RecentPlaceBody.parse(req.body);
    return ridersService.pushRecentPlace(req.user!.id, input);
  });

  // ---- google proxy ----
  app.get('/places/search', async (req, reply) => {
    const query = SearchQuery.parse(req.query);
    try {
      const predictions = await mapsService.autocomplete({
        q: query.q,
        near:
          query.lat !== undefined && query.lng !== undefined
            ? { lat: query.lat, lng: query.lng }
            : undefined,
      });
      // Predictions don't have lat/lng yet — caller resolves via /places/details.
      return predictions.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        lat: 0,
        lng: 0,
        category: 'search' as const,
      }));
    } catch (err) {
      if (err instanceof MapsError) {
        return reply.code(err.statusCode).send({ error: 'maps_unavailable' });
      }
      throw err;
    }
  });

  app.get('/places/details', async (req, reply) => {
    const query = DetailsQuery.parse(req.query);
    try {
      const place = await mapsService.placeDetails(query.placeId);
      return {
        id: place.id,
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        category: 'search' as const,
      };
    } catch (err) {
      if (err instanceof MapsError) {
        return reply.code(err.statusCode).send({ error: 'maps_unavailable' });
      }
      throw err;
    }
  });
}
```

- [ ] **Step 2: Verify routes compile**

Run: `pnpm --filter @teeko/backend exec tsc -noEmit`
Expected: no errors.

- [ ] **Step 3: Boot the backend and smoke-test**

Run (in one terminal): `pnpm --filter @teeko/backend dev`

Run (in another, with a valid Clerk JWT in `$JWT`):
```bash
curl -s http://localhost:3000/api/v1/rider/places/saved -H "Authorization: Bearer $JWT"
```
Expected: `[]` (no saved places yet for this user). 200.

Run: `curl -s "http://localhost:3000/api/v1/rider/places/search?q=klcc" -H "Authorization: Bearer $JWT"`
Expected: array of `{id,name,address,lat:0,lng:0,category:"search"}` for KLCC. 200.

(If GOOGLE_MAPS_API_KEY is not set in `.env`, set it first — the search call returns 502 otherwise.)

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/api/rider/maps.routes.ts
git commit -m "feat(backend): rider /places/* routes (saved/recent + Google proxy)"
```

---

## Task 7: `@teeko/api` — extend places client

**Files:**
- Modify: `packages/api/src/client/places.ts`

- [ ] **Step 1: Replace places.ts**

Replace `packages/api/src/client/places.ts`:

```ts
// client/places.ts
// Real-fetch shadow of mock/handlers/places.ts. Backed by the rider /places/*
// routes, which proxy Google Places for search/details and persist saved/recent
// rows in Postgres.

import type { Place } from '@teeko/shared';

import { api } from './_fetch';

export async function recentPlaces(): Promise<Place[]> {
  return api<Place[]>('/api/v1/rider/places/recent');
}

export async function savedPlaces(): Promise<Place[]> {
  return api<Place[]>('/api/v1/rider/places/saved');
}

export async function searchPlaces(
  query: string,
  near?: { lat: number; lng: number },
): Promise<Place[]> {
  const params = new URLSearchParams({ q: query });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lng', String(near.lng));
  }
  return api<Place[]>(`/api/v1/rider/places/search?${params.toString()}`);
}

export async function placeDetails(placeId: string): Promise<Place> {
  const params = new URLSearchParams({ placeId });
  return api<Place>(`/api/v1/rider/places/details?${params.toString()}`);
}

export async function upsertSavedPlace(input: {
  label: 'home' | 'work' | 'custom';
  address: string;
  lat: number;
  lng: number;
}): Promise<Place> {
  return api<Place>('/api/v1/rider/places/saved', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteSavedPlace(id: string): Promise<void> {
  await api<void>(`/api/v1/rider/places/saved/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function pushRecentPlace(input: {
  label: string;
  address: string;
  lat: number;
  lng: number;
}): Promise<Place> {
  return api<Place>('/api/v1/rider/places/recent', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
```

- [ ] **Step 2: Verify _fetch supports method/body**

Run: `grep -n "options\\?" packages/api/src/client/_fetch.ts | head`
Expected: see `options?: RequestInit` (or equivalent). If `_fetch.ts` doesn't accept a second arg, stop and ask — but the existing `auth.ts`/profile clients use POST through it, so it should.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @teeko/api exec tsc -noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/client/places.ts
git commit -m "feat(api): places client — search/details/upsert/delete/push"
```

---

## Task 8: `@teeko/api` — places-store wired to real backend

**Files:**
- Modify: `packages/api/src/stores/places-store.ts`

- [ ] **Step 1: Replace places-store.ts**

Replace `packages/api/src/stores/places-store.ts`:

```ts
import type { Place } from '@teeko/shared';
import { create } from 'zustand';

import * as placesApi from '../client/places';

export type PlacesState = {
  recent: Place[];
  saved: Place[];
  results: Place[];
  searching: boolean;
  loadRecent: () => Promise<void>;
  loadSaved: () => Promise<void>;
  search: (q: string, near?: { lat: number; lng: number }) => Promise<void>;
  selectPrediction: (placeId: string) => Promise<Place>;
  pushRecent: (p: Place) => Promise<void>;
  saveHomeOrWork: (
    category: 'home' | 'work' | 'custom',
    place: Place,
  ) => Promise<void>;
  clearResults: () => void;
};

export const usePlacesStore = create<PlacesState>((set, get) => ({
  recent: [],
  saved: [],
  results: [],
  searching: false,

  async loadRecent() {
    try {
      set({ recent: await placesApi.recentPlaces() });
    } catch (err) {
      console.warn('[places] loadRecent failed', err);
      set({ recent: [] });
    }
  },

  async loadSaved() {
    try {
      set({ saved: await placesApi.savedPlaces() });
    } catch (err) {
      console.warn('[places] loadSaved failed', err);
      set({ saved: [] });
    }
  },

  async search(q, near) {
    set({ searching: true });
    try {
      const results = await placesApi.searchPlaces(q, near);
      set({ results, searching: false });
    } catch (err) {
      console.warn('[places] search failed', err);
      set({ results: [], searching: false });
    }
  },

  async selectPrediction(placeId) {
    return placesApi.placeDetails(placeId);
  },

  async pushRecent(p) {
    // Optimistic local update.
    const next = [p, ...get().recent.filter((r) => r.id !== p.id)].slice(0, 10);
    set({ recent: next });
    // Server update — fire and log; don't throw.
    placesApi
      .pushRecentPlace({ label: p.name, address: p.address, lat: p.lat, lng: p.lng })
      .catch((err) => console.warn('[places] pushRecent server failed', err));
  },

  async saveHomeOrWork(category, place) {
    const saved = await placesApi.upsertSavedPlace({
      label: category,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    });
    // Replace any existing row of the same category (home/work) and prepend.
    const others =
      category === 'custom'
        ? get().saved
        : get().saved.filter((p) => p.category !== category);
    set({ saved: [saved, ...others] });
  },

  clearResults() {
    set({ results: [] });
  },
}));
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @teeko/api exec tsc -noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/stores/places-store.ts
git commit -m "feat(api): places-store wired to real backend; add selectPrediction"
```

---

## Task 9: Restore home tab (idle-only)

**Files:**
- Modify: `apps/rider/app/(main)/(tabs)/index.tsx`

We restore the prior file (git ref `6d85edd`) but **strip all trip-active branches**: no driver matching, no in-trip UI, no chat sheet, no destination preview polyline. Tap WhereTo / a recent / a saved row → `router.push('/(main)/search')`. Saved Home/Work shortcuts: if defined → set as destination + push to `/(main)/confirm-destination`; if undefined → push to `/(main)/search?intent=saveHome|saveWork`.

- [ ] **Step 1: Replace index.tsx**

Replace `apps/rider/app/(main)/(tabs)/index.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { useLocationStore, usePlacesStore, useTripStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { MapView, type MapViewHandle, Marker } from '@teeko/maps';
import type { Place } from '@teeko/shared';
import { Icon, Pressable, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { CarMarker } from '../../../components/CarMarker';
import { RecentPlaceRow } from '../../../components/RecentPlaceRow';
import { WhereToBar } from '../../../components/WhereToBar';

const NEARBY_OFFSETS = [
  { id: 'n1', dLat: 0.0018, dLng: 0.0022, heading: 34, phase: 0.0 },
  { id: 'n2', dLat: -0.0014, dLng: 0.0031, heading: 118, phase: 1.1 },
  { id: 'n3', dLat: 0.0026, dLng: -0.0019, heading: 202, phase: 2.3 },
  { id: 'n4', dLat: -0.0024, dLng: -0.0027, heading: 280, phase: 3.7 },
  { id: 'n5', dLat: 0.0009, dLng: -0.0036, heading: 65, phase: 4.9 },
];
const NEARBY_DRIFT = 0.00025;
const DEFAULT_ZOOM = { latitudeDelta: 0.018, longitudeDelta: 0.018 };

export default function HomeTab() {
  const router = useRouter();
  const t = useT();
  const recent = usePlacesStore((s) => s.recent);
  const saved = usePlacesStore((s) => s.saved);
  const loadRecent = usePlacesStore((s) => s.loadRecent);
  const loadSaved = usePlacesStore((s) => s.loadSaved);
  const setDestination = useTripStore((s) => s.setDestination);
  const currentLatLng = useLocationStore((s) => s.current);
  const setCurrent = useLocationStore((s) => s.setCurrent);
  const setPermission = useLocationStore((s) => s.setPermission);

  const mapRef = useRef<MapViewHandle>(null);
  const snappedToUser = useRef(false);

  const [driftTick, setDriftTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setDriftTick((x) => x + 1), 600);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    loadRecent();
    loadSaved();
  }, [loadRecent, loadSaved]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermission(
          status === 'granted'
            ? 'granted'
            : status === 'denied'
              ? 'denied'
              : 'undetermined',
        );
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setCurrent({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (!snappedToUser.current) {
          mapRef.current?.animateToRegion(
            {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              ...DEFAULT_ZOOM,
            },
            400,
          );
          snappedToUser.current = true;
        }
      } catch {
        // ignore — fall back to default centre
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setCurrent, setPermission]);

  const homePlace = saved.find((p) => p.category === 'home');
  const workPlace = saved.find((p) => p.category === 'work');

  const goToSearch = () => router.push('/(main)/search');

  const onShortcut = (place: Place | undefined, intent: 'saveHome' | 'saveWork') => {
    if (place) {
      setDestination(place);
      router.push('/(main)/confirm-destination');
    } else {
      router.push({ pathname: '/(main)/search', params: { intent } });
    }
  };

  const onRecent = (p: Place) => {
    setDestination(p);
    router.push('/(main)/confirm-destination');
  };

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-1">
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: currentLatLng.lat,
            longitude: currentLatLng.lng,
            ...DEFAULT_ZOOM,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {NEARBY_OFFSETS.map((o) => {
            const drift = Math.sin(driftTick * 0.4 + o.phase) * NEARBY_DRIFT;
            return (
              <Marker
                key={o.id}
                coordinate={{
                  latitude: currentLatLng.lat + o.dLat + drift,
                  longitude: currentLatLng.lng + o.dLng + drift,
                }}
              >
                <CarMarker heading={o.heading} />
              </Marker>
            );
          })}
        </MapView>
      </View>

      <SafeAreaView edges={['bottom']} className="bg-surface">
        <ScrollView
          className="border-t border-border"
          contentContainerStyle={{ paddingVertical: 12 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-gutter">
            <WhereToBar onPress={goToSearch} />
          </View>

          <View className="mt-3 flex-row gap-3 px-gutter">
            <Shortcut
              icon="home"
              label={homePlace?.address ? t('home.home') : t('home.setHome')}
              onPress={() => onShortcut(homePlace, 'saveHome')}
            />
            <Shortcut
              icon="work"
              label={workPlace?.address ? t('home.work') : t('home.setWork')}
              onPress={() => onShortcut(workPlace, 'saveWork')}
            />
          </View>

          {recent.length > 0 ? (
            <View className="mt-4">
              <Text
                weight="bold"
                className="px-gutter pb-2 text-xs uppercase tracking-wide text-ink-secondary"
              >
                {t('home.recent')}
              </Text>
              {recent.slice(0, 3).map((p) => (
                <RecentPlaceRow key={p.id} place={p} onPress={() => onRecent(p)} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Shortcut({
  icon,
  label,
  onPress,
}: {
  icon: 'home' | 'work';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      className="h-12 flex-1 flex-row items-center rounded-full bg-muted px-4 active:opacity-80"
    >
      <Icon name={icon} size={18} color="#111111" />
      <Text weight="medium" className="ml-2 text-sm">
        {label}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Add missing i18n keys**

For each locale file in `packages/i18n/src/locales/{en,ms,zh,ta}.json`, ensure the following keys exist under a `home` namespace; if missing, add them:

```json
  "home": {
    "home": "Home",
    "work": "Work",
    "setHome": "Set home",
    "setWork": "Set work",
    "recent": "Recent"
  }
```

(Use translated strings for ms/zh/ta — copy the prior values from `6d85edd` if they existed; else use the English fallback; the i18n loader will surface a warning if missing.)

- [ ] **Step 3: Verify components and types exist**

Run: `pnpm --filter @teeko/rider exec tsc -noEmit`
Expected: no errors. If `WhereToBar`, `RecentPlaceRow`, `CarMarker` are missing, restore them from git ref `6d85edd`:

```bash
git show 6d85edd:apps/rider/components/WhereToBar.tsx > apps/rider/components/WhereToBar.tsx
git show 6d85edd:apps/rider/components/RecentPlaceRow.tsx > apps/rider/components/RecentPlaceRow.tsx
git show 6d85edd:apps/rider/components/CarMarker.tsx > apps/rider/components/CarMarker.tsx
```

Re-run typecheck after restoring.

- [ ] **Step 4: Smoke test in Expo**

Run: `pnpm --filter @teeko/rider start` and reload the app on device/emulator.
Expected: signing in lands on the home tab; map renders; current GPS centers; ambient cars drift; WhereTo bar + Home/Work shortcuts visible; tapping WhereTo opens the search screen (still has prior content for now).

- [ ] **Step 5: Commit**

```bash
git add apps/rider/app/\(main\)/\(tabs\)/index.tsx apps/rider/components/ packages/i18n/src/locales/
git commit -m "feat(rider): restore home tab (idle-only) wired to real places"
```

---

## Task 10: Restore search screen with real autocomplete + details flow

**Files:**
- Modify: `apps/rider/app/(main)/search.tsx`

The screen has three intents:
- no intent → set destination, push to `confirm-destination`
- `saveHome` / `saveWork` / `saveCustom` → call `saveHomeOrWork(...)`, then `router.back()`

When the user taps a search result, we resolve via `selectPrediction(placeId)` first to get lat/lng, then act.

- [ ] **Step 1: Replace search.tsx**

Replace `apps/rider/app/(main)/search.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';

import { useLocationStore, usePlacesStore, useTripStore } from '@teeko/api';
import type { Place } from '@teeko/shared';
import { Icon, Input, Pressable, ScreenContainer, Spinner, Text } from '@teeko/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { RecentPlaceRow } from '../../components/RecentPlaceRow';
import { SavedPlaceRow } from '../../components/SavedPlaceRow';

type SearchIntent = 'saveHome' | 'saveWork' | 'saveCustom' | undefined;

export default function SearchScreen() {
  const router = useRouter();
  const { intent: intentParam } = useLocalSearchParams<{ intent?: string }>();
  const intent: SearchIntent =
    intentParam === 'saveHome' ||
    intentParam === 'saveWork' ||
    intentParam === 'saveCustom'
      ? intentParam
      : undefined;

  const setDestination = useTripStore((s) => s.setDestination);
  const currentLatLng = useLocationStore((s) => s.current);

  const recent = usePlacesStore((s) => s.recent);
  const saved = usePlacesStore((s) => s.saved);
  const results = usePlacesStore((s) => s.results);
  const searching = usePlacesStore((s) => s.searching);
  const search = usePlacesStore((s) => s.search);
  const clearResults = usePlacesStore((s) => s.clearResults);
  const selectPrediction = usePlacesStore((s) => s.selectPrediction);
  const pushRecent = usePlacesStore((s) => s.pushRecent);
  const saveHomeOrWork = usePlacesStore((s) => s.saveHomeOrWork);

  const [query, setQuery] = useState('');
  const [resolving, setResolving] = useState(false);
  const debounced = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounced.current) clearTimeout(debounced.current);
    const q = query.trim();
    if (q.length < 2) {
      clearResults();
      return;
    }
    debounced.current = setTimeout(
      () => search(q, currentLatLng),
      250,
    );
    return () => {
      if (debounced.current) clearTimeout(debounced.current);
    };
  }, [query, search, clearResults, currentLatLng]);

  const homePlace = useMemo(() => saved.find((p) => p.category === 'home'), [saved]);
  const workPlace = useMemo(() => saved.find((p) => p.category === 'work'), [saved]);

  const onSelectPlace = async (place: Place) => {
    let resolved = place;
    // Search results have lat=0/lng=0; resolve them via Place Details first.
    if (place.category === 'search' && place.lat === 0 && place.lng === 0) {
      try {
        setResolving(true);
        resolved = await selectPrediction(place.id);
      } catch {
        setResolving(false);
        return;
      }
      setResolving(false);
    }

    if (intent === 'saveHome') {
      await saveHomeOrWork('home', resolved);
      router.back();
      return;
    }
    if (intent === 'saveWork') {
      await saveHomeOrWork('work', resolved);
      router.back();
      return;
    }
    if (intent === 'saveCustom') {
      await saveHomeOrWork('custom', resolved);
      router.back();
      return;
    }
    pushRecent(resolved);
    setDestination(resolved);
    router.push('/(main)/confirm-destination');
  };

  const headerTitle =
    intent === 'saveHome'
      ? 'Set home'
      : intent === 'saveWork'
        ? 'Set work'
        : intent === 'saveCustom'
          ? 'Add place'
          : 'Set destination';

  const showingResults = query.trim().length >= 2;

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center pb-3 pt-2">
        <Pressable
          onPress={() => router.back()}
          haptic="selection"
          className="-ml-2 p-2"
        >
          <Icon name="arrow-back" size={24} color="#111111" />
        </Pressable>
        <Text weight="bold" className="ml-1 text-lg">
          {headerTitle}
        </Text>
      </View>

      <View className="pb-3">
        <Input
          placeholder="Search address or place"
          value={query}
          onChangeText={setQuery}
          autoFocus
          leftIcon="search"
        />
      </View>

      {resolving ? (
        <View className="items-center py-3">
          <Spinner />
        </View>
      ) : null}

      {showingResults ? (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={results}
          keyExtractor={(p) => p.id}
          ListEmptyComponent={
            searching ? (
              <View className="items-center py-6">
                <Spinner />
              </View>
            ) : (
              <Text tone="secondary" className="py-6 text-center text-sm">
                No matches
              </Text>
            )
          }
          renderItem={({ item }) => (
            <RecentPlaceRow place={item} onPress={() => onSelectPlace(item)} />
          )}
        />
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={recent}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={
            intent === undefined ? (
              <View>
                {homePlace ? (
                  <SavedPlaceRow
                    label="Home"
                    place={homePlace}
                    onPress={() => onSelectPlace(homePlace)}
                  />
                ) : null}
                {workPlace ? (
                  <SavedPlaceRow
                    label="Work"
                    place={workPlace}
                    onPress={() => onSelectPlace(workPlace)}
                  />
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <Text tone="secondary" className="py-6 text-center text-sm">
              Start typing to search
            </Text>
          }
          renderItem={({ item }) => (
            <RecentPlaceRow place={item} onPress={() => onSelectPlace(item)} />
          )}
        />
      )}
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Restore SavedPlaceRow if missing**

Run: `ls apps/rider/components/SavedPlaceRow.tsx` — if missing:

```bash
git show 6d85edd:apps/rider/components/SavedPlaceRow.tsx > apps/rider/components/SavedPlaceRow.tsx
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @teeko/rider exec tsc -noEmit`
Expected: no errors.

- [ ] **Step 4: Smoke test**

In Expo: tap WhereTo on home → search "klcc" → results appear from Google → tap one → confirm-destination renders with map showing pickup + KLCC destination.

- [ ] **Step 5: Commit**

```bash
git add apps/rider/app/\(main\)/search.tsx apps/rider/components/SavedPlaceRow.tsx
git commit -m "feat(rider): search screen — real Google autocomplete + details"
```

---

## Task 11: Account tab — add custom place + persist

**Files:**
- Modify: `apps/rider/app/(main)/(tabs)/account.tsx`

Add:
1. A list of any custom saved places (category === `'saved'`) above the "Add place" row.
2. An "Add place" row at the bottom of the Saved Places section.

Tapping a custom row sets it as destination and pushes to confirm-destination (same shortcut behavior as Home/Work).

- [ ] **Step 1: Edit account.tsx — add custom-place rendering + Add row**

In `apps/rider/app/(main)/(tabs)/account.tsx`, replace the existing `Section title={t('account.savedPlaces')}` block (currently the Home + Work rows) with:

```tsx
        <Section title={t('account.savedPlaces')}>
          <ListRow
            leadingIcon="home"
            title={home?.address ? t('account.home') : t('account.enterHome')}
            subtitle={home?.address}
            onPress={() => onShortcutPress(home, 'saveHome')}
          />
          <ListRow
            leadingIcon="work"
            title={work?.address ? t('account.work') : t('account.enterWork')}
            subtitle={work?.address}
            onPress={() => onShortcutPress(work, 'saveWork')}
          />
          {customPlaces.map((p) => (
            <ListRow
              key={p.id}
              leadingIcon="place"
              title={p.address}
              onPress={() => onCustomPress(p)}
            />
          ))}
          <ListRow
            leadingIcon="add-location"
            title={t('account.addPlace')}
            onPress={() =>
              router.push({
                pathname: '/(main)/search',
                params: { intent: 'saveCustom' },
              })
            }
            noDivider
          />
        </Section>
```

In the same file, just above the `return (`, add:

```tsx
  const customPlaces = saved.filter((p) => p.category === 'saved');
  const setDestination = useTripStore((s) => s.setDestination);

  const onShortcutPress = (
    place: typeof home,
    intent: 'saveHome' | 'saveWork',
  ) => {
    if (place) {
      setDestination(place);
      router.push('/(main)/confirm-destination');
    } else {
      router.push({ pathname: '/(main)/search', params: { intent } });
    }
  };

  const onCustomPress = (place: NonNullable<typeof home>) => {
    setDestination(place);
    router.push('/(main)/confirm-destination');
  };
```

Add `useTripStore` to the existing `@teeko/api` import:

```tsx
import { useAuthStore, usePlacesStore, useTripStore } from '@teeko/api';
```

Define `home` and `work` near the existing `loadSaved` block (the file already does `saved.find(...)` for home/work — keep those).

- [ ] **Step 2: Add `addPlace` i18n key**

In `packages/i18n/src/locales/{en,ms,zh,ta}.json`, add to the `account` namespace:
```json
  "addPlace": "Add place"
```
(Translate appropriately for ms/zh/ta.)

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @teeko/rider exec tsc -noEmit`
Expected: no errors.

- [ ] **Step 4: Smoke test**

In Expo:
1. Account tab → tap "Set home" → search "Mont Kiara" → select → returns to Account, "Home" row now shows the address.
2. Reload the app → "Home" still shows the address (persisted in Postgres).
3. Account tab → tap "Add place" → search and select → returns to Account, new custom row appears.
4. Tap the custom row → confirm-destination opens with that place as destination.

- [ ] **Step 5: Commit**

```bash
git add apps/rider/app/\(main\)/\(tabs\)/account.tsx packages/i18n/src/locales/
git commit -m "feat(rider): account tab — custom places + persistence"
```

---

## Task 12: Confirm-destination — wire Continue to NotImplemented

The `confirm-destination` screen already exists and renders the route. Per spec, the "Continue" button is out of scope; it should not silently break.

**Files:**
- Modify: `apps/rider/app/(main)/confirm-destination.tsx`

- [ ] **Step 1: Read the file to find the Continue handler**

Run: `grep -n "Continue\\|onPress\\|router.push" apps/rider/app/\\(main\\)/confirm-destination.tsx | head`

- [ ] **Step 2: Wire Continue to NotImplementedScreen**

Replace whatever the Continue button's `onPress` currently does with:

```tsx
onPress={() => router.push('/(main)/not-implemented?domain=ride-selection')}
```

If a `not-implemented` route doesn't exist, route to a stub by reusing the existing `NotImplementedScreen` component on a new sibling file `apps/rider/app/(main)/not-implemented.tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router';

import { NotImplementedScreen } from '../../components/NotImplementedScreen';

export default function NotImplementedRoute() {
  const { domain } = useLocalSearchParams<{ domain?: string }>();
  return <NotImplementedScreen domain={(domain ?? 'feature') as 'home'} />;
}
```

- [ ] **Step 3: Smoke test**

In Expo: search → pick destination → confirm-destination → tap Continue → NotImplementedScreen renders. Back button returns to confirm-destination.

- [ ] **Step 4: Commit**

```bash
git add apps/rider/app/\(main\)/confirm-destination.tsx apps/rider/app/\(main\)/not-implemented.tsx
git commit -m "feat(rider): confirm-destination Continue → NotImplementedScreen"
```

---

## Task 13: End-to-end manual verification

No new files. Walk the full happy path on a real device, with a real Google Maps key set in `apps/backend/.env`.

- [ ] **Step 1: Boot backend**

Run: `pnpm --filter @teeko/backend dev`
Expected: server up, no env errors.

- [ ] **Step 2: Boot rider app**

Run: `pnpm --filter @teeko/rider start` and open on device/emulator (logged in).

- [ ] **Step 3: Walk the happy path**

- [ ] Home tab loads, map centers on real GPS.
- [ ] Tap WhereTo → search "klcc" → predictions return from Google.
- [ ] Tap a prediction → spinner briefly shown → routed to confirm-destination with map showing route.
- [ ] Back to Home → KLCC now appears in "Recent".
- [ ] Account tab → set Home → reload app → Home still set.
- [ ] Account tab → Add place → search/select → custom place row appears.
- [ ] Tap a custom place → confirm-destination opens with it as destination.
- [ ] Continue on confirm-destination → NotImplementedScreen renders.

- [ ] **Step 4: Verify backend tests still pass**

Run: `pnpm --filter @teeko/backend test`
Expected: all green.

- [ ] **Step 5: Final commit (only if anything was patched during verification)**

```bash
git status
# if dirty:
git add -A
git commit -m "fix(rider): smoke-test follow-ups"
```

---

## Self-Review Notes

- **Spec coverage:** Routes (Task 6), maps service (Tasks 2-3), riders service (Tasks 4-5), client (Task 7), store (Task 8), home tab (Task 9), search (Task 10), account custom places (Task 11), confirm-destination Continue gating (Task 12), env (Task 1), e2e (Task 13). ✓
- **No placeholders:** every code step has actual code; tests have actual assertions; commands have expected output.
- **Type consistency:** `Place` from `@teeko/shared` used everywhere with `category` field; `SavedLabel` matches `'home'|'work'|'custom'` across repo/service/route; `selectPrediction` returns `Place` everywhere it appears.
- **Out-of-scope explicitly handled:** ride-selection / matching / in-trip / receipt all stay behind NotImplementedScreen via Task 12's Continue gate.
