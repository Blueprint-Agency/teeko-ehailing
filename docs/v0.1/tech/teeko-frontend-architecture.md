# Teeko — Frontend Monorepo Architecture

> **Version:** 1.0
> **Date:** 2026-04-11
> **Status:** Draft
> **Scope:** Frontend architecture only (v0.1 mockup phase — no backend)

---

## Contents

1. [Architecture Decision](#1-architecture-decision)
2. [Monorepo Tooling](#2-monorepo-tooling)
3. [Top-Level Folder Structure](#3-top-level-folder-structure)
4. [Shared Packages](#4-shared-packages)
5. [Rider App](#5-rider-app)
6. [Driver App](#6-driver-app)
7. [Dependency Graph](#7-dependency-graph)
8. [Critical Configuration](#8-critical-configuration)
9. [Implementation Notes](#9-implementation-notes)

---

## 1. Architecture Decision

### Two Separate Expo Apps in a Monorepo

The rider and driver frontends are **two separate Expo applications** that share code through internal packages — not a single app with role switching.

### Why Two Apps

| Reason | Detail |
|--------|--------|
| **Different UX paradigms** | Rider is a consumer app (clean, exploratory). Driver is a work tool (glanceable, action-oriented, used while driving). |
| **Separate store listings** | Apple App Store and Google Play require separate app bundles with distinct bundle IDs. |
| **Different theming** | Rider is light-mode only with a red primary color. Driver supports dark mode (critical for night driving). |
| **Smaller bundles** | Rider never ships earnings dashboards or document upload code. Driver never ships destination search or payment management. |
| **Independent releases** | A driver hotfix should not require re-testing and re-submitting the rider app. |

### Why NOT One App

A single app with role switching would mean:
- Runtime theme branching adding complexity and bundle size
- Every screen from both apps in one binary (~2x bundle size)
- Coupled release cycles — a driver bug blocks rider releases
- Harder to reason about navigation (driver has onboarding flow, rider does not)

---

## 2. Monorepo Tooling

| Tool | Role |
|------|------|
| **pnpm** | Package manager with native workspace support. Strict dependency isolation. |
| **Turborepo** | Build orchestrator. Parallelises `build`, `lint`, `typecheck` across packages. Caches results. |
| **TypeScript** | Type safety across all packages and apps. Shared base config in `@teeko/config`. |
| **ESLint + Prettier** | Consistent code style across the monorepo. Shared configs in `@teeko/config`. |

### Root Scripts

```
pnpm dev:rider    → turbo dev --filter=@teeko/rider
pnpm dev:driver   → turbo dev --filter=@teeko/driver
pnpm build        → turbo build
pnpm lint         → turbo lint
pnpm typecheck    → turbo typecheck
```

---

## 3. Top-Level Folder Structure

```
teeko/
├── apps/
│   ├── rider/                         # Rider consumer app (Expo)
│   │   ├── app/                       # Expo Router file-based routes
│   │   ├── assets/                    # Images, fonts, animations
│   │   ├── components/                # Rider-only components
│   │   ├── app.json                   # Expo config (bundle ID, splash, icons)
│   │   ├── metro.config.js            # Metro + NativeWind + monorepo
│   │   ├── tailwind.config.ts         # Rider theme (red primary, light only)
│   │   ├── global.css                 # Tailwind directives
│   │   ├── tsconfig.json
│   │   ├── babel.config.js
│   │   └── package.json
│   │
│   └── driver/                        # Driver work-tool app (Expo)
│       ├── app/                       # Expo Router file-based routes
│       ├── assets/                    # Images, fonts, animations
│       ├── components/                # Driver-only components
│       ├── app.json                   # Expo config (bundle ID, splash, icons)
│       ├── metro.config.js            # Metro + NativeWind + monorepo
│       ├── tailwind.config.ts         # Driver theme (dark mode enabled)
│       ├── global.css                 # Tailwind directives
│       ├── tsconfig.json
│       ├── babel.config.js
│       └── package.json
│
├── packages/
│   ├── ui/                            # @teeko/ui — shared UI components
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── shared/                        # @teeko/shared — types, hooks, utils
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── maps/                          # @teeko/maps — map components
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── i18n/                          # @teeko/i18n — internationalization
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api/                           # @teeko/api — mock API + Zustand stores
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── config/                        # @teeko/config — shared tooling configs
│       ├── tsconfig/
│       ├── eslint/
│       ├── prettier.config.js
│       └── package.json
│
├── pnpm-workspace.yaml
├── turbo.json
├── package.json                       # Root — workspaces + devDeps only
├── .gitignore
├── .eslintrc.js
└── .prettierrc.js
```

---

## 4. Shared Packages

### 4.1 `@teeko/ui` — Shared UI Components

Reusable UI primitives and components consumed by both rider and driver apps. All components use NativeWind and must define both light and dark class variants so the driver app can activate dark mode.

```
packages/ui/src/
├── components/
│   ├── Button.tsx                  # Variants: primary (red), secondary, outline, text, icon
│   ├── Input.tsx                   # Text input with label, error, phone number variant
│   ├── OTPInput.tsx                # 6-digit code input with auto-focus advance
│   ├── BottomSheet.tsx             # Draggable bottom sheet (ride selection, driver info)
│   ├── Modal.tsx                   # Centered modal dialog
│   ├── Card.tsx                    # Content card with shadow
│   ├── Avatar.tsx                  # Circular profile photo with initials fallback
│   ├── Badge.tsx                   # Status badges (Online, Offline, Pending, Approved)
│   ├── StarRating.tsx              # Interactive (tap to rate) + display-only modes
│   ├── LoadingSpinner.tsx          # Animated searching indicator
│   ├── CountdownTimer.tsx          # Visual countdown (driver request 15–20s timer)
│   ├── Divider.tsx                 # Horizontal separator
│   ├── IconButton.tsx              # Circular icon button (call, chat, SOS)
│   ├── Toast.tsx                   # Notification toast
│   ├── EmptyState.tsx              # Empty list with illustration
│   ├── HeaderBar.tsx               # Screen header with optional back/close
│   ├── SafeAreaWrapper.tsx         # SafeAreaView wrapper
│   ├── ListItem.tsx                # Configurable list row (icon + label + value + chevron)
│   └── SearchBar.tsx               # Search input with icon
├── primitives/
│   ├── Text.tsx                    # Themed text with size/weight/color variants
│   ├── View.tsx                    # Themed view
│   ├── Pressable.tsx               # Themed pressable with press states
│   └── Image.tsx                   # Image with loading placeholder
└── index.ts                        # Barrel export
```

---

### 4.2 `@teeko/shared` — Types, Hooks, Utils, Constants

Core shared logic with no React Native UI dependencies.

```
packages/shared/src/
├── types/
│   ├── user.ts                     # User, Rider, Driver, DriverStatus, OnboardingStep
│   ├── trip.ts                     # Trip, TripStatus, RideCategory, CancellationReason
│   ├── vehicle.ts                  # Vehicle, VehicleDocument, DocumentType, DocumentStatus
│   ├── payment.ts                  # PaymentMethod, PaymentType (CARD, TNG, GRABPAY, GOOGLE_PAY)
│   ├── location.ts                 # Coordinate, Address, Place, Region
│   ├── rating.ts                   # Rating, Review
│   ├── earnings.ts                 # Earnings, Payout, PayoutStatus, Commission, Incentive
│   └── common.ts                   # Language (EN, MS, ZH_HANS, TA), shared utility types
├── hooks/
│   ├── useAuth.ts                  # Mock auth state (isAuthenticated, user, login, logout)
│   ├── useLocation.ts              # Current GPS coordinates via expo-location
│   ├── useTimer.ts                 # Countdown timer (request timeout, cancellation window)
│   ├── useDebounce.ts              # Debounced value for search input
│   └── useKeyboard.ts              # Keyboard visible/height state
├── utils/
│   ├── format-currency.ts          # formatRM(amount) → "RM 25.00"
│   ├── format-date.ts              # Malaysian locale date/time formatting
│   ├── format-distance.ts          # km/m with appropriate unit
│   ├── format-duration.ts          # "8 min", "1 hr 23 min"
│   ├── format-phone.ts             # "+60 12-345 6789" formatting
│   ├── validate-phone.ts           # Malaysian phone number validation (01x pattern)
│   └── generate-id.ts              # UUID-like mock ID generator
├── constants/
│   ├── colors.ts                   # RIDER_COLORS (red, light theme), DRIVER_COLORS (dark mode)
│   ├── ride-categories.ts          # Go, Comfort, XL, Premium, Bike — labels, icons, seat counts
│   └── config.ts                   # DRIVER_REQUEST_TIMEOUT_SECONDS: 20, MAX_SEARCH_SECONDS: 60, etc.
└── index.ts
```

**TypeScript Enums (key types):**

```typescript
// trip.ts
enum TripStatus {
  REQUESTED = "REQUESTED",
  MATCHING = "MATCHING",
  DRIVER_EN_ROUTE = "DRIVER_EN_ROUTE",
  DRIVER_ARRIVED = "DRIVER_ARRIVED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

enum RideCategory {
  GO = "GO",           // Economy — 4 seats
  COMFORT = "COMFORT", // Mid-tier — 4 seats
  XL = "XL",           // Groups — 6 seats
  PREMIUM = "PREMIUM", // Premium — 4 seats
  BIKE = "BIKE",       // Motorbike taxi — 1 seat
}

// payment.ts
enum PaymentType {
  CARD = "CARD",
  TNG = "TNG",
  GRABPAY = "GRABPAY",
  GOOGLE_PAY = "GOOGLE_PAY",
}

// common.ts
enum Language {
  EN = "en",
  MS = "ms",
  ZH_HANS = "zh-Hans",
  TA = "ta",
}
```

---

### 4.3 `@teeko/maps` — Map Components

Shared Google Maps integration used by both apps for trip tracking and location display.

```
packages/maps/src/
├── components/
│   ├── MapView.tsx                 # Pre-configured react-native-maps GoogleMap
│   ├── PickupMarker.tsx            # Green pickup pin
│   ├── DropoffMarker.tsx           # Red destination pin
│   ├── DriverMarker.tsx            # Car icon that animates along route
│   ├── RoutePolyline.tsx           # Draws route between two coordinates
│   ├── CurrentLocationButton.tsx   # Floating "my location" FAB
│   └── ETABubble.tsx               # ETA label on route polyline
├── hooks/
│   ├── useMapRegion.ts             # Track/set visible map region
│   ├── useAnimatedMarker.ts        # Animate marker position smoothly
│   ├── useMockDriverLocation.ts    # setInterval-based driver movement simulation (v0.1)
│   └── useFitToCoordinates.ts      # Auto-zoom to fit pickup + dropoff
├── utils/
│   ├── coordinates.ts              # Distance calculations, midpoint, bounds
│   ├── mock-routes.ts              # Hardcoded polylines for KL demo routes
│   └── decode-polyline.ts          # Google polyline encoding decoder
└── index.ts
```

---

### 4.4 `@teeko/i18n` — Internationalization

4-language support as required by both PRDs: English, Bahasa Malaysia, Simplified Chinese, Tamil.

```
packages/i18n/src/
├── locales/
│   ├── en.json                     # English (default)
│   ├── ms.json                     # Bahasa Malaysia
│   ├── zh-Hans.json                # Simplified Chinese
│   └── ta.json                     # Tamil
├── i18n.ts                         # i18next init with react-i18next, device language detection
├── LanguageProvider.tsx             # React context provider wrapping i18next
├── useTranslation.ts               # Re-export of useTranslation hook
├── types.ts                        # TranslationKeys type generated from en.json structure
└── index.ts
```

**Translation key structure** (excerpt from `en.json`):

```json
{
  "common": {
    "continue": "Continue",
    "cancel": "Cancel",
    "done": "Done",
    "confirm": "Confirm",
    "back": "Back",
    "search": "Search",
    "loading": "Loading..."
  },
  "auth": {
    "enterPhone": "Enter your phone number",
    "enterOtp": "Enter the code sent to {{phone}}",
    "resendCode": "Resend code"
  },
  "home": {
    "headline": "Travel Easily with Teeko.",
    "whereTo": "Where to?"
  },
  "trip": {
    "findingDriver": "Finding your driver...",
    "driverOnTheWay": "Driver is on the way",
    "driverArrived": "Your driver has arrived",
    "headingTo": "Heading to {{destination}}",
    "tripCompleted": "Trip completed",
    "rateDriver": "How was your ride with {{driverName}}?"
  }
}
```

---

### 4.5 `@teeko/api` — Mock API Client + Zustand Stores

API interface layer with mock implementations for v0.1. All mock handlers include simulated network delay. Zustand stores manage client-side state.

```
packages/api/src/
├── client.ts                       # ApiClient interface with method signatures
├── mock/
│   ├── data/
│   │   ├── riders.json             # 5–10 mock rider profiles
│   │   ├── drivers.json            # 5–10 mock drivers with photos, ratings, vehicles
│   │   ├── trips.json              # 20+ mock completed trips for ride history
│   │   ├── vehicles.json           # Mock vehicles with document statuses
│   │   ├── fare-estimates.json     # Pre-calculated fares: { routeId, category, fareRM }
│   │   ├── earnings.json           # Mock weekly earnings, per-trip breakdown
│   │   ├── places.json             # 30+ KL locations for search autocomplete
│   │   └── incentives.json         # Mock campaigns (activation bonus, daily targets)
│   └── handlers/
│       ├── auth.ts                 # sendOtp(phone) → delay → success; verifyOtp(code) → mock user
│       ├── trips.ts                # getTrips(), createTrip(), cancelTrip(), completeTrip()
│       ├── drivers.ts              # getDriver(), updateStatus(), submitDocuments()
│       ├── riders.ts               # getRider(), updateProfile(), getSavedAddresses()
│       ├── payments.ts             # getPaymentMethods(), addPaymentMethod()
│       ├── earnings.ts             # getEarnings(), getWeeklySummary(), requestCashout()
│       └── places.ts               # searchPlaces(query) → filtered mock results
├── stores/
│   ├── auth-store.ts               # { user, isAuthenticated, role, login(), logout() }
│   ├── trip-store.ts               # { currentTrip, tripHistory, tripStatus, ... }
│   ├── driver-store.ts             # { isOnline, currentRequest, earnings, documents, ... }
│   ├── location-store.ts           # { currentLocation, pickupLocation, dropoffLocation, ... }
│   └── ui-store.ts                 # { isLoading, activeModal, toastMessage, ... }
└── index.ts
```

---

### 4.6 `@teeko/config` — Shared Tooling Configs

```
packages/config/
├── tsconfig/
│   ├── base.json                   # Strict mode, ES2017 target, paths
│   └── react-native.json           # Extends base + JSX, module resolution
├── eslint/
│   ├── base.js                     # TypeScript + import rules
│   └── react-native.js             # Extends base + RN-specific rules
├── prettier.config.js              # Shared formatting rules
└── package.json
```

---

## 5. Rider App

### 5.1 Expo Router Routes

Mapped 1:1 from every screen in `teeko-rider-prd.md`.

```
apps/rider/app/
├── _layout.tsx                        # Root Stack: (auth) | (main)
├── +not-found.tsx                     # 404 fallback
├── index.tsx                          # Splash → redirect to auth or main
│
├── (auth)/
│   ├── _layout.tsx                    # Auth Stack layout (no header)
│   ├── phone.tsx                      # Enter phone number
│   └── otp.tsx                        # Enter OTP code
│
└── (main)/
    ├── _layout.tsx                    # Main Stack: (tabs) + modal screens
    │
    ├── (tabs)/
    │   ├── _layout.tsx                # Bottom TabBar: Home | Rides | Account
    │   ├── index.tsx                  # Home — map + "Where to?" + recent places
    │   ├── rides.tsx                  # Ride history grouped by month
    │   └── account.tsx                # Profile, saved places, settings
    │
    ├── search.tsx                     # Destination search (full screen)
    ├── confirm-destination.tsx        # Map with draggable pin
    ├── ride-selection.tsx             # Ride type list + payment selector
    ├── finding-driver.tsx             # "Finding your driver..." animation
    ├── driver-matched.tsx             # Driver info card + map tracking
    ├── in-trip.tsx                    # Live trip tracking
    ├── trip-complete.tsx              # Rating + fare display
    ├── receipt/
    │   └── [id].tsx                   # Trip receipt detail
    │
    ├── saved-addresses.tsx            # Manage Home / Work addresses
    ├── scheduled-rides.tsx            # Advance booking list
    ├── payment-methods.tsx            # Add/manage payment methods
    ├── sos.tsx                        # SOS emergency screen
    ├── chat.tsx                       # In-app chat with driver
    │
    └── settings/
        ├── personal-info.tsx          # Edit name, phone, email
        ├── security.tsx               # Login & security
        └── language.tsx               # Language preference selector
```

### 5.2 Tab Configuration

| Tab | Route | Icon | Label | Default? |
|-----|-------|------|-------|----------|
| 1 | `(tabs)/index` | Home icon | Home | No |
| 2 | `(tabs)/rides` | Clock/car icon | Rides | **Yes** |
| 3 | `(tabs)/account` | Person icon | Account | No |

> Per PRD Section 3.1: "The Rides tab is the default screen when the app opens." Configured via `initialRouteName: 'rides'` in `(tabs)/_layout.tsx`.

### 5.3 Booking Flow

```
Home → Search → Confirm Destination → Ride Selection → Finding Driver
→ Driver Matched → In Trip → Trip Complete (+ Rating)
```

### 5.4 Rider Theme

- **Mode:** Light only — dark mode disabled
- **Primary color:** Red (`#DC2626`)
- **Typography:** Rounded, friendly typeface (Nunito/Poppins)
- **Design reference:** Bolt

---

## 6. Driver App

### 6.1 Expo Router Routes

Mapped 1:1 from every screen in `teeko-driver-prd.md`. Includes an `(onboarding)` route group that the rider app does not have.

```
apps/driver/app/
├── _layout.tsx                        # Root Stack: (auth) | (onboarding) | (main)
├── +not-found.tsx                     # 404 fallback
├── index.tsx                          # Splash → redirect based on auth + onboarding state
│
├── (auth)/
│   ├── _layout.tsx                    # Auth Stack layout
│   ├── phone.tsx                      # Enter phone number
│   └── otp.tsx                        # Enter OTP code
│
├── (onboarding)/
│   ├── _layout.tsx                    # Onboarding Stack layout
│   ├── agreement.tsx                  # T&C / Driver Agreement acceptance
│   ├── personal-documents.tsx         # IC, CDL, PSV-D, insurance, selfie upload
│   ├── vehicle-documents.tsx          # Car grant, road tax, PUSPAKOM, insurance
│   └── review-status.tsx             # Document review progress tracker
│
└── (main)/
    ├── _layout.tsx                    # Main Stack: (tabs) + overlay screens
    │
    ├── (tabs)/
    │   ├── _layout.tsx                # Bottom TabBar: Dashboard | Earnings | Account
    │   ├── index.tsx                  # Dashboard — map + online/offline toggle
    │   ├── earnings.tsx               # Earnings overview — today + weekly
    │   └── account.tsx                # Profile, documents, vehicle, settings
    │
    ├── incoming-request.tsx           # Ride request card + accept/decline + timer
    ├── navigate-to-pickup.tsx         # Accepted trip → heading to rider
    ├── trip-in-progress.tsx           # Active trip with rider info
    ├── trip-complete.tsx              # Trip complete + fare credited
    │
    ├── earnings/
    │   ├── weekly-summary.tsx         # Weekly payout breakdown
    │   ├── trip-history.tsx           # Per-trip fare + commission details
    │   └── early-cashout.tsx          # Early cashout request screen
    │
    ├── vehicles/
    │   ├── index.tsx                  # Vehicle list + active indicator
    │   └── [id].tsx                   # Vehicle detail + document status
    │
    ├── profile/
    │   ├── personal-info.tsx          # Edit name, phone
    │   ├── documents.tsx              # Document status + reupload
    │   ├── ratings.tsx                # Rating history + comments
    │   └── language.tsx               # Language preference
    │
    ├── sos.tsx                        # SOS emergency screen
    ├── chat.tsx                       # In-app chat with rider
    ├── incentives.tsx                 # Active campaigns + bonus progress
    ├── notifications.tsx              # EVP, doc expiry, suspension alerts
    └── support.tsx                    # In-app support + appeal form
```

### 6.2 Tab Configuration

| Tab | Route | Icon | Label |
|-----|-------|------|-------|
| 1 | `(tabs)/index` | Map/compass | Dashboard |
| 2 | `(tabs)/earnings` | Wallet | Earnings |
| 3 | `(tabs)/account` | Person | Account |

### 6.3 Driver State Machine

The driver app root `index.tsx` routes based on three states:

```
Not authenticated     → (auth)/phone
Authenticated, not onboarded → (onboarding)/agreement
Fully onboarded       → (main)/(tabs)
```

### 6.4 Trip Flow (Driver Side)

```
Dashboard (Online) → Incoming Request (15–20s timer)
  → Accept → Navigate to Pickup → Arrive → Trip In Progress → Trip Complete
  → Decline → Return to Dashboard
```

### 6.5 Driver Theme

- **Mode:** Dark mode enabled via NativeWind `useColorScheme()`
- **Primary color:** Red (`#DC2626`) — same as rider
- **Typography:** Large, glanceable text sizes for safety while driving
- **Custom font sizes:** `glance-lg` (24px), `glance-xl` (32px)

---

## 7. Dependency Graph

```
apps/rider  ───► @teeko/ui
            ───► @teeko/shared
            ───► @teeko/maps
            ───► @teeko/i18n
            ───► @teeko/api

apps/driver ───► @teeko/ui
            ───► @teeko/shared
            ───► @teeko/maps
            ───► @teeko/i18n
            ───► @teeko/api

@teeko/ui   ───► @teeko/shared (types, colors, constants)
@teeko/maps ───► @teeko/shared (types, coordinate utils)
@teeko/api  ───► @teeko/shared (types)
@teeko/i18n ───  (standalone — no internal deps)
@teeko/config ── (standalone — devDependency only)
```

---

## 8. Critical Configuration

### 8.1 `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 8.2 `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".expo/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

### 8.3 Root `package.json`

```json
{
  "name": "teeko",
  "private": true,
  "scripts": {
    "dev:rider": "turbo dev --filter=@teeko/rider",
    "dev:driver": "turbo dev --filter=@teeko/driver",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "clean": "turbo clean"
  },
  "devDependencies": {
    "turbo": "^2",
    "prettier": "^3"
  },
  "packageManager": "pnpm@9.15.0"
}
```

### 8.4 Metro Config (Per App)

Each app's `metro.config.js` must resolve monorepo packages and NativeWind:

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the monorepo packages
config.watchFolders = [monorepoRoot];

// Resolve node_modules from both app and monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = withNativeWind(config, { input: "./global.css" });
```

### 8.5 Tailwind Config (Per App)

Both apps must include shared package paths in `content` so NativeWind generates classes used in shared components.

**Rider** (`apps/rider/tailwind.config.ts`):

```typescript
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/maps/src/**/*.{ts,tsx}",
    "../../packages/i18n/src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#DC2626",
          50: "#FEF2F2",
          100: "#FEE2E2",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
        },
      },
    },
  },
  darkMode: "class", // Never activated — rider is light-only
};
```

**Driver** (`apps/driver/tailwind.config.ts`):

```typescript
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/maps/src/**/*.{ts,tsx}",
    "../../packages/i18n/src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#DC2626",
          50: "#FEF2F2",
          100: "#FEE2E2",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
        },
      },
      fontSize: {
        "glance-lg": ["24px", "32px"],
        "glance-xl": ["32px", "40px"],
      },
    },
  },
  darkMode: "class", // Enabled — uses NativeWind useColorScheme()
};
```

---

## 9. Implementation Notes

### 9.1 Metro Monorepo Resolution

Without `watchFolders` pointing to the monorepo root, Metro will not resolve imports from `packages/`. This is the most common monorepo setup failure.

### 9.2 NativeWind Content Paths

Tailwind must scan `../../packages/ui/src/**/*.{ts,tsx}` (and other packages) in each app's `tailwind.config.ts`. Missing this causes shared components to render unstyled.

### 9.3 Dark Mode Pattern

Every NativeWind class in `@teeko/ui` must define both light and dark variants:

```tsx
<View className="bg-white dark:bg-gray-900">
  <Text className="text-gray-900 dark:text-gray-100">...</Text>
