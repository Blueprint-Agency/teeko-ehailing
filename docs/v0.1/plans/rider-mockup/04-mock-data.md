# 04 — Mock data & stores

`@teeko/api` is the **only** place mock data is loaded or mutated. No component imports JSON directly; everything goes through a store selector or a mock handler function. This keeps the eventual swap to a real backend a find-and-replace inside one package.

## 1. Package layout

```
packages/api/
├── src/
│   ├── index.ts                 # re-exports handlers, stores, types
│   ├── mock/
│   │   ├── delay.ts             # simulateLatency(min=400, max=1200): Promise<void>
│   │   ├── data/
│   │   │   ├── riders.json
│   │   │   ├── drivers.json
│   │   │   ├── vehicles.json
│   │   │   ├── places.json      # seeded KL/PJ addresses (+saved Home/Work)
│   │   │   ├── recent-places.json
│   │   │   ├── trips.json       # past ride history (for Rides tab)
│   │   │   ├── fare-estimates.json  # per ride-type + per distance bucket
│   │   │   └── payment-methods.json
│   │   └── handlers/
│   │       ├── auth.ts          # sendOtp, verifyOtp, me
│   │       ├── places.ts        # search, recent, savedPlaces
│   │       ├── trips.ts         # estimate, book, cancel, complete, history, byId
│   │       └── payments.ts      # list, setDefault
│   ├── stores/
│   │   ├── auth-store.ts
│   │   ├── location-store.ts
│   │   ├── trip-store.ts        # current booking + active trip state machine
│   │   ├── places-store.ts      # recent + saved places
│   │   ├── payments-store.ts
│   │   └── ui-store.ts          # toasts, bottom sheets, error banners
│   └── types/
│       └── index.ts             # re-export from @teeko/shared/types
└── package.json
```

## 2. Simulated latency

```ts
export const simulateLatency = (min = 400, max = 1200) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
```

All handlers `await simulateLatency()` before returning. Finding-driver handler uses a longer 3–6 s delay (PRD §4.6: 60 s max; a 4 s demo feels realistic without dragging).

## 3. Core types (in `@teeko/shared/src/types`)

Authoritative shapes — stores and handlers both import from here. Use zod schemas in `@teeko/shared/src/schemas` so mock JSON can be validated at load.

```ts
// trimmed sketches — full types land during Phase 04
type Rider    = { id; name; phone; email?; rating; languagePref };
type Driver   = { id; name; photoUrl; rating; vehicle: Vehicle; plate };
type Vehicle  = { model; colour; seats; category: RideCategory };
type RideCategory = 'go' | 'comfort' | 'xl' | 'premium' | 'bike';
type Place    = { id; name; address; lat; lng; category?: 'home' | 'work' };
type Fare     = { rideType: RideCategory; amountMyr: number; etaMin: number };
type TripStatus = 'pending' | 'searching' | 'matched' | 'arrived' | 'in_trip' | 'completed' | 'cancelled';
type Trip     = { id; status: TripStatus; rider; driver?; vehicle?; pickup: Place; destination: Place; rideType; fare; paymentMethodId; createdAt; startedAt?; completedAt?; cancelledAt?; cancelReason?; rating?; comment? };
type PaymentMethod = { id; kind: 'card' | 'tng' | 'grabpay' | 'googlepay'; label; last4? };
```

## 4. Trip state machine (`trip-store`)

Single Zustand store drives the entire booking → trip → complete journey.

```
idle
  └─ setPickup, setDestination → ready
       └─ selectRideType, selectPayment → quoted
            └─ book() → searching     (finding-driver screen)
                 ├─ cancel() → idle
                 ├─ timeout(60s) → no_drivers (error state)
                 └─ autoMatch(3–6s) → matched (driver-matched screen)
                      └─ simulate(~15s) → arrived
                           └─ startTrip() → in_trip
                                └─ simulate(ride duration) → completed
                                     └─ rate() → idle (history updated)
```

The "simulate" transitions are timer-driven in the mock. Timers live in the store and are cancelled on `cancel()` / unmount.

## 5. Fake live tracking

A single helper `simulateDriverMovement(polyline, durationMs, onTick)`:

- Accepts a pre-baked `polyline` (lat/lng array) saved per seed trip.
- Interpolates position on a 250 ms tick.
- `trip-store` holds `driverPosition: { lat, lng, heading }` and components (map screens) subscribe.

Polylines are pre-computed from seed pickup → destination pairs; store them in `trips.json` as `routePolyline: [[lat,lng], ...]`. No Google Directions API call needed.

## 6. Seed data rules

- **Location:** centre all seed places in Klang Valley (KL Sentral, Mid Valley, One Utama, KLIA, Bangsar, Sunway, Petaling Jaya). Matches the target market.
- **Currency:** RM, integer or 2-decimal (e.g., `RM 25.00`), no range, per PRD §4.5.
- **Ratings:** drivers 4.5–5.0, realistic distribution.
- **Plate format:** Malaysian plates (e.g., `WA 1234 X`, `VGL 7788`).
- **Languages on drivers:** mark driver `languages: ['ms','en']` for realism (shown in driver info if design wants it).

## 7. Demo reset

`ui-store.resetDemo()` clears auth, recents, current trip, rating state back to the seed JSON. Exposed via:

- `teeko://demo/reset` deep link
- Account → (hidden dev row, tap Teeko logo 5× to reveal during demos)

## 8. Error + empty simulation

- `places.search('nothing')` returns `[]` → exercises empty state.
- `trips.book()` with `rideType='bike'` at night returns "no drivers" if the demo script wants to show the error state.
- `payments.charge()` fails randomly 1 in 20 if `ui-store.debugChaos === true`.
