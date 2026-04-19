# Rider mockup — demo script

> Target audience: APAD/JPJ stakeholders, internal product reviewers.
> Run-time: under 2 minutes for the golden path.

## 0. Setup

- iOS: install via TestFlight invite link (EAS preview channel).
- Android: install the APK from the EAS preview build link.
- First launch: grant location permission when prompted (denial is tolerated — Home falls back to KL Sentral).

## 1. Sign-in (15s)

- Open the app → "What's your phone number?" screen.
- Enter any 9-10 digit number after the `+60` prefix (e.g., `12 345 6789`).
- Tap **Continue** → OTP screen.
- Enter any 6-digit code that **starts with `1`** (e.g., `123456`). Other codes are rejected to demo error handling.

## 2. Book a ride (45s)

- Home tab is the default. Tap the **"Where to?"** bar.
- Pick a recent place (e.g., "Pavilion KL") or type to search.
- Confirm pickup pin (defaults to current location).
- Ride selection: 5 categories (Go / Comfort / XL / Premium / Bike). Pick one.
- Confirm payment method (TNG eWallet is default in seed data).
- Tap **"Book"** → finding-driver screen with searching animation.
- After 2-4 seconds: matched. Toast: "Driver matched. On the way to you."

## 3. In-trip experience (30s)

- Driver-matched screen: driver card, plate, ETA, mock chat / call buttons.
- Wait ~5s: arrived toast → trip starts → in-trip view with route polyline + animated marker.
- Wait ~15s for completion → trip-complete screen with rating selector.
- Rate the driver (5★) → **Done** → returns to Home.

## 4. Ride history & receipt (15s)

- Tap **Rides** tab → completed ride appears at the top, grouped by month.
- Tap the row → receipt with date, addresses, ride type, fare, payment method, driver block.

## 5. Account & language switch (15s)

- Tap **Account** tab.
- Tap **Language** → bottom sheet with English / Bahasa Melayu / 中文 / தமிழ்.
- Pick **Bahasa Melayu** → all translated strings switch instantly (Account, Rides, cancel sheet, toasts).
- Switch back to English for the next demo.

## 6. Cancellation flow (15s)

- Book another ride. On finding-driver / driver-matched / in-trip, tap **Cancel trip**.
- Bottom sheet shows "Free cancellation. Fees may apply later." banner + 5 reason chips.
- Pick a reason → **Cancel ride** → toast confirms cancellation → returns to Home.
- Open **Rides** tab → cancelled ride appears with "RM 0" and a "Cancelled" tag.

## 7. "No drivers" demo (10s)

- Account tab → **long-press the profile avatar** → opens hidden Demo controls.
- Toggle **Force "No drivers" state** ON → close.
- Book a ride. finding-driver immediately shows the "No drivers available" fallback with **Try again** + **Cancel**.

## 8. Demo reset

- Demo controls → **Reset demo state** → clears toasts, demo flags, active trip; reloads ride history from seed.

---

## Known gaps to mention if asked

See `docs/v0.1/plans/rider-mockup/known-gaps.md`. Headlines:

- All payments are illustrative — no TNG/GrabPay SDK redirect.
- OTP accepts any code starting with `1`.
- Map tiles are Expo Go default provider on Android (looks OSM-like).
- Chat is two canned messages.
- No real backend — in-memory + AsyncStorage only.
