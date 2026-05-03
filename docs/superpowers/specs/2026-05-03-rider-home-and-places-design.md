# Rider Home Screen + Real-Maps Places — Design

**Date:** 2026-05-03
**Branch:** `feat/rider-auth-phase1` (or successor)
**Status:** Approved for planning

## Summary

Restore the rider app's home screen (map, current GPS, ambient driver drift, "Where to?" bar, recent/saved places) and wire it to the backend. Replace mock place data with real Google Places API calls proxied through the backend. Functional from app open through destination selection (handing off to the existing `confirm-destination` screen). Account tab gains real Home/Work/Custom place management persisted to Postgres.

The downstream booking flow (ride-selection → finding-driver → in-trip → receipt) is **out of scope** and remains under `NotImplementedScreen`.

## Why now

Rider auth (Phase 1) just landed. The home screen was reduced to `NotImplementedScreen` during that refactor (commit `4eb3082`), and the prior implementation in `6d85edd` used mock JSON via `@teeko/api`'s in-package handlers. To make demo + APAD walkthroughs land naturally and to start exercising real Google Maps usage and backend integration before the booking flow comes back, we restore the entry point and the discovery surface — but only as far as picking a destination.

## In Scope

1. Backend rider place routes (CRUD for saved + recent, plus Google Places proxy)
2. Backend `mapsService` real implementation (Places Autocomplete + Place Details)
3. `@teeko/api` `client/places.ts` real-fetch updates + `places-store` wiring
4. Rider app home tab restoration (idle state only)
5. Rider app search screen restoration with real autocomplete
6. Rider app account tab — Home / Work / Add custom place

## Out of Scope

- Ride-selection screen and everything downstream (matched / in-trip / receipt / ratings)
- Continue button on `confirm-destination` (stays inert / NotImplemented)
- Editing or renaming custom places (write-only UI; backend supports delete via REST but no UI)
- Web rider entry point
- Offline cache or optimistic updates beyond current in-memory Zustand state
- Place autocomplete on the docs site / driver app

## Architecture

### Backend (`apps/backend`)

#### `src/modules/maps/service.ts`
Real Google Places (New API) HTTP client. Holds `GOOGLE_MAPS_API_KEY` from env. Exposes:

```ts
mapsService.autocomplete({ q: string, near?: { lat: number, lng: number } }): Promise<Prediction[]>
mapsService.placeDetails(placeId: string): Promise<PlaceDetails>
```

Returns shapes mapped to `@teeko/shared`'s `Place` type before reaching the route layer (route does no transformation). Errors from Google bubble up as typed `MapsError` with HTTP status preserved (4xx → 4xx, 5xx → 502).

#### `src/modules/riders/service.ts`
Add CRUD over existing `savedPlaces` / `recentPlaces` Drizzle tables (schema already in `src/db/schema/riders.ts`, no migration needed):

```ts
ridersService.listSavedPlaces(userId): Promise<SavedPlace[]>
ridersService.upsertSavedPlace(userId, { label, address, lat, lng }): Promise<SavedPlace>
ridersService.deleteSavedPlace(userId, id): Promise<void>
ridersService.listRecentPlaces(userId, limit = 10): Promise<RecentPlace[]>
ridersService.pushRecentPlace(userId, { label, address, lat, lng }): Promise<RecentPlace>
```

Upsert semantics:
- `home` / `work`: unique on `(userId, label)` — replaces existing row.
- `custom`: always insert a new row.

`pushRecentPlace`: if a row with the same `(userId, address)` exists, update `lastUsedAt` to now; else insert. Trim to 10 most recent per user (delete older rows in the same transaction).

