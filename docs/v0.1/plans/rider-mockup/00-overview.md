# 00 — Overview

## 1. Goal

Ship a **clickable, mock-data-driven rider app** on Expo Go / EAS preview that stakeholders (APAD reviewers, investors, partner drivers) can install and walk through the full booking journey — sign-up → book → ride → rate → receipt — without any backend running.

Success looks like: a non-technical reviewer can open the app cold and reach **Trip Completed** in under two minutes, with every PRD screen rendered to spec.

## 2. Constraints

| Constraint | Implication |
|-----------|-------------|
| Frontend-only, mock data | No Stripe, no TNG SDK, no FCM, no Google Places lookups hitting billable APIs — stub everything |
| 1-month MVP timeline | Ruthless scope cut; no nice-to-haves outside the PRD |
| Light mode only (rider) | No dark theme work; `tailwind.config.ts` is fixed to a single palette |
| 4 languages (en, ms, zh-Hans, ta) | All user-visible strings through `@teeko/i18n` from day one |
| PDPA + APAD optics | No real PII on device; mock names/phones only; no analytics beacons |

## 3. Stack (v0.1, already committed)

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime | Expo SDK | `~52.0.0` |
| Framework | React Native | `0.76.5` |
| Routing | Expo Router | `~4.0.0` |
| Language | TypeScript | `^5.7.2` |
| Styling | NativeWind v4 + Tailwind CSS | `^4` / `^3.4` |
| State | Zustand | `^5` |
| Maps | `react-native-maps` (Google provider) | latest matching SDK 52 |
| Icons | `lucide-react-native` | latest |
| Bottom sheets | `@gorhom/bottom-sheet` v5 | `^5` |
| i18n | `i18next` + `react-i18next` | `^23` / `^15` |
| Validation | `zod` (already in `@teeko/shared`) | `^3.24` |
| Monorepo | pnpm + Turborepo | `pnpm@9.15.0` |

> The package manager and monorepo tooling are set. The rider app has `expo-router`, `react-native-safe-area-context`, `react-native-screens` installed. Everything else is an add in Phase 01.

## 4. Definition of done (per phase)

A phase is "done" only when **all** apply:

1. All screens in the phase render to PRD spec on iOS and Android via Expo Go.
2. Happy path is wired end-to-end using mock data (simulated latency 400–1200 ms).
3. All user-visible strings go through `@teeko/i18n` (keys added in all 4 locales — English drafted, others `[MS] ...` placeholders OK for Phase A–C, filled by Phase E).
4. `pnpm typecheck` passes at repo root.
5. A 30-second screen-recording walkthrough is attached to the phase PR.
6. No hard-coded colors, spacing, or font sizes — everything through Tailwind tokens.

## 5. Milestones

| Milestone | Deliverable | Target week |
|-----------|-------------|-------------|
| **M0 — Foundation** | Phases 01–04 complete. App boots to an empty Home with working tab bar, design tokens, mock API responding. | Week 1 |
| **M1 — Book a ride** | Phases A + B complete. Sign-up → search → ride-selection → finding-driver. | Week 2 |
| **M2 — Complete a trip** | Phase C complete. Driver-matched → in-trip → rating → back to Home. Full golden path works. | Week 3 |
| **M3 — Ship-ready demo** | Phases D + E complete. History, account, i18n filled, empty/error states, EAS preview build, demo reset. | Week 4 |

## 6. Out of scope (confirmed)

Per `teeko-rider-prd.md` §9 and `teeko-deferred.md`: no rebook, no dark mode, no promos, no custom saved places, no tipping, no fare breakdown, no Upcoming rides tab, no family profiles, no calendar connect, no surcharge banner.

## 7. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| `react-native-maps` Google provider needs API keys before first run on Android | Commit a placeholder dev key in `app.json` under a `google.maps` key; document in `01-scaffold-gaps.md`. No production key committed. |
| NativeWind v4 + Expo Router monorepo setup has known sharp edges | Follow [NativeWind v4 Expo monorepo guide](https://www.nativewind.dev/v4/getting-started/expo-router); pin `metro.config.js` to match. |
| Expo Go drops some native modules (e.g., `react-native-maps` with Google Provider on Android) | Fall back to default provider in Expo Go; use development build / EAS preview for Google Maps on Android. Called out in demo script. |
| Mock "live tracking" looks static | Animate the driver marker along a pre-baked polyline on a fixed timer (see 04-mock-data). |
