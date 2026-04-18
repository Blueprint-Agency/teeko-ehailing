# 07 — Phase C: Trip

Covers PRD §4.7 → §4.10. Outcome: the full live-trip experience — driver card → driver arrives → in-trip animation → rating → back to Home.

## 1. Screens

| Route | PRD | Driven by |
|-------|-----|-----------|
| `(main)/driver-matched.tsx` | §4.7, §4.8 | `trip-store.status` = `matched` or `arrived` (same screen, different copy) |
| `(main)/in-trip.tsx` | §4.9 | `trip-store.status = 'in_trip'` |
| `(main)/trip-complete.tsx` | §4.10 | `trip-store.status = 'completed'` |

## 2. Components

| Component | Used by | Notes |
|-----------|---------|-------|
| `DriverCard` | driver-matched | Photo, name, `Rating` star, vehicle line ("Silver Perodua Myvi"), plate pill, ETA line, call + chat icon buttons |
| `TripStatusHeader` | driver-matched, in-trip | Compact status copy: "Driver is on the way" / "Your driver has arrived" / "Heading to {{dest}}" |
| `CallChatButtons` | driver-matched, in-trip | `phone` icon → `Linking.openURL('tel:...')`, `message-square` icon → mock chat sheet ("Thanks, I'm outside.") |
| `RouteMap` (reused) | — | Now includes animated driver marker + dashed pickup→destination line |
| `FareReveal` | trip-complete | Big "RM 25.00" centered |
| `Rating` (from `@teeko/ui`) | trip-complete | Required; 1–5 stars; Done disabled until ≥1 selected |

## 3. Mock state transitions (driver-matched is the state machine's UI)

```
trip.status === 'matched'  →  show "Driver is on the way. ETA Xmin"  + moving marker toward pickup
                          →  after ~15s → status = 'arrived'
trip.status === 'arrived'  →  show "Your driver has arrived. Meet at [pickup]"
                          →  [driver taps "Start trip" on driver app — here, tap a hidden debug row OR auto-advance after 8s]
                          →  status = 'in_trip'  → router.replace('/(main)/in-trip')
trip.status === 'in_trip'  →  marker animates along polyline to destination
                          →  on arrival  → status = 'completed' → router.replace('/(main)/trip-complete')
```

All transitions are timer-driven inside `trip-store` (§04-mock-data §4).

## 4. Driver-matched layout (PRD §4.7)

- Full-screen map (driver marker + pickup pin; polyline visible).
- Bottom card (snap point, not dismissable): driver fields listed in PRD §4.7.
- Call button (phone icon) → `Linking.openURL('tel:+60127777777')` — mock number from seed driver.
- Chat button (message-square icon) → opens a mock chat bottom sheet (`MockChatSheet`) with two pre-canned driver messages; input is inert in v0.1 (label field greyed with "Chat coming soon").
- Trip status indicator: bold text above driver name.

## 5. Driver-arrived (PRD §4.8)

- Same screen; status text swaps to "Your driver has arrived".
- ETA line replaced with "Meet your driver at {{pickup.name}}".
- Foreground in-app banner (via `ui-store.pushToast`): "Your driver has arrived." — mimics push (real push in Expo Go is flaky; see `01-scaffold-gaps.md` gotcha).

## 6. In-trip layout (PRD §4.9)

- Full-screen map:
  - Live route line (pickup → destination)
  - Animated driver marker moving along polyline (250ms tick)
  - Destination pin
  - ETA to destination label on the map (top chip)
- Bottom card (compact): "Heading to {{destination.name}}" + ETA + driver name + plate.
- Call + chat buttons still available.
- Hardware back disabled — prompts `CancelTripSheet` instead (PRD §5 cancellation flow placeholder).

## 7. Trip-complete layout (PRD §4.10)

- Header: "Trip completed"
- Fare: large `RM 25.00`
- "How was your ride with {{driver.name}}?"
- 5 empty stars — tap to set
- Optional comment `Input` with placeholder "Leave a comment (optional)"
- `Done` CTA full-width red — disabled until ≥1 star
- On Done:
  - `trip-store.rate(stars, comment)` → pushes trip into `trips` history, resets store
  - `router.dismissAll()` → lands on Home (PRD §4.10 "returns to Home")

## 8. Push notifications (stubbed)

Per PRD §6 — wire in-app banners via `ui-store.pushToast(...)` for: matched, arrived, trip started, trip completed. Don't rely on `expo-notifications` for the demo path; keep it as a real-push option for EAS dev builds later.

## 9. Checkpoint demo

End of Phase C: a reviewer can complete a full ride in one tap sequence. Fare shows, rating saved, ride appears in Rides tab after Done. Cancel sheet reachable from driver-matched and in-trip.
