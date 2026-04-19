# Rider mockup — deliberate gaps

> v0.1 is a frontend-only mockup for stakeholder demos and the APAD/JPJ application. The list below is **intentional** — these are not bugs to file; they are scope decisions to honour the 1-month MVP timeline. Production parity lands in v1.0.

## Backend

- **No real backend.** All data is in-memory + AsyncStorage; everything resets on a fresh install. Mock handlers in `@teeko/api` simulate latency (400-1200 ms) but produce deterministic seed data.
- **No persistence beyond the device.** Logging out clears the local rider; there is no real "account" on a server.

## Auth

- **OTP accepts any 6-digit code starting with `1`.** Other codes are intentionally rejected to demo the error path. There is no SMS gateway integration.
- **No social login** (Google / Apple). Account → Login & security shows inert placeholder rows.
- **No password.** Phone+OTP is the only credential.

## Payments

- **No real payment SDKs.** TNG eWallet, GrabPay, Google Pay, Card, and Cash are picker illustrations only. No webview / SDK redirect.
- **No fare collection.** Receipts are summary-only; no money moves.
- **No add-payment flow.** Adding a new method is a v1.0 task (the screen carries a "Coming soon" copy line).

## Maps & location

- **Android map tiles use the Expo Go default provider** (looks OSM-like). The release build will use Google Maps tiles via API key — note this when demoing on Expo Go.
- **No real driver pool.** Driver matching, position, and movement are simulated by `trip-store.simulateDriverMovement` over a precomputed polyline.
- **Pickup pin is best-effort.** No reverse geocoding — the address shown is taken from seeded place data.

## Communication

- **Mock chat is two canned messages.** The text input is inert.
- **Phone call button** opens the dialer with the driver's seed-data phone number; calls are not connected through any masking layer.

## Notifications

- **In-app toasts only.** State transitions (matched / arrived / started / completed / cancelled) push toasts via `ui-store.pushToast`. No real `expo-notifications` registration in v0.1.
- A scheduled local notification on EAS dev builds is documented in plan §4 as a stretch — not enabled in the preview build.

## Cancellation

- **No fee policy.** The sheet shows "Free cancellation. Fees may apply later." in line with PRD §5 placeholder copy. No actual fee calculation.

## i18n coverage

- **Framework wired.** `@teeko/i18n` initialises i18next with en / ms / zh / ta. `useT()` hook is exported.
- **Partial extraction.** High-visibility surfaces are translated (Account tab, Rides tab, cancel sheet, key toasts, demo controls). Booking flow + auth screens still contain inline English strings — these fall back to English in non-EN locales. Full extraction is planned for v0.1.x.
- **Translations are first-pass.** ms / zh / ta strings need a native-speaker review before public demos.
- **Numbers and currency stay in source format** (RM left-to-right, no localised digit grouping).

## Accessibility

- **Targeted labels added** on the most reachable controls (cancel reason chips, demo toggle, profile avatar long-press). A full per-screen a11y sweep + VoiceOver/TalkBack walkthrough is pending and tracked under Phase E §5.
- **Dynamic type** above 120% has not been validated.

## Build & distribution

- **EAS preview build is not yet cut.** `eas.json` configuration exists; running `eas build --platform all --profile preview` and attaching the install link to the README is the remaining manual step. Real-device verification (one iPhone + one Android) follows.
