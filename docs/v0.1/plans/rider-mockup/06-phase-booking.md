# 06 — Phase B: Booking

Covers PRD §4.2 → §4.6. Outcome: user can go from Home → pick a destination → choose ride type → see the "Finding your driver..." loop.

## 1. Screens

| Route | PRD | Core composition |
|-------|-----|------------------|
| `(main)/(tabs)/index.tsx` (Home) | §4.2 | Headline, **Rides card**, **"Where to?"** search bar, **Recent places** list |
| `(main)/search.tsx` | §4.3 | Full-screen modal; pickup field + destination field + Home/Work shortcuts + recent + search results |
| `(main)/confirm-destination.tsx` | §4.4 | Map (top half) with draggable pin + bottom sheet with location name + "Confirm destination" CTA |
| `(main)/ride-selection.tsx` | §4.5 | Map with route polyline, ride-type list (Go / Comfort / XL / Premium / Bike), payment selector, dynamic CTA |
| `(main)/finding-driver.tsx` | §4.6 | Dimmed map bg, centered searching animation, "Finding your driver...", Cancel |

## 2. New rider components (under `apps/rider/components/`)

| Component | Used by | Notes |
|-----------|---------|-------|
| `RidesActionCard` | Home | Big tappable card with vehicle illustration + "Let's get moving" subtitle |
| `WhereToBar` | Home, search | Pill-shaped input with leading search icon |
| `RecentPlaceRow` | Home, search | `ListRow` with clock icon |
| `SavedPlaceRow` | search | Home + Work shortcuts; shows "Enter home/work location" if unset |
| `MapWithPin` | confirm-destination | `MapView` + centred draggable pin (or fixed pin + movable region) |
| `RouteMap` | ride-selection, driver-matched, in-trip | `MapView` + polyline pickup→destination + two markers |
| `RideTypeRow` | ride-selection | Vehicle illustration, ETA, seats, price; red outline when selected |
| `PaymentSelectorRow` | ride-selection | Current method + chevron → opens `PaymentMethodSheet` |
| `PaymentMethodSheet` | ride-selection | Bottom sheet of card / TNG / GrabPay / Google Pay |
| `SearchingIndicator` | finding-driver | Pulsing concentric circles over a car icon |

## 3. Mock hooks

```ts
// Home
const recent = usePlaces(s => s.recent);          // from places-store
const saved  = usePlaces(s => s.saved);

// search
const results = usePlaceSearch(query);            // debounced 250ms

// confirm-destination
const { pickup, destination, setPickup, setDestination } = useTripStore();

// ride-selection
const fares = useFareEstimates(pickup, destination);   // returns Fare[] per rideType
const { selectRideType, selectPayment, book } = useTripStore();

// finding-driver
const { status, cancel } = useTripStore();
useEffect(() => { if (status === 'matched') router.replace('/(main)/driver-matched'); }, [status]);
```

## 4. Interaction details from PRD

- **Home** has no hamburger; bottom tabs only (§4.2).
- Tapping Recent Place **pre-fills destination** and routes straight to `confirm-destination` (skip search screen).
- Pickup defaults to current GPS (location-store), editable.
- Map in confirm-destination has a **floating "current location" button** (bottom-right) + back arrow top-left.
- Ride-selection top bar shows `pickup → destination` (truncated) + `X` close + `+` add stop (add-stop is disabled/visible-but-inert in v0.1 — carpool is deferred).
- Selected ride type has a **red outline**; CTA copy updates dynamically: "Select Teeko Go" → "Select Teeko Comfort".
- Price shown as a **single amount**, no range (PRD §4.5).
- Payment selector opens a bottom sheet; default preselects last-used (persisted in payments-store).

## 5. Finding-driver behavior

- Runs up to 60s (PRD §4.6). Mock cuts this short to ~4s for demo realism (configurable in `ui-store.demoSpeed`).
- Shows `Cancel` text button under spinner.
- On 60s timeout: replace UI with "No drivers available. Please try again." + "Try again" CTA → retries `trip-store.book()`.
- On cancel: `dismissAll()` back to Home.

## 6. Copy (keys in `@teeko/i18n`)

Draft English in this phase, fill other locales in Phase E.

| Key | English |
|-----|---------|
| `home.headline` | Travel Easily with Teeko. |
| `home.rides.label` | Rides |
| `home.rides.subtitle` | Let's get moving |
| `home.whereTo` | Where to? |
| `search.pickup` | Pickup |
| `search.destination` | Destination |
| `confirm.cta` | Confirm destination |
| `rideSelection.cta` | Select {{rideType}} |
| `finding.text` | Finding your driver... |
| `finding.cancel` | Cancel |
| `finding.none.title` | No drivers available |
| `finding.none.cta` | Try again |

## 7. Checkpoint demo

End of Phase B: user can book through to the finding-driver loop, cancel, retry, and hit the "no drivers" fallback on demand (`ui-store.forceNoDrivers = true`).