</View>
```

The rider app locks to light mode by calling `setColorScheme('light')` in `apps/rider/app/_layout.tsx`, so `dark:` classes are simply ignored. The driver app respects device setting or user preference.

### 9.4 Rider Light Mode Lock

In `apps/rider/app/_layout.tsx`:

```tsx
import { useColorScheme } from "nativewind";

export default function RootLayout() {
  const { setColorScheme } = useColorScheme();
  setColorScheme("light"); // Always light mode for rider
  // ...
}
```

### 9.5 Mock Data Delay Simulation

All mock handlers in `@teeko/api` include simulated network latency to ensure loading states are visible and tested:

```typescript
export async function searchPlaces(query: string) {
  await new Promise((r) => setTimeout(r, 800)); // Simulate network
  return mockPlaces.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
}
```

### 9.6 Driver Root Redirect Logic

The driver app `index.tsx` checks three states before routing:

```typescript
// apps/driver/app/index.tsx
const { isAuthenticated } = useAuthStore();
const { isOnboarded } = useDriverStore();

if (!isAuthenticated) return <Redirect href="/(auth)/phone" />;
if (!isOnboarded) return <Redirect href="/(onboarding)/agreement" />;
return <Redirect href="/(main)/(tabs)" />;
```

### 9.7 Google Maps API Key

Both apps share one Google Maps API key configured in each app's `app.json`:

```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_API_KEY"
        }
      }
    },
    "ios": {
      "config": {
        "googleMapsApiKey": "YOUR_API_KEY"
      }
    }
  }
}
```

### 9.8 Package Naming Convention

All internal packages use the `@teeko/` scope:

| Package | Name |
|---------|------|
| Rider app | `@teeko/rider` |
| Driver app | `@teeko/driver` |
| UI components | `@teeko/ui` |
| Shared logic | `@teeko/shared` |
| Map components | `@teeko/maps` |
| Internationalization | `@teeko/i18n` |
| API client | `@teeko/api` |
| Tooling configs | `@teeko/config` |
