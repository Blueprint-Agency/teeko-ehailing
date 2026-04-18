# 08 — Phase D: History & Account

Covers PRD §4.11 → §4.13. Outcome: past trips browsable, receipts detailed, user profile editable, Home/Work saved places settable.

## 1. Screens

| Route | PRD | Notes |
|-------|-----|-------|
| `(main)/(tabs)/rides.tsx` | §4.12 | Default landing tab. "Past" single tab (no Upcoming). Grouped by month. |
| `(main)/receipt/[id].tsx` | §4.11 | Pushed from ride list tap. Read-only summary. |
| `(main)/(tabs)/account.tsx` | §4.13 | Profile header + Personal info + Login & security + Saved places |

## 2. Rides tab layout

- Header: "Rides" large bold left-aligned.
- Section headers: month names (e.g., "April 2026") derived from `trip.completedAt` / `cancelledAt`.
- List item (`RideHistoryRow`):
  - Leading icon: `car` for normal, `car` with strike-through for cancelled
  - Top line: `3 Apr · 14:16` · status pill "Cancelled" if applicable
  - Middle: pickup → destination (truncated)
  - Right: `RM 25` or `RM 0` for cancelled
- Empty state: "No rides yet. Tap Home to book your first ride." + illustration.
- Tap → `/(main)/receipt/{id}`.

## 3. Receipt layout

Exactly one fare line — **no breakdown** (PRD §4.11).

- Date and time
- Pickup address
- Destination address
- Ride type ("Teeko Go" / "Comfort" / "XL" / "Premium" / "Bike")
- Total fare (bold, large, e.g., "RM 25.00")
- Payment method label (e.g., "Touch 'n Go eWallet")
- Driver block: name + plate
- Cancellation: if cancelled, show cancelReason (if any) and fare "RM 0"

## 4. Account tab layout

1. **Profile header** — name (centred, large), rating (`★ 5.00 Rating`).
2. **Menu list**:
   - Personal info (person icon) → `account/personal.tsx` modal (edit name, email; phone is read-only).
   - Login & security (shield icon) → `account/security.tsx` modal (placeholder v0.1: "Password not set" row, "Google connection" row inert).
3. **Saved places**:
   - Header "Saved places".
   - Home row: house icon + "Enter home location" or saved address + chevron → opens `search` modal with intent=`saveHome`.
   - Work row: briefcase icon + "Enter work location" or saved address + chevron → same, intent=`saveWork`.
4. **Not included** (PRD §4.13): Family profile, Safety, Connect calendar, Add a place.

## 5. Language picker (added here, not in PRD)

Minimum viable entry: put a `Language` row under Saved places, rendering the current language (e.g., "English · 中文 · Bahasa Melayu · தமிழ்"). Opens a bottom sheet with 4 `Pill` options → updates `auth-store.language` + `i18n.changeLanguage`.

## 6. Data sources

- `trips-store.history` (sorted desc by `completedAt`/`cancelledAt`).
- `places-store.saved` for Home/Work.
- `payments-store.default` for receipt "payment method".
- `auth-store.rider` for profile header + editable personal info.

## 7. Edge cases

| Case | Behavior |
|------|----------|
| Trip with no driver (cancelled pre-match) | Show only pickup/destination + status "Cancelled" + reason |
| Trip `.rating === undefined` | Don't show a rating on receipt (no "you rated X stars" line) |
| Saved place unset | Row reads "Enter home location" in `ink.faint` |
| Phone number display | Format `+60 12-345 6789` via `@teeko/shared/utils/format-phone` |

## 8. Checkpoint demo

End of Phase D: completed rides from Phase C now show up grouped by month in Rides tab; tapping opens the receipt; setting Home under Account changes the shortcut in the search screen (Phase B) next time it's opened.
