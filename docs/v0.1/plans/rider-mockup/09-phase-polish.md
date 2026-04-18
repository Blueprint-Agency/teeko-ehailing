# 09 — Phase E: Polish & delivery

Everything that makes the mockup demo-ready but isn't a new screen. Ship on week 4.

## 1. i18n — fill all 4 locales

- Source: `packages/i18n/src/locales/{en,ms,zh,ta}.json`.
- English is drafted per-phase; other locales were `[MS] …` placeholders.
- Target coverage: 100% keys in all 4 locales before demo.
- Manual QA: switch language from Account → sanity-check every screen (Home, search, ride-selection, finding-driver, driver-matched, in-trip, trip-complete, Rides, receipt, Account).
- Known landmines: Tamil characters need font support — ensure Nunito variant or system fallback renders (test on iOS + Android).
- Keep numbers/currency **not** translated — RM always left-to-right.

## 2. Cancellation flow (PRD §5 placeholder)

Minimal implementation (even though policy is TBD):

- `CancelTripSheet` component — bottom sheet with:
  - "Are you sure you want to cancel?"
  - Reason picker (single-select): Driver too far / Changed my plans / Waiting too long / Booked by mistake / Other
  - "Keep ride" secondary + "Cancel ride" danger CTA
- Triggered from finding-driver, driver-matched, in-trip.
- On confirm: `trip-store.cancel(reason)`, push history row with `status: 'cancelled'`, toast "Your ride has been cancelled.", return to Home.

Fee logic: hard-code "Free cancellation" banner in v0.1. Note in copy: "Fees may apply later" — aligns with PRD placeholder wording.

## 3. Empty / loading / error polish

Walk every screen and confirm each of the three states per `02-design-system.md §6`:

| Screen | Empty | Loading | Error |
|--------|-------|---------|-------|
| Home | n/a | font/i18n splash | n/a |
| Search | "Start typing to find a place" | skeleton rows | network stub: toast |
| Ride-selection | n/a | skeleton of 5 ride rows | "Couldn't load fares" + retry |
| Finding-driver | — | pulsing indicator | "No drivers available" |
| Driver-matched / in-trip | — | brief (mounted with data) | — |
| Rides | illustration + CTA | skeleton of 3 rows | toast |
| Receipt | — | skeleton blocks | toast |
| Account | — | — | — |

## 4. Push notifications

Two paths:

- **Expo Go demo**: in-app banners via `ui-store.pushToast()` — triggered by state machine transitions. Primary path.
- **EAS dev build**: additionally schedule a local `expo-notifications` on matched / arrived / started / completed for realism. Do this only if EAS build time allows.

## 5. Accessibility sweep

- Every interactive element: `accessibilityRole`, `accessibilityLabel` (i18n key).
- Screen titles announced on route change (use `accessibilityLiveRegion="polite"` on status headers).
- Color contrast check: primary red on white, `ink.muted` on surface, all pass WCAG AA for 14 px+ copy.
- Dynamic type scale test at 120%.
- VoiceOver + TalkBack smoke test for the golden path.

## 6. Haptics & motion audit

- Buttons: light impact on press.
- Selection (ride type, payment, rating stars): `selectionAsync`.
- Trip complete "Done": notificationAsync `success`.
- Marker animation smooth at 60 fps — verify with Perf Monitor.

## 7. Demo script

Commit `docs/v0.1/plans/rider-mockup/demo-script.md` (write during this phase, not yet). Sections:

1. Install EAS preview link (iOS TestFlight + Android APK).
2. Fresh-install flow → sign-up → book → in-trip → complete → Rides tab.
3. Language switch demo.
4. Cancellation demo.
5. "No drivers" error demo.
6. Demo reset (`teeko://demo/reset`).

## 8. Build & distribute

- **EAS preview profile** configured (`eas.json`): distribution: `internal`, channel: `preview`.
- Run `eas build --platform all --profile preview`.
- Attach install links in the repo README (or a gated internal page).
- Verify on at least one real iPhone and one real Android (not just simulators).

## 9. Known deliberate gaps (document in the PR)

- Map tiles on Android default provider look OSM-like; note this is an Expo Go constraint.
- Chat input is inert (two canned messages only).
- Payments do not redirect to TNG/GrabPay SDKs — it's a picker illustration only.
- OTP accepts any code starting with `1`.
- No real backend — everything is in-memory + AsyncStorage.

## 10. Done means…

- EAS preview build installable on iOS + Android.
- All PRD screens render to spec.
- Golden path demo runs in under 2 minutes.
- All 4 languages pass a per-screen sanity check.
- `pnpm typecheck` + `pnpm lint` green.
- A short demo video + the demo script live in the repo.
