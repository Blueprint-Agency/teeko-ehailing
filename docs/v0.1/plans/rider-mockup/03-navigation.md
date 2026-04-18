# 03 — Navigation shell

Mirrors `teeko-frontend-architecture.md` §5.1. Build this skeleton **before** any screen implementation — every screen below gets rendered as a placeholder in its real route first, then filled in during its phase.

## 1. Expo Router tree

```
apps/rider/app/
├── _layout.tsx                 # Root <Stack>; loads fonts, i18n, splash gate
├── +not-found.tsx
├── index.tsx                   # Splash gate → redirect to (auth) or (main)/(tabs)
│
├── (auth)/
│   ├── _layout.tsx             # Stack, no header
│   ├── phone.tsx
│   └── otp.tsx
│
└── (main)/
    ├── _layout.tsx             # Stack — hosts tabs + modal flows
    ├── (tabs)/
    │   ├── _layout.tsx         # Bottom tabs: Home | Rides (default) | Account
    │   ├── index.tsx           # Home
    │   ├── rides.tsx
    │   └── account.tsx
    ├── search.tsx              # Destination search (full-screen modal)
    ├── confirm-destination.tsx
    ├── ride-selection.tsx
    ├── finding-driver.tsx
    ├── driver-matched.tsx
    ├── in-trip.tsx
    ├── trip-complete.tsx
    └── receipt/
        └── [id].tsx
```

## 2. Initial route gate (`app/index.tsx`)

```tsx
// Splash gate
// 1. Wait for fonts + i18n init
// 2. Read auth state from useAuthStore
// 3. Redirect: authed → /(main)/(tabs)/rides  |  else → /(auth)/phone
```

Landing on `(tabs)/rides` matches PRD §3.1 ("Rides tab is the default screen when the app opens").

## 3. Tab bar (`(main)/(tabs)/_layout.tsx`)

| Tab key | Route | Icon (lucide) | Label key |
|---------|-------|---------------|-----------|
| `index` | Home | `home` | `tabs.home` |
| `rides` (initialRoute) | Rides | `clock` | `tabs.rides` |
| `account` | Account | `user` | `tabs.account` |

- Active color: `primary.DEFAULT`; inactive: `ink.faint`.
- No hamburger menu (PRD §4.2).
- Hide tab bar on `search`, `confirm-destination`, `ride-selection`, `finding-driver`, `driver-matched`, `in-trip`, `trip-complete`, `receipt/[id]` — they're pushed onto the `(main)` stack above the tabs layer with `headerShown: false`.

## 4. Screen-to-route map

| PRD screen | Route |
|------------|-------|
| Sign-Up / Login (4.1) | `/(auth)/phone`, `/(auth)/otp` |
| Home (4.2) | `/(main)/(tabs)/` |
| Destination search (4.3) | `/(main)/search` |
| Destination confirmation (4.4) | `/(main)/confirm-destination` |
| Ride type selection (4.5) | `/(main)/ride-selection` |
| Finding driver (4.6) | `/(main)/finding-driver` |
| Driver matched (4.7) | `/(main)/driver-matched` |
| Driver arrived (4.8) | `/(main)/driver-matched` (same route; view changes via `trip.status`) |
| In-trip (4.9) | `/(main)/in-trip` |
| Trip completed (4.10) | `/(main)/trip-complete` |
| Receipt (4.11) | `/(main)/receipt/[id]` |
| Rides tab (4.12) | `/(main)/(tabs)/rides` |
| Account tab (4.13) | `/(main)/(tabs)/account` |

> Driver-matched and Driver-arrived are one screen that renders different copy based on `useTripStore().status`.

## 5. Navigation contracts

- **Booking flow** is a linear push chain: `search → confirm-destination → ride-selection → finding-driver → driver-matched → in-trip → trip-complete`.
- **Cancel** on `finding-driver` / `driver-matched`: `router.dismissAll()` then route home.
- **Trip completed "Done"**: `router.dismissAll()` then tabs/rides.
- **Receipt** is always a push from Rides tab — never auto-opened.
- **Hardware back**:
  - Allowed on search, confirm-destination, ride-selection.
  - Disabled on finding-driver / driver-matched / in-trip / trip-complete — Android back should prompt the cancellation sheet.

## 6. Deep linking (future-proofing, cheap to wire now)

`app.json`:

```json
{ "expo": { "scheme": "teeko" } }
```

Supported dev-time paths (via `npx uri-scheme open teeko://…`):

| URI | Effect |
|-----|--------|
| `teeko://trip/<id>` | Jump to a mock in-trip state (great for demos) |
| `teeko://demo/reset` | Clear all stores back to seed state |

Deep link handler lives in `apps/rider/app/_layout.tsx` — listen via `expo-linking` and dispatch to the right store.

## 7. Placeholder strategy

During Phase 01, stub every screen above with a one-liner:

```tsx
export default function Screen() { return <ScreenContainer><Text>ride-selection</Text></ScreenContainer>; }
```

This lets us verify the tab bar, modal stacking, and back behavior **before** any feature work starts.
