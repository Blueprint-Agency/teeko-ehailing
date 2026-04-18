# Stitch Hero Mockups — Visual Direction

> **Purpose:** Visual direction exercise via Stitch before building `@teeko/ui` primitives in Phase 02.
> **Status:** Direction locked · **Updated:** 2026-04-18 (after first iteration round)

## Project

- **Stitch project:** `Teeko Rider — v0.1 Mockup`
- **Project ID:** `11765744668585250466`
- **Design system asset:** `assets/6146508199636950124` (name "Teeko Rider")

## Current screens in the project

| # | Title | Screen ID | Status |
|---|-------|-----------|--------|
| 1 | **Teeko Home Refined** | `23a2510789254221b749b04bed23b387` | ✅ Locked |
| 2 | **Teeko Ride Selection Refined** | `eb59e9b811774bb6ba054fd8938aea29` | ✅ Locked |
| 3 | **Teeko Account Refined** | `04f5b3e91e674a0aa91dd8e8e9ddae99` | ✅ Locked |
| — | 5 reference uploads (`image.png`) | `15656257405691404501/404947/406015/406461/407529` | User inspiration, not generation targets |

Driver Matched was generated in round 1 but not retained in the refined pass. It'll be regenerated when we reach Phase C (trip) with a spec grounded in these new tokens.

## Tokens locked in (matches refined HTML verbatim)

```ts
colors: {
  primary: '#E11D2E',
  surface: '#FFFFFF',
  muted:   '#F5F5F7',
  raised:  '#FAFAFA',
  ink:     { primary: '#111111', secondary: '#4B5563', faint: '#9CA3AF' },
  border:  '#E5E7EB',
}
fontFamily: { headline, body, label } = Nunito Sans
borderRadius: { DEFAULT: 8, lg: 16, xl: 24, full: 9999 }
```

These are mirrored in `apps/rider/tailwind.config.ts` and documented in `02-design-system.md`.

## Component & layout decisions observed

### Cross-screen
- **Icon library:** Material Symbols Outlined, with `FILL` variations for active/inactive state (active tab = `FILL 1`, inactive = `FILL 0`). **Not Lucide.** `02-design-system.md §3` reflects this.
- **Cards:** `rounded-xl` (24px) + `border border-border` + `shadow-sm`. Softer than my initial spec.
- **Gutter:** 20px horizontal (`px-5` in Tailwind).
- **Primary CTAs:** full-width, `bg-primary text-surface py-4 rounded-full font-bold text-lg`, with `active:scale-[0.98]` press feedback.
- **Ghost buttons:** `border border-border rounded-lg` or `rounded-full`, white bg, ink-primary text.
- **Rating pill pattern:** small inline pill — `bg-surface px-2 py-1 rounded-full border border-border shadow-sm` — with filled star icon + rating number.

### Home screen
- No map on Home (confirmed — map only starts at confirm-destination).
- **New element: "Smarter ride planning" promo card** — `rounded-xl` card with a `calendar_month` icon in a red-tint circle (`bg-red-50`), headline + subtitle, tappable. Positioned prominently on Home as an entry to advance booking.
- Bottom tab bar: Home active (primary red, `FILL 1`), Rides (`directions_car`, faint), Account (`person`, faint).

### Ride Selection
- Map occupies top 55%, ride list + payment selector + CTA stacked in bottom 45%.
- Payment selector renders as a `rounded-lg` outline button (not a dropdown) with a small coloured brand tile ("TnG" in blue `#0055A5`) + wallet label + chevron_right.
- Primary CTA pinned to safe-area-aware footer.

### Account
- Header has user name + rating pill (inline star + number + "Rating" label) + circular `edit` button on the right.
- **Saved places as 2-col grid of `rounded-xl` cards** (not list rows) — each shows icon (in `rounded-full bg-muted` circle), label, address.
- "Smarter ride planning" promo card repeated here.
- Menu items use `text-base font-medium text-ink-primary` with right `chevron_right` in `text-ink-faint`.

## Scope implication: advance booking / scheduled rides

Both refined mockups show a "Smarter ride planning — schedule rides in advance" promo card. The rider PRD (§9) says scheduling is deferred (no "Upcoming" tab). The core PRD does list advance booking as MVP.

**Resolution:** keep the promo card as a visual element; defer the actual scheduling flow to post-MVP but wire the CTA to a "Coming soon" toast or a simple stub screen. Revisit during Phase D.

## Next step

Phase 02 (`@teeko/ui` primitives) can start. Primitives to build, mapped to their first appearance in the mockups:

| Primitive | First used in |
|-----------|---------------|
| `Text` (ink-primary / secondary / faint variants) | all |
| `Icon` (Material Symbols wrapper, FILL prop) | all |
| `Button` (primary pill, ghost, icon-button circles) | Ride Selection CTA, Account edit |
| `Card` (`rounded-xl` + border + shadow-sm) | Home promo, Account saved-place tile |
| `ListRow` / `ListItem` (left icon chip + title/subtitle + trailing chevron) | Home recent places, Account menu |
| `RatingPill` | Account header |
| `ScreenContainer` | all |
| `TabBar` (FILL 0/1 handling) | app shell |
| `BottomSheet` (flush to map, 16px top corners) | ride selection, driver matched |

## Cache

Refined HTML is cached locally (git-ignored) at `.stitch-cache/{home,ride-selection,account}-refined.html` for grep/reference without re-downloading.
