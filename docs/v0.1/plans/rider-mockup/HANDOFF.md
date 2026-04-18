# Handoff prompt for a new Claude Code session

Paste the block below as your first message in a fresh Claude Code session opened in this repo (`C:\Users\chris\Desktop\blueprint\teeko\teeko-ehailing`). It carries the context needed to keep building without re-asking foundational questions.

---

## Copy from here ⬇

I'm continuing work on the **Teeko rider app v0.1 mockup**. This is a Malaysian e-hailing app (Grab/Bolt competitor) in frontend-only / mock-data phase. Read the repo's `CLAUDE.md` first for product context, then **always** load the plan folder before acting.

**Plan (read in this order):**
1. `docs/v0.1/plans/rider-mockup/README.md` — index of all plan docs
2. `docs/v0.1/plans/rider-mockup/00-overview.md` — goals, stack, DoD, 4-week milestones
3. `docs/v0.1/plans/rider-mockup/stitch-hero-mockups.md` — locked visual direction, token rationale, Stitch project reference
4. `docs/v0.1/plans/rider-mockup/02-design-system.md` — tokens, primitives (source of truth for UI)
5. `docs/v0.1/plans/rider-mockup/03-navigation.md` — Expo Router tree to build in Phase 03
6. `docs/v0.1/plans/rider-mockup/04-mock-data.md` — `@teeko/api` layout, stores, trip state machine
7. `docs/v0.1/prd/teeko-rider-prd.md` — product requirements (single source of truth for screen specs)

**What's done (do not redo):**
- Phase 01 — Monorepo scaffold. pnpm (not Turbo) workspace, Expo SDK 52, RN 0.76, Expo Router 4, NativeWind v4, Zustand, react-native-maps, lucide, @gorhom/bottom-sheet, i18next — all installed. Packages `@teeko/ui`, `@teeko/maps`, `@teeko/i18n`, `@teeko/api` created as stubs. `apps/rider/` has `tailwind.config.ts`, `global.css`, `nativewind-env.d.ts`, `metro.config.js` (with `withNativeWind` + monorepo resolver), `babel.config.js` (NativeWind preset + reanimated plugin last), and `app.json` with scheme `teeko` + expo-location/expo-notifications/expo-localization plugins + Google Maps API key placeholders.
- Phase 02 — `@teeko/ui` primitives built: `Text`, `Icon` (MaterialIcons wrapper, not Lucide), `Pressable` (with haptics), `Button`, `Card`, `ListRow`, `RatingPill`, `ScreenContainer`. Plus `cn()` helper. Barrel export from `packages/ui/src/index.ts`. `apps/rider/app/index.tsx` is currently a primitive showcase screen — **replace it when Phase 03 starts**.

**What's next (pick up here):**
- **Phase 03 — Navigation shell** (`03-navigation.md`). Build the full Expo Router tree with placeholder screens so the whole app skeleton walks. Create `(auth)/`, `(main)/(tabs)/`, modal screens (`search`, `confirm-destination`, `ride-selection`, `finding-driver`, `driver-matched`, `in-trip`, `trip-complete`, `receipt/[id]`). Build a `TabBar` primitive in `@teeko/ui` using MaterialIcons with active/inactive treatment (active = filled-ish + `text-primary`, inactive = `text-ink-faint`). Rides tab is the default landing screen per PRD §3.1.
- Then Phase 04 (mock data + Zustand stores), then Phases A–E.

**Locked decisions — do not revisit without asking:**
- Tokens (see `tailwind.config.ts` + `02-design-system.md`): primary `#E11D2E`; ink.primary/secondary/faint `#111111`/`#4B5563`/`#9CA3AF`; muted `#F5F5F7`; raised `#FAFAFA`; border `#E5E7EB`; radii DEFAULT 8 / lg 16 / xl 24 / full 9999; font Nunito Sans (`headline`, `body`, `label`).
- **Light mode only** — no dark variants anywhere in the rider app (driver app handles its own).
- **Icons:** `@expo/vector-icons/MaterialIcons` (hyphenated names like `chevron-right`). Lucide is installed but unused — prefer Material. Don't mix within a screen.
- **Cards:** `rounded-xl` + `border` + `shadow-sm` for hero cards; `rounded-lg` for standard.
- **Primary CTAs:** full-width red pill, white label, safe-area-aware footer, `active:opacity-90`.
- **Advance booking:** PRD §9 defers the scheduling flow, but the refined Stitch mockups include a "Smarter ride planning" promo card — keep the card visible, route it to a stub "Coming soon" state.
- **Mocks:** every API call goes through `@teeko/api` handlers that await `simulateLatency(400, 1200)` before returning seed JSON. No component imports JSON directly.
- **Typing:** `pnpm -r typecheck` must stay green at every checkpoint. Run it before saying a phase is done.

**Stitch project (visual direction reference):**
- Project ID: `11765744668585250466` · design system asset `assets/6146508199636950124`
- 3 refined hero screens (Home, Ride Selection, Account) — IDs in `stitch-hero-mockups.md`
- To pull the latest from Stitch if the user has iterated there: use the MCP tools `mcp__stitch__list_screens` then `curl` the `htmlCode.downloadUrl` into `.stitch-cache/` (git-ignored) and grep for updated tokens. Ask before regenerating — user may have specific direction in mind.

**Workflow rules for this repo:**
- Commands producing >20 lines: use `mcp__plugin_context-mode_context-mode__ctx_execute` (shell) instead of raw Bash. Reading small config files for editing is fine via the `Read` tool.
- **Auto-memory** lives in `C:\Users\chris\.claude\projects\C--Users-chris-Desktop-blueprint-teeko-teeko-ehailing\memory\`. Check `MEMORY.md` early; add project/feedback memories when the user reveals durable preferences.
- **Use TaskCreate/TaskUpdate** to track multi-step work. Mark tasks done as soon as they're done, not in batches.
- **Never commit** unless the user explicitly asks. When committing, no `--no-verify` / skipping hooks.
- `apps/rider` dev server: `pnpm --filter @teeko/rider dev`. Do NOT start it autonomously — it blocks. Tell the user to run it.
- The user is building for APAD/JPJ e-hailing licence support; MVP is 1 month. Keep scope tight — nothing beyond the PRD.

**Ask me (the user) when uncertain about:** PRD/policy gaps (cancellation fees, pricing), brand assets (logo, final hex), user-flow ambiguities. Don't invent product rules.

Start by running `pnpm -r typecheck` to confirm the tree is green, then propose a plan for Phase 03 and wait for my go-ahead before writing code.

## ⬆ Copy to here

---

## Why this prompt works

- **Anchors to docs, doesn't duplicate them.** The new session reads the real source of truth instead of a potentially stale summary in the prompt.
- **Names what's locked vs. what's open.** Prevents re-debating tokens / icon library / scope.
- **Ends with a small, safe first action.** `pnpm -r typecheck` verifies the handoff landed in a green state before any edits.
- **Lets the user redirect early.** The "propose a plan for Phase 03 and wait" line keeps control with you.

## Tips for the new session

- Leave `CLAUDE.md` alone in your first turn — the docs already cover project context. Edit `CLAUDE.md` only when you learn something durable that should persist across all future sessions.
- The monorepo uses `pnpm -r` recursively, not Turbo. Don't "fix" this.
- `apps/rider/app/index.tsx` is currently a primitive showcase, not a real Home. Phase 03 will replace it with a route skeleton and move the showcase to a dev-only route (or delete it).
- If you invoke Stitch MCP tools in the new session, re-use project `11765744668585250466`. Don't create a new project unless the user says so.
