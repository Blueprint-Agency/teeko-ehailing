# 01 — Scaffold gaps

Inventory of what's already in the repo vs what this plan has to add. Source of truth: `pnpm-workspace.yaml`, root `package.json`, `apps/rider/package.json`, and a scan of `packages/`.

## 1. What's already in place ✅

**Monorepo root**
- `pnpm-workspace.yaml` — `apps/*`, `packages/*`, `docs`
- `package.json` — turbo scripts (`dev:rider`, `typecheck`, …), `packageManager: pnpm@9.15.0`
- `pnpm-lock.yaml`, `node_modules/` installed
- `Makefile`, `.gitignore`, `.npmrc`, `README.md`

**`apps/rider/`**
- `package.json` — `@teeko/rider`, Expo 52, RN 0.76.5, `expo-router ~4`, safe-area, screens
- `app.json`, `babel.config.js`, `.gitignore`
- `app/_layout.tsx`, `app/index.tsx` (starter)
- `assets/` folder (empty / defaults)
- `dist/` — evidence of a prior `expo export` run; ignore

**`packages/config/`**
- `prettier.config.js`
- `tsconfig/base.json`, `tsconfig/react-native.json`
- `package.json` — `@teeko/config`

**`packages/shared/`**
- `package.json` — `@teeko/shared`, depends on `zod ^3.24`
- `src/index.ts`, `src/types/`, `src/schemas/`, `src/locales/` (directory stubs)

**`apps/driver/`, `apps/web/`** — out of scope for this plan; leave untouched.

## 2. Packages to create

Per `teeko-frontend-architecture.md` §3, four shared packages are still missing. Create each with a minimal `package.json` + `src/index.ts`:

| Package | Purpose (one line) | Key deps |
|---------|-------------------|----------|
| `@teeko/ui` | Shared primitives (Button, Input, OTPInput, BottomSheet, Text, Card, Icon) styled via NativeWind | `react`, `react-native`, `nativewind`, peer: `@teeko/shared` |
| `@teeko/maps` | Thin wrappers over `react-native-maps` (MapView, Marker, Polyline, CurrentLocationButton) | `react-native-maps`, `expo-location` |
| `@teeko/i18n` | i18next + react-i18next setup, locale JSON loaders, `useT()` hook, language detection | `i18next`, `react-i18next`, `expo-localization` |
| `@teeko/api` | Mock client, JSON seed loaders, Zustand stores (auth, trip, location, ui, payments) | `zustand`, `@teeko/shared` |

> `@teeko/shared` and `@teeko/config` stay as-is; types and zod schemas get filled out as phases progress.

## 3. Rider-app dependencies to add

Run from `apps/rider/`:

```bash
pnpm add nativewind tailwindcss \
  zustand \
  react-native-maps \
  expo-location expo-notifications expo-localization expo-image \
  expo-haptics \
  lucide-react-native \
  react-native-gesture-handler react-native-reanimated \
  @gorhom/bottom-sheet \
  i18next react-i18next \
  @teeko/ui @teeko/maps @teeko/i18n @teeko/api

pnpm add -D tailwindcss@^3.4 @types/node
```

Versions must be the Expo-SDK-52-compatible ones — run `npx expo install` for anything that prompts a mismatch warning.

## 4. Rider-app config files to add

| File | Purpose |
|------|---------|
| `apps/rider/tailwind.config.ts` | Rider theme (red primary, light only) — see `02-design-system.md` |
| `apps/rider/global.css` | `@tailwind base; @tailwind components; @tailwind utilities;` |
| `apps/rider/metro.config.js` | NativeWind v4 + monorepo `watchFolders` + `nodeModulesPaths` |
| `apps/rider/babel.config.js` (update) | Add `"nativewind/babel"` preset and `react-native-reanimated/plugin` (last) |
| `apps/rider/tsconfig.json` (create) | Extend `@teeko/config/tsconfig/react-native.json`, add `@/*` path alias to `./`  |
| `apps/rider/nativewind-env.d.ts` | NativeWind ambient types |
| `apps/rider/app.json` (update) | Add `scheme: "teeko"`, `ios.infoPlist` location strings, `android.config.googleMaps.apiKey` placeholder, `plugins: ["expo-router", "expo-location", "expo-notifications"]` |

## 5. Root / tooling adds

- `turbo.json` — pipeline for `dev`, `typecheck`, `lint`, `build` (if not already present)
- `packages/config/eslint/` — base + react-native eslint configs (optional for v0.1; defer if rushed)

## 6. Gotchas to record in CLAUDE.md

- **NativeWind v4 + monorepo** requires explicit `experimental.inlineRequires: false` workaround in some Metro configs — verify with `pnpm dev:rider` on a clean install and pin the working config.
- **react-native-maps Google provider on Android in Expo Go** is unsupported; default provider renders Apple-style tiles on iOS and OSM-ish on Android. Use EAS dev builds for Android demos. Document this in the demo script.
- **expo-notifications** has no sound / no delivery in Expo Go on Android 13+ — use foreground in-app banners for demo reliability instead of real OS push.
- **Reanimated Babel plugin must be last** in `babel.config.js` plugins array.

## 7. Exit criteria for this phase

- [ ] `pnpm install` clean from repo root
- [ ] `pnpm dev:rider` boots on iOS simulator / Expo Go showing existing starter screen with NativeWind classes rendering (`className="text-red-500"` on a `Text` turns red)
- [ ] `pnpm typecheck` green across all workspaces
- [ ] All four new packages have an `index.ts` that exports at least one named symbol (so imports don't dangle)
- [ ] `app.json` has a valid `scheme` and location-permission strings
