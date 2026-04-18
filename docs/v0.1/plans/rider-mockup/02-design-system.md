# 02 — Design system

The rider app is **clean, trustworthy, affordable** (PRD §1). This document defines the tokens and primitive components needed before any feature screen gets built.

## 1. Tokens (Tailwind theme)

Locked in `apps/rider/tailwind.config.ts`. Token naming matches the refined Stitch mockups (see `stitch-hero-mockups.md`). Exact red hex still TBD with the brand team — `#E11D2E` is the working value.

| Token | Value | Used for |
|-------|-------|----------|
| `bg-primary` | `#E11D2E` | CTA buttons, selected states, brand accents only — never as a surface |
| `bg-surface` | `#FFFFFF` | Primary page/card background |
| `bg-muted` | `#F5F5F7` | Secondary tiles, skeletons, input backgrounds, subtle contrast |
| `bg-raised` | `#FAFAFA` | Floating raised surfaces (rare) |
| `text-ink-primary` | `#111111` | Primary text |
| `text-ink-secondary` | `#4B5563` | Subtitles, captions, secondary metadata |
| `text-ink-faint` | `#9CA3AF` | Placeholders, inactive tab labels |
| `border-border` | `#E5E7EB` | 1px dividers, card borders, input borders |
| `rounded-DEFAULT` | 8px | Tight elements (chips, small inline pills) |
| `rounded-lg` | 16px | Standard cards, inputs, bottom sheet top corners |
| `rounded-xl` | 24px | Softer "hero" cards (promo, saved-place tiles) |
| `rounded-full` | 9999px | Pill CTAs, avatars, floating buttons |
| `spacing.gutter` | 20px | Screen horizontal padding |

Light mode only — no `dark:` variants. Dark mode explicitly excluded (PRD §2).

**Elevation:** flat by default. `shadow-sm` only on: floating buttons (current-location, back overlay), "hero" cards that need lifting off a muted bg. Never use `shadow-md` or larger.

## 2. Typography

- **Font:** Nunito (`@expo-google-fonts/nunito`), loaded once in root `_layout.tsx` via `useFonts`.
- **Scale** (NativeWind):
  - `text-3xl` (30) — screen headlines ("Travel Easily with Teeko.")
  - `text-xl` (20) — section titles
  - `text-base` (16) — body
  - `text-sm` (14) — secondary
  - `text-xs` (12) — meta / captions
- All body text is `font-sans`, CTAs are `font-bold`, addresses/names are `font-medium`.

## 3. Icon set

**Material Symbols Outlined** (per the refined Stitch mockups). Supports FILL 0/1 variants for active/inactive states (used on the bottom tab bar: active tabs render with `FILL 1`, inactive with `FILL 0`). Centralise sizing in `@teeko/ui/Icon`:

```tsx
<Icon name="home" size={24} filled />   // FILL 1, 24px
<Icon name="home" size={24} />          // FILL 0, outline
```

Canonical icon names used in the rider app (Material Symbols Outlined naming):
`home`, `directions_car`, `person`, `search`, `schedule` (clock), `location_on`, `chevron_right`, `chevron_left`, `close`, `call`, `chat_bubble`, `star`, `lock`, `shield`, `work`, `add`, `two_wheeler` (bike), `credit_card`, `calendar_month`, `edit`, `arrow_forward`, `my_location`.

> `lucide-react-native` is still installed (Phase 01 dep). We can keep it for cases Material Symbols can't cover — but default to Material Symbols for visual consistency with the mockups. Pick ONE source per component; don't mix within a single screen.

## 4. `@teeko/ui` primitives

All primitives live in `packages/ui/src/`. Each one is a small, styled wrapper — not a heavy component library.

| Component | Props (shape) | Notes |
|-----------|---------------|-------|
| `Text` | `variant`, `className`, ... | Applies font family + default `ink` color |
| `Button` | `variant: 'primary' \| 'ghost' \| 'text'`, `size`, `loading`, `disabled`, `onPress`, children | Primary = red pill, full-width default; haptic tap |
| `Input` | `label`, `value`, `onChangeText`, `error`, `leadingIcon`, `placeholder`, `keyboardType` | Used for phone, search, saved-place labels |
| `OTPInput` | `length=6`, `value`, `onChange`, `autoFocus` | 6 discrete boxes; auto-advance |
| `Card` | `className`, children | `rounded-card bg-surface border border-border p-4` |
| `ListRow` | `leading`, `title`, `subtitle`, `trailing`, `onPress` | Used for recent places, account menu, past rides |
| `BottomSheet` | Thin wrapper over `@gorhom/bottom-sheet` with rider defaults (rounded-top, handle, snap points) |
| `ScreenContainer` | `edges`, `className` | Handles safe-area + default padding |
| `Avatar` | `uri`, `size`, `fallback` | Circular; used on driver card + account |
| `Rating` | `value`, `onChange?`, `size` | 5 stars; interactive if `onChange` provided |
| `Pill` | `selected`, `onPress`, children | Used for ride-type chips, payment chips, language chips |
| `Spinner` | `size`, `color` | Used on finding-driver screen |

## 5. Component hierarchy rule

- **Primitives** (above) live in `@teeko/ui`.
- **Composed rider components** (e.g., `RideTypeCard`, `DriverCard`, `RecentPlaceRow`) live in `apps/rider/components/`.
- **Screens** in `apps/rider/app/**/*.tsx` compose rider components + primitives. Screens do **not** style raw `View`/`Text` with arbitrary classes — they build from the library.

## 6. Empty / loading / error states

Every list or async surface gets three states from day one:

| State | Pattern |
|-------|---------|
| Loading | `Spinner` centered, or skeleton rows (for Rides tab) |
| Empty | Illustration + one-line message + optional CTA (e.g., "No rides yet. Tap Home to book your first ride.") |
| Error | `danger` icon + short message + "Try again" ghost button |

Skeletons: use `bg-surface-muted` with a subtle reanimated pulse.

## 7. Motion

- **Tap feedback:** every interactive primitive uses `expo-haptics` `selectionAsync` on press start; CTAs use `impactAsync('Light')`.
- **Route transitions:** default Expo Router native stack transitions. No custom transitions in v0.1.
- **Driver marker animation:** see `04-mock-data.md`.

## 8. Accessibility floor

- All buttons, pressables have `accessibilityRole` and `accessibilityLabel` (i18n key'd).
- Min tap target 44×44.
- Color contrast: primary CTA red on white passes WCAG AA for large text; do not use primary red for small body copy.
- Dynamic type: respect system font scaling (default RN behavior — don't hard-code `allowFontScaling={false}`).
