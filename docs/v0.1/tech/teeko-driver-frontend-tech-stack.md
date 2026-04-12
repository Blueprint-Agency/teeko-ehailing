# Teeko — Driver App Frontend Tech Stack

> **Version:** 1.0
> **Date:** 2026-04-12
> **Status:** Draft
> **Scope:** v0.1 Mockup (frontend only — no backend, $0 cost)
> **Base stack:** Extends `teeko-tech-stack.md` (React Native + Expo + NativeWind + Expo Router + Zustand + Google Maps)

---

## Contents

1. [Overview](#overview)
2. [App Architecture — Role-Based Routing](#app-architecture--role-based-routing)
3. [Driver Screen Inventory](#driver-screen-inventory)
4. [Package Additions](#package-additions)
   - [Document Upload — expo-camera + expo-image-picker](#1-document-upload--expo-camera--expo-image-picker)
   - [Form Management — react-hook-form + zod](#2-form-management--react-hook-form--zod)
   - [Internationalisation — i18next + react-i18next](#3-internationalisation--i18next--react-i18next)
   - [Earnings Charts — react-native-gifted-charts](#4-earnings-charts--react-native-gifted-charts)
   - [Bottom Sheet — @gorhom/bottom-sheet](#5-bottom-sheet--gorhombottom-sheet)
   - [Countdown Timer — Custom Hook](#6-countdown-timer--custom-hook)
   - [Dark Mode — NativeWind dark: + Zustand](#7-dark-mode--nativewind-dark--zustand)
5. [Mock Data Files](#mock-data-files)
6. [Zustand Stores](#zustand-stores)
7. [Packages Deferred to v1.0](#packages-deferred-to-v10)
8. [Full Package List](#full-package-list)
9. [Stack Summary](#stack-summary)

---

## Overview

The driver app shares a single Expo codebase with the rider app. Role-based routing via Expo Router separates the two experiences cleanly — a driver logs in and lands in the `(driver)` route group; a rider lands in the `(rider)` route group. No code duplication, one build, two products.

This document covers only the **driver-specific additions** to the base stack. All base-stack decisions (React Native, Expo, NativeWind, Expo Router, Zustand, Google Maps SDK) are documented in `teeko-tech-stack.md` and are not repeated here.

### Guiding principles (driver-specific)

1. **Glanceable UI first.** The driver uses this app while stationary in a moving environment. Every driver-facing screen must be legible at a glance with large touch targets and high contrast.
2. **Zero new native modules.** Every addition must work in Expo Go without a custom build. This keeps the v0.1 mockup accessible to all stakeholders.
3. **Mock everything.** No backend, no auth, no real-time. All driver state is simulated locally via Zustand + JSON fixtures.
4. **Carry forward.** Every package chosen for v0.1 is the same one used in v1.0. No throwaway code.

---

## App Architecture — Role-Based Routing

Expo Router uses **route groups** (parenthesised folder names) to separate layouts without affecting the URL path. The root `index.tsx` reads the mocked user role from the auth store and redirects accordingly.

```
app/
  _layout.tsx                   ← Root layout: fonts, i18n init, theme provider
  index.tsx                     ← Reads role → redirects to (driver) or (rider)

  (auth)/
    login.tsx                   ← Phone number entry (mocked)
    register-choice.tsx         ← "Sign up as Rider" / "Sign up as Driver"

  (rider)/
    _layout.tsx                 ← Rider tab navigator (existing)
    ...

  (driver)/
    _layout.tsx                 ← Driver bottom tab navigator
    home/
      index.tsx                 ← Live map, online/offline toggle, surge overlay
    request.tsx                 ← Incoming ride request (bottom sheet modal)
    trip.tsx                    ← Active trip screen
    earnings/
      index.tsx                 ← Dashboard: today, weekly chart, trip history
    incentives.tsx              ← Active campaigns and bonus progress
    vehicles.tsx                ← Registered vehicles + document status
    profile.tsx                 ← Personal info, documents, rating, language
    support.tsx                 ← Static support form + chat UI (mockup)
    notifications.tsx           ← Notification list (mock)

    onboarding/
      _layout.tsx               ← Stack navigator (step 1 → 2 → 3 → pending)
      agreement.tsx             ← Full T&C scroll + accept
      personal-docs.tsx         ← IC, CDL, PSV-D, selfie upload
      vehicle-docs.tsx          ← Car grant, road tax, insurance, PUSPAKOM
      pending.tsx               ← "Under review" holding screen
```

### Role switching in v0.1

Role is stored in the mock auth Zustand store (`useDriverAuthStore`). In the login screen, a toggle lets testers switch between rider and driver roles — simulating the sign-up flow without a real backend.

---

## Driver Screen Inventory

| Screen | Route | Key UI Elements |
|--------|-------|----------------|
| Home / Map | `(driver)/home` | Online/offline toggle, live map, surge zones, operating radius circle |
| Ride Request Card | `(driver)/request` | Bottom sheet, pickup/destination, fare, rider rating, countdown ring, accept/decline |
| Active Trip | `(driver)/trip` | Trip phase indicator, rider info, "Open in Maps" / "Open in Waze" button, SOS button |
| Earnings Dashboard | `(driver)/earnings` | Daily bar chart, weekly line chart, trip list, early cashout button |
| Incentives | `(driver)/incentives` | Campaign cards with progress bars |
| Vehicle Management | `(driver)/vehicles` | Vehicle list, active indicator, per-document expiry status |
| Profile | `(driver)/profile` | Name, rating stars, language picker, document status badges |
| Support | `(driver)/support` | Static chat thread UI, support form |
| Notifications | `(driver)/notifications` | Notification list (EVP approval, doc expiry, suspension) |
| Driver Agreement | `(driver)/onboarding/agreement` | Scrollable T&C, accept button (enabled at bottom) |
| Personal Docs Upload | `(driver)/onboarding/personal-docs` | IC, CDL, PSV-D, selfie — each slot camera/gallery |
| Vehicle Docs Upload | `(driver)/onboarding/vehicle-docs` | Car grant, road tax, insurance, PUSPAKOM — each slot |
| Pending Review | `(driver)/onboarding/pending` | Status tracker: submitted → under review → approved |

---

## Package Additions

### 1. Document Upload — `expo-camera` + `expo-image-picker`

#### What it does
Enables driver-partners to photograph and upload the 8+ documents required for registration: IC, CDL, PSV-D licence, e-hailing insurance cover note, profile selfie, car grant/VOC, road tax, and PUSPAKOM inspection certificate.

#### Why expo-camera + expo-image-picker
- **Both are in the Expo SDK.** No custom native build required. Both work in Expo Go — critical for the v0.1 mockup workflow.
- **Complementary roles.** `expo-camera` provides in-app capture with custom overlays (a document frame guide improves capture quality). `expo-image-picker` provides gallery selection as a fallback.
- **Permissions are self-contained.** Each API handles its own permission requests (camera, media library) in SDK 49+. No `expo-permissions` shim needed.
- **Carries forward to v1.0.** The captured image is a local URI — in v0.1 it is stored in component state; in v1.0 it is uploaded to Google Cloud Storage. The camera UI code does not change.

#### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **react-native-vision-camera** | More powerful but requires custom native build — incompatible with Expo Go. Overkill for document capture. |
| **expo-image-picker only (no camera)** | Gallery-only means drivers must take photos outside the app and import them. Inferior UX and harder to guide correct framing. |
| **HTML `<input type="file" />` (web preview only)** | Works for browser preview but not on device. Document upload must be tested on device. |

#### Implementation notes

```
Each document slot is a component:
  <DocumentSlot label="MyKad / NRIC" required />
  → Shows placeholder frame when empty
  → Opens action sheet: "Take Photo" / "Choose from Gallery"
  → Shows captured image thumbnail + "Retake" when filled
  → Red border if required and not filled on step submit
```

---

### 2. Form Management — `react-hook-form` + `zod`

#### What it does
Manages the multi-step driver onboarding form: input validation, error states, step-gating (cannot proceed to step 2 without completing step 1), and submission state.

#### Why react-hook-form
- **Uncontrolled inputs.** RHF tracks field values via refs, not `useState` — avoids re-rendering the entire form on every keystroke. Critical for a long multi-step form with document uploads.
- **Step-gating is trivial.** Each step registers its own fields; calling `trigger()` on step submit validates only the current step's fields.
- **Same library for the full platform.** If rider-side flows add forms later (feedback, support), they use the same library.

#### Why zod
- **TypeScript-first.** Schemas are types — the same `z.object({...})` schema used for form validation is also the TypeScript type for the onboarding data model.
- **Rich validation.** Malaysian NRIC format, expiry date future-validation, file presence checks — all expressible in zod schemas.
- **Integrates directly with react-hook-form** via `@hookform/resolvers/zod` — one-line integration, no custom validation logic.

#### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Formik** | Older library with more boilerplate. Controlled inputs cause more re-renders. RHF is the current community standard. |
| **Manual useState per field** | Unmanageable at 10+ fields per step. No built-in validation, error display, or dirty-state tracking. |
| **Yup (instead of Zod)** | Yup works fine but has a weaker TypeScript experience. Zod's type inference is tighter and more idiomatic in modern React Native projects. |

---

### 3. Internationalisation — `i18next` + `react-i18next` + `expo-localization`

#### What it does
Powers 4-language support: English (EN), Bahasa Malaysia (BM), Mandarin Simplified (ZH-Hans), and Tamil (TA). In v0.1, only English strings are populated — the infrastructure is wired so other languages can be added as JSON files without any code changes.

#### Why wire i18n in v0.1 (not later)
- **No rework at v1.0.** If strings are hardcoded in components now, migrating to i18n later means touching every string in the codebase. Wiring it once in v0.1 costs ~2 hours; retrofitting costs significantly more.
- **Locale files are just JSON.** The translation team or copywriter can fill in BM/ZH/TA strings in parallel with development. No developer involvement needed per language.
- **APAD compliance note.** The driver agreement (T&C) must be readable in BM. Having the i18n framework in place means the BM version is one JSON file away.

#### Architecture

```
locales/
  en.json     ← English strings (complete in v0.1)
  ms.json     ← Bahasa Malaysia (placeholder keys, empty values)
  zh.json     ← Mandarin Simplified (placeholder keys, empty values)
  ta.json     ← Tamil (placeholder keys, empty values)
```

String keys are namespaced by screen:

```json
{
  "driver": {
    "home": {
      "goOnline": "Go Online",
      "goOffline": "Go Offline",
      "operatingRadius": "Operating Radius"
    },
    "request": {
      "accept": "Accept",
      "decline": "Decline",
      "secondsLeft": "{{count}}s"
    }
  }
}
```

#### expo-localization
- Reads device locale on startup (`Localization.locale` → e.g. `"ms-MY"`)
- Sets the active i18next language automatically
- Driver can override language in Profile — preference stored in Zustand and persisted via `expo-secure-store` (v1.0) or `AsyncStorage` (v0.1)

#### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Hardcoded English strings** | Creates mandatory rework before launch. Violates the "carry forward" principle. |
| **react-native-localize** | Lower-level library that i18next/expo-localization supersede. More manual setup. |
| **LinguiJS** | Excellent alternative but less widely adopted in the React Native ecosystem. Fewer Expo-specific examples. i18next has broader community support. |

---

### 4. Earnings Charts — `react-native-gifted-charts`

#### What it does
Renders the daily earnings bar chart and weekly trend line chart on the driver earnings dashboard.

#### Why react-native-gifted-charts
- **No native dependencies.** Renders using React Native's `View` and `Animated` primitives — no Skia, no SVG native module, no custom build. Works in Expo Go.
- **Lightweight.** Significantly smaller than Victory Native or Recharts. Minimal impact on app bundle size.
- **Sufficient feature set.** Supports bar charts, line charts, tooltips, axis labels, and colour gradients — everything needed for the earnings dashboard.
- **Good documentation.** Well-maintained with clear Expo-specific usage examples.

#### What gets charted

| Chart | Type | Data source |
|-------|------|------------|
| Daily earnings (last 7 days) | Bar chart | `mock-earnings.json → dailyBreakdown` |
| Weekly earnings trend (last 4 weeks) | Line chart | `mock-earnings.json → weeklyTotals` |

#### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Victory Native** | Heavier bundle. The Skia-based version requires a custom Expo build. The legacy version is less maintained. |
| **react-native-svg + custom charts** | Maximum flexibility but significant dev time to build charts from scratch. No benefit for basic bar/line charts. |
| **No charts (text only)** | Rejected — basic charts were confirmed as a requirement. Text-only earnings is a worse driver experience and harder to read at a glance. |

---

### 5. Bottom Sheet — `@gorhom/bottom-sheet`

#### What it does
Provides the slide-up panel used for the incoming ride request card. The request card must overlay the map and support:
- Programmatic opening (triggered when a mock request arrives)
- Auto-dismiss when the countdown expires
- Backdrop tap to dismiss (in non-request contexts)
- Snap points (half-screen for compact view, full-screen for expanded details)

Also used for: operating radius picker, surge zone detail overlay.

#### Why @gorhom/bottom-sheet
- **Expo-compatible.** Built on `react-native-reanimated` v2/v3 and `react-native-gesture-handler` — both already in the Expo SDK. No extra native modules.
- **Programmatic control.** The `ref.current.expand()` / `ref.current.close()` API lets the countdown hook auto-dismiss the sheet when the timer expires.
- **Production-grade.** Most widely used bottom sheet library in the React Native ecosystem. Active maintenance, TypeScript support.
- **Smooth animations.** Uses Reanimated worklets for 60fps gesture-driven animations — critical for the ride request UX.

#### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **react-native-modal** | Simple modal — no snap points, no gesture-driven sheet behaviour. Not the right abstraction for a map overlay. |
| **Custom Animated.View** | Possible but significant effort to replicate gesture physics, snap behaviour, and backdrop handling correctly. |
| **react-native-raw-bottom-sheet** | Simpler API but no gesture support. Not suitable for the ride request card's swipe interactions. |

---

### 6. Countdown Timer — Custom Hook

#### What it does
Powers the 15–20 second accept/decline timer on the ride request card. Returns `{ remaining, isExpired, reset }` — consumed by the request screen to update the countdown display and auto-dismiss the sheet.

#### Why a custom hook (no library)
A countdown timer is a `setInterval` decrement and a `useEffect` cleanup. It does not warrant a library dependency. Building it as a `useCountdown(seconds)` hook keeps the logic testable, reusable, and transparent.

```typescript
// hooks/useCountdown.ts
export function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining(r => r - 1), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  return {
    remaining,
    isExpired: remaining <= 0,
    reset: () => setRemaining(seconds),
  };
}
```

The animated progress ring (circular timer indicator on the request card) is driven by `react-native-reanimated`'s `useSharedValue` and `withTiming` — already in the Expo SDK.

---

### 7. Dark Mode — NativeWind `dark:` + Zustand

#### What it does
Applies a dark colour scheme across all driver screens. Critical requirement — drivers use the app at night and in low-light conditions.

#### Why NativeWind `dark:` classes
NativeWind v4 supports the `dark:` modifier natively:

```tsx
<View className="bg-white dark:bg-zinc-900">
  <Text className="text-zinc-900 dark:text-white">Go Online</Text>
</View>
```

No runtime switching library needed. NativeWind reads the active colour scheme from React Native's `useColorScheme` hook and applies the correct class set.

#### User preference override
Drivers working night shifts may want dark mode regardless of their phone's system setting. The preference is stored in the driver's Zustand store:

```typescript
useDriverStore: {
  colorScheme: 'system' | 'light' | 'dark'  // default: 'dark'
}
```

The root `_layout.tsx` injects the resolved scheme into NativeWind's `colorScheme` prop. The default for new driver accounts is `'dark'` — matching the target use pattern.

---

## Mock Data Files

All mock data lives in a `data/` directory at the project root. Screens read from these files via Zustand stores. No network calls in v0.1.

```
data/
  mock-driver-profile.json        ← name, phone, rating (4.92), status, onboarding step
  mock-vehicles.json              ← list of vehicles; doc expiry dates, active flag
  mock-earnings.json              ← daily totals (7 days), weekly totals (4 weeks), trip list
  mock-trips-driver.json          ← trip history: fare, distance, date, rider name, rating given
  mock-incentives.json            ← active campaigns: target trips, completed trips, bonus amount
  mock-notifications-driver.json  ← EVP approved, road tax expiry warning, suspension notice
  mock-ride-request.json          ← one incoming request: pickup, destination, fare, rider rating
```

---

## Zustand Stores

Driver-specific stores. Existing rider stores are untouched.

| Store | Key state |
|-------|-----------|
| `useDriverAuthStore` | `role`, `onboardingStep`, `mock driver profile` |
| `useDriverStore` | `isOnline`, `operatingRadius`, `activeVehicleId`, `colorScheme` |
| `useRideRequestStore` | `currentRequest`, `countdownActive`, `requestStatus` (pending/accepted/declined/expired) |
| `useTripStore` | `tripPhase` (navigating/arrived/started/completed), `riderInfo`, `fare` |
| `useEarningsStore` | `todayTotal`, `weeklyTotal`, `tripHistory`, `cashoutEligible` |

---

## Packages Deferred to v1.0

| Package | What it enables | Why deferred |
|---------|----------------|-------------|
| `stream-chat-react-native` | Real in-app support chat | v0.1 shows static chat UI mockup only |
| `socket.io-client` | Real-time ride requests | No backend in v0.1; requests simulated via mock data |
| `@clerk/expo` or `@react-native-firebase/auth` | Real phone OTP auth | Mock role stored in Zustand; no real login in v0.1 |
| Jumio / Onfido SDK | Identity verification + liveness | v0.1 shows selfie capture UI; admin review is manual |
| `expo-notifications` | Real push notifications | Notifications shown from `mock-notifications-driver.json` |
| `expo-background-fetch` + `expo-task-manager` | Background location for driver tracking | No backend to receive location pings in v0.1 |

---

## Full Package List

### Base stack (from teeko-tech-stack.md — no changes)

| Package | Purpose |
|---------|---------|
| `expo` | Managed React Native platform |
| `expo-router` | File-based navigation |
| `nativewind` | Tailwind CSS utility classes for RN |
| `react-native-maps` | Google Maps SDK |
| `zustand` | Lightweight state management |

### Driver additions (this document)

| Package | Version | Purpose | Expo Go? |
|---------|---------|---------|----------|
| `expo-camera` | SDK-bundled | In-app document/selfie capture | ✅ |
| `expo-image-picker` | SDK-bundled | Gallery selection for documents | ✅ |
| `react-hook-form` | ^7.x | Multi-step form management | ✅ |
| `zod` | ^3.x | Schema validation + TypeScript types | ✅ |
| `@hookform/resolvers` | ^3.x | zod ↔ react-hook-form bridge | ✅ |
| `i18next` | ^23.x | i18n engine | ✅ |
| `react-i18next` | ^14.x | React hooks for i18n | ✅ |
| `expo-localization` | SDK-bundled | Device locale detection | ✅ |
| `react-native-gifted-charts` | ^1.x | Earnings bar + line charts | ✅ |
| `@gorhom/bottom-sheet` | ^4.x | Ride request card, overlays | ✅ |

`react-native-reanimated` and `react-native-gesture-handler` — required by `@gorhom/bottom-sheet` — are already in the Expo SDK.

**Total additional cost: $0**

---

## Stack Summary

| Layer | Technology | Notes |
|-------|-----------|-------|
| Mobile framework | React Native + Expo (base) | Shared with rider app |
| Navigation | Expo Router — role-based groups | `(driver)/` + `(rider)/` route groups |
| Styling + dark mode | NativeWind `dark:` + Zustand pref | Default dark for driver accounts |
| Maps + overlays | react-native-maps (base) | Surge zone polygon, radius circle overlays |
| State management | Zustand (base + 5 driver stores) | Mock role switch for v0.1 testing |
| Document upload | expo-camera + expo-image-picker | Works in Expo Go, carries to v1.0 |
| Form validation | react-hook-form + zod | Multi-step onboarding with step gating |
| i18n | i18next + react-i18next | EN wired; BM/ZH/TA as JSON files |
| Earnings charts | react-native-gifted-charts | Bar + line; no native deps |
| Bottom sheet | @gorhom/bottom-sheet | Ride request card + overlays |
| Countdown timer | Custom `useCountdown` hook | No library; Reanimated for progress ring |
| Mock data | Local JSON files (base pattern) | 7 driver-specific fixtures |

**Total additional cost for driver app v0.1: $0**

---

*Driver app frontend tech stack v1.0 will be documented separately when the mockup is approved and backend development begins.*

*Updated 2026-04-12.*