#### `src/api/rider/maps.routes.ts`
Replace stub with:

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/api/v1/rider/places/saved` | Clerk JWT | — | `Place[]` |
| POST | `/api/v1/rider/places/saved` | Clerk JWT | `{ label: 'home'\|'work'\|'custom', address, lat, lng }` | `Place` |
| DELETE | `/api/v1/rider/places/saved/:id` | Clerk JWT | — | `204` |
| GET | `/api/v1/rider/places/recent` | Clerk JWT | — | `Place[]` |
| POST | `/api/v1/rider/places/recent` | Clerk JWT | `{ label, address, lat, lng }` | `Place` |
| GET | `/api/v1/rider/places/search` | Clerk JWT | `q` (required, min 2 chars), `lat`, `lng` (optional bias) | `Place[]` (predictions) |
| GET | `/api/v1/rider/places/details` | Clerk JWT | `placeId` (required) | `Place` (full lat/lng) |

All routes use the existing rider auth preHandler. Search endpoint short-circuits with `[]` for queries shorter than 2 chars.

Region biasing for autocomplete: hard-coded country=`MY` (Malaysia). Bias to `near` if provided, else default to KL center.

#### Env
Add `GOOGLE_MAPS_API_KEY` to `apps/backend/.env.example` (already present per grep) — confirm it's read in `src/config`.

### Frontend — `packages/api`

#### `src/client/places.ts`
Update existing file. Functions return `Place[]` matching `@teeko/shared`:

```ts
recentPlaces(): Promise<Place[]>
savedPlaces(): Promise<Place[]>
searchPlaces(q: string, near?: { lat: number, lng: number }): Promise<Place[]>  // autocomplete
placeDetails(placeId: string): Promise<Place>                                    // resolve prediction
upsertSavedPlace(input: { label, address, lat, lng }): Promise<Place>
deleteSavedPlace(id: string): Promise<void>
pushRecentPlace(input: { label, address, lat, lng }): Promise<Place>
```

#### `src/stores/places-store.ts`
- Remove the temporary silent-404 fallback added on 2026-05-03; let real errors surface.
- `loadRecent` / `loadSaved` call backend on mount.
- `search(q)` calls `searchPlaces(q, near)` with optional pickup bias.
- New `selectPrediction(placeId)` → calls `placeDetails` and returns the resolved `Place` (caller decides what to do with it).
- `pushRecent(place)` updates local cache *and* calls `pushRecentPlace` fire-and-forget (errors logged, not thrown).
- `saveHomeOrWork(category, place)` → calls `upsertSavedPlace`. Promote `'custom'` as a third category.

### Frontend — `apps/rider`

#### Home tab — `app/(main)/(tabs)/index.tsx`
Restore from `6d85edd` but **strip trip-active branches**:
- Keep: map, current GPS request, ambient driver drift, `WhereToBar`, recent/saved rows, demo-controls long-press.
- Remove: `tripActive`, `driverPosition`, `trip`, `MockChatSheet`, `DriverCard`, `CallChatButtons`, `RouteMap`, `TripStatusHeader`, `TripProgressBar`, `RidesActionCard`, `destinationPreview`.
- Tap WhereTo or any recent/saved row → `router.push('/(main)/search')`.
- Tap saved Home/Work shortcut: if defined → push to `/(main)/confirm-destination` with that place set as destination; if undefined → push to `/(main)/search?intent=saveHome` (or `saveWork`).

#### Search screen — `app/(main)/search.tsx`
Restore the prior file. Changes:
- Search input is debounced (250 ms — keep prior value), now hitting the real autocomplete proxy.
- Each result is a Google Place prediction (no lat/lng yet). On select → call `placeDetails` to resolve, then:
  - `intent === 'saveHome'` → `upsertSavedPlace({ label: 'home', ... })` then `router.back()`
  - `intent === 'saveWork'` → same with `'work'`
  - `intent === 'saveCustom'` → same with `'custom'`
  - no intent → `setDestination(place)` + `pushRecent(place)` + `router.push('/(main)/confirm-destination')`
- Pickup bias: pass current GPS as `near`.

#### Confirm-destination — `app/(main)/confirm-destination.tsx`
**No changes** other than ensuring the "Continue" button is wired to `NotImplementedScreen` (or stays disabled). It already renders pickup + destination on a map.

#### Account tab — `app/(main)/(tabs)/account.tsx`
- Existing Home + Work rows: keep current behavior. Tap → `/(main)/search?intent=saveHome|saveWork`. Saved address renders as subtitle.
- Add a new "Add place" row under the Saved Places section, leading icon `add-location`. Tap → `/(main)/search?intent=saveCustom`.
- Custom places: render as additional rows above "Add place", each showing the address. (No edit/delete UI; tapping a row navigates to confirm-destination with it preselected as destination — same shortcut behavior as Home/Work.)

### Data Flow — destination select (happy path)

```
User taps WhereTo
 → search.tsx mounted
 → user types "klcc"
 → places-store.search("klcc", near=currentLatLng) [debounced 250ms]
 → GET /api/v1/rider/places/search?q=klcc&lat=...&lng=...
 → mapsService.autocomplete → Google Places API
 → predictions rendered
User taps "Suria KLCC"
 → places-store.selectPrediction(placeId)
 → GET /api/v1/rider/places/details?placeId=...
 → mapsService.placeDetails → Google Places API
 → resolved Place returned
 → setDestination(place) + pushRecent(place)
 → POST /api/v1/rider/places/recent (fire-and-forget)
 → router.push('/(main)/confirm-destination')
```

## Error Handling

- Google API quota / 5xx: return 502 from backend with `{ error: 'maps_unavailable' }`. Search screen shows inline "Search unavailable, try again" below the input. Other errors fall through to existing toast handling.
- Network failure on `loadSaved` / `loadRecent`: place lists render empty + a small "Couldn't load — pull to retry" hint. Don't block map.
- Missing GPS permission: home tab still renders centered on KL default, ambient drivers placed around that fallback.

## Testing (mockup-phase pragmatism)

- Backend: vitest unit tests on `mapsService.autocomplete` (mock `fetch` to Google) and `ridersService.upsertSavedPlace` (real Postgres via existing test harness if present; else mock the Drizzle client).
- Backend: route-level test that the search endpoint returns 400 on `q` shorter than 2 chars.
- Frontend: no new test infra — manual verification via Expo (signup → home renders map → tap WhereTo → search returns Google results → pick destination → confirm-destination shows route).

## Open Questions

None blocking. Will revisit billing surface for Google Places (cost monitoring) before v1.0.
