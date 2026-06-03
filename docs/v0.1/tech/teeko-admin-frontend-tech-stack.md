# Teeko — Admin Panel Frontend Tech Stack

> **Version:** 1.0
> **Date:** 2026-05-14
> **Status:** Draft
> **Scope:** v0.1 Mockup (frontend only — no backend, $0 cost)
> **Companion PRD:** `prd/teeko-admin-prd.md`
> **Related docs:** `tech/teeko-driver-web-frontend-tech-stack.md`, `tech/teeko-frontend-architecture.md`

---

## Contents

1. [Overview](#overview)
2. [Monorepo Architecture](#monorepo-architecture)
3. [App Architecture — Route Structure](#app-architecture--route-structure)
4. [Screen Inventory](#screen-inventory)
5. [Package Decisions](#package-decisions)
   - [Framework — Next.js 15 + React 19](#1-framework--nextjs-15--react-19)
   - [Routing — Next.js App Router](#2-routing--nextjs-app-router)
   - [UI Library — Material UI (MUI) v6](#3-ui-library--material-ui-mui-v6)
   - [Tables — MUI X DataGrid](#4-tables--mui-x-datagrid)
   - [Charts — MUI X Charts](#5-charts--mui-x-charts)
   - [Maps — @vis.gl/react-google-maps](#6-maps--visglreact-google-maps)
   - [Forms — react-hook-form + zod](#7-forms--react-hook-form--zod)
   - [State Management — Zustand](#8-state-management--zustand)
   - [Mock Auth & RBAC](#9-mock-auth--rbac)
6. [Mock Data Files](#mock-data-files)
7. [Zustand Stores](#zustand-stores)
8. [Packages Deferred to v1.0](#packages-deferred-to-v10)
9. [Full Package List](#full-package-list)
10. [Stack Summary](#stack-summary)

---

## Overview

The Teeko Admin Panel is the internal web application used by Teeko operations, support, and finance teams to manage the entire platform. It handles driver onboarding workflows, live trip monitoring, dispute resolution, surge pricing control, payout management, and compliance tooling.

This document covers the **admin panel frontend stack** for **v0.1 (mockup phase)** — no backend, no real auth, no live data. All state is simulated locally via Zustand and JSON fixtures.

### Guiding principles

1. **Internal tool aesthetic.** MUI's data-dense, grid-based design language is appropriate for staff-facing dashboards — not a consumer app. Prioritise information density over visual flair.
2. **Zero backend in v0.1.** No API calls, no real auth, no database. All state lives in Zustand stores seeded from local JSON fixtures.
3. **Carry forward.** Every package chosen for v0.1 is the production choice for v1.0. No throwaway code.
4. **Monorepo consistency.** `apps/admin` lives in the same pnpm workspace as the rider and driver apps. Shared Zod schemas and TypeScript types come from `packages/shared`.
5. **All 22 screens.** The full PRD §13 screen inventory is implemented in v0.1. RBAC visibility rules (which actions each role can take) are enforced in the mockup so stakeholders can demo each role independently.

---

## Monorepo Architecture

The admin panel is added as `apps/admin` in the existing pnpm workspace.

```
teeko/                              ← monorepo root
  pnpm-workspace.yaml
  package.json                      ← root scripts (lint, typecheck all)

  apps/
    rider/                          ← Expo rider app
    driver/                         ← Expo driver app
    driver-web/                     ← Next.js driver-partner web portal
    admin/                          ← new Next.js 15 app (this document)
      next.config.ts
      app/                          ← Next.js App Router root
        layout.tsx                  ← root layout (MUI ThemeProvider, Zustand providers)
        (auth)/
          login/page.tsx            ← Mock login — 4 hardcoded accounts
        (panel)/
          layout.tsx                ← Shared admin shell (sidebar, topbar, auth guard)
          dashboard/page.tsx
          drivers/
            page.tsx                ← Driver list
            [id]/page.tsx           ← Driver profile
            documents/page.tsx      ← Document review queue
            evp/page.tsx            ← EVP tracker
            appeals/page.tsx        ← Appeals queue
          riders/
            page.tsx                ← Rider list
            [id]/page.tsx           ← Rider profile
          trips/
            live/page.tsx           ← Live trip map
            page.tsx                ← Trip history
            [id]/page.tsx           ← Trip detail
          disputes/page.tsx
          surge/page.tsx
          commissions/page.tsx
          incentives/page.tsx
          payouts/page.tsx
          reports/page.tsx
          pdpa/page.tsx
          audit/page.tsx
          support/page.tsx
          notifications/page.tsx
          settings/
            admins/page.tsx         ← Super Admin only
      components/
        layout/                     ← AdminShell, Sidebar, Topbar, Breadcrumb
        data/                       ← DataGrid wrappers, FilterBar, ExportButton
        maps/                       ← LiveTripMap, SurgeZoneMap
        charts/                     ← RevenueChart, TripVolumeChart, MetricCard
        admin/                      ← Domain components (DriverCard, DocumentSlot, DisputePanel…)
      stores/                       ← Zustand stores
      data/                         ← Mock JSON fixtures
      hooks/                        ← Custom hooks (useLiveDashboard, useRbac…)
      lib/                          ← MUI theme, utils, rbac config
      middleware.ts                 ← Route protection (redirect to /login if unauthenticated)

  packages/
    shared/                         ← Shared across all apps
      schemas/                      ← Zod validation schemas
      types/                        ← TypeScript interfaces (Driver, Rider, Trip, Payout…)
```

---

## App Architecture — Route Structure

```
/login                              ← (auth)/login — 4 hardcoded mock accounts

/dashboard                          ← (panel)/dashboard — Live platform overview

/drivers                            ← Driver list (filterable, searchable)
/drivers/[id]                       ← Driver profile (docs, vehicles, history, actions)
/drivers/documents                  ← Document review queue
/drivers/evp                        ← EVP application tracker
/drivers/appeals                    ← Suspension appeals queue

/riders                             ← Rider list
/riders/[id]                        ← Rider profile (history, reports, actions)

/trips/live                         ← Real-time map of active trips (mock interval updates)
/trips                              ← Trip history (filterable log)
/trips/[id]                         ← Trip detail (fare breakdown, dispute/refund actions)

/disputes                           ← Disputes queue (riders + drivers)

/surge                              ← Surge control (map, rules, manual override)

/commissions                        ← Commission configuration (platform-wide + per-driver)
/incentives                         ← Driver bonus campaigns
/payouts                            ← Payout management (weekly cycle, early cashout)

/reports                            ← Revenue, payout, and trip reports with CSV export

/pdpa                               ← PDPA tools (erasure, SAR export, consent log)
/audit                              ← Immutable audit log

/support                            ← Support ticket queue (riders + drivers)
/notifications                      ← Broadcast notification sender

/settings/admins                    ← Admin user management (Super Admin only)
```

### Admin shell layout

All `(panel)` routes are wrapped by `app/(panel)/layout.tsx`:
- **Left sidebar** — nav links grouped by category (Users, Trips, Finance, Compliance, Settings). Links hidden based on role (e.g. Finance nav hidden from Support role).
- **Top bar** — active admin name, role badge, logout.
- **Auth guard** — `middleware.ts` redirects unauthenticated users to `/login`.
- **Role guard** — `useRbac()` hook; pages that require elevated roles render a 403 state if the current mock role is insufficient (e.g. `/settings/admins` is Super Admin only).

### Client components

All interactive screens use `'use client'` — MUI's Emotion runtime, Zustand stores, and react-hook-form are all client-side. Server components are used only for the root layout (ThemeProvider injection) and static layout shells.

---

## Screen Inventory

All 22 screens from PRD §13, mapped to routes and key UI elements.

| Screen | Route | Key UI Elements |
|--------|-------|----------------|
| Dashboard | `/dashboard` | 6 × live metric cards, alerts panel, `setInterval` mock refresh |
| Driver List | `/drivers` | MUI DataGrid, status/city/category filters, search bar |
| Driver Profile | `/drivers/[id]` | Profile header, document status cards, vehicle table, action buttons (role-gated) |
| Document Review Queue | `/drivers/documents` | DataGrid, per-document approve/reject with reason dialog |
| EVP Tracker | `/drivers/evp` | DataGrid, status badges, expiry date highlighting |
| Appeals Queue | `/drivers/appeals` | DataGrid, appeal detail drawer, approve/reject actions |
| Rider List | `/riders` | DataGrid, status/city/date filters, search bar |
| Rider Profile | `/riders/[id]` | Profile header, ride history table, escalation level badge, action buttons |
| Live Trip Map | `/trips/live` | Google Maps with trip pin cluster, filter by city/category, click-to-expand trip card |
| Trip History | `/trips` | DataGrid, multi-filter (date range, city, driver, rider, status), CSV export |
| Trip Detail | `/trips/[id]` | Fare breakdown table, dispute/refund action panel |
| Disputes Queue | `/disputes` | DataGrid, dispute detail drawer, approve refund / reject / escalate actions |
| Surge Control | `/surge` | Google Maps with surge polygon overlay, rule config form, manual override toggle |
| Commission Settings | `/commissions` | Platform-wide rate form, per-driver override DataGrid, change log table |
| Incentives & Campaigns | `/incentives` | Campaign cards, create/edit campaign form (react-hook-form) |
| Payout Management | `/payouts` | Pending/processed/failed payout DataGrid, manual trigger action |
| Revenue Reports | `/reports` | MUI X Charts (bar/line), date range picker, metric summary cards, CSV export |
| PDPA Tools | `/pdpa` | Erasure request queue, SAR export action, consent log DataGrid |
| Audit Log | `/audit` | Read-only DataGrid, immutable mock data, filter by admin/action/date |
| Support Tickets | `/support` | DataGrid, ticket detail drawer, assign/respond/resolve/escalate actions |
| Broadcast Notifications | `/notifications` | Segment selector (all riders / all drivers / city), message form, send confirmation |
| Admin User Management | `/settings/admins` | User list DataGrid, create/edit/deactivate admin form — Super Admin only |

---

## Package Decisions

### 1. Framework — Next.js 15 + React 19

#### What it does
Provides the development server, build toolchain, file-system routing, and UI rendering via the Next.js App Router. Consistent with `apps/driver-web`.

#### Why Next.js 15
- **Monorepo consistency.** The driver-partner web portal (`apps/driver-web`) already uses Next.js 15. Shared toolchain config (`next.config.ts`, TypeScript, ESLint) can be maintained in one place.
- **Nested layouts.** `app/(panel)/layout.tsx` wraps all admin screens with the sidebar shell once — no per-page shell import.
- **Middleware auth guard.** `middleware.ts` at the app root intercepts all `(panel)` routes and redirects unauthenticated users to `/login` without per-page logic.
- **Vercel deployment.** Deploys to Vercel with zero config. Next.js is Vercel-native — ideal for an internal tool with moderate traffic.
- **v1.0 upgrade path.** At v1.0, Route Handlers (`app/api/`) and Server Actions replace the Zustand mock layer incrementally. Server components can take over data-fetch-heavy pages (reports, audit log) for performance.

---

### 2. Routing — Next.js App Router

#### What it does
All navigation, nested layouts, and route protection use Next.js App Router file-system conventions.

#### Why App Router (not a client-side router)
- **Route groups.** `(auth)` and `(panel)` groups share layouts (login vs. admin shell) without polluting the URL. `/login` and `/dashboard` are clean URLs.
- **`middleware.ts` auth guard.** One file handles all protected route redirects — no per-page `useEffect` guards.
- **Nested layouts.** The admin shell (sidebar + topbar) is defined once in `app/(panel)/layout.tsx`. All 22 screens inherit it automatically.
- **Deep link support.** Each screen has a stable URL — stakeholders can bookmark `/drivers/documents` and link reviewers directly to the document queue.

---

### 3. UI Library — Material UI (MUI) v6

#### What it does
Provides the full component system: layout (`Box`, `Grid2`, `Stack`), navigation (`Drawer`, `AppBar`, `List`), data display (`Chip`, `Avatar`, `Badge`, `Table`), feedback (`Dialog`, `Snackbar`, `Alert`), and form inputs (`TextField`, `Select`, `Autocomplete`, `Switch`).

#### Why MUI
- **Information density.** MUI's default component sizing and spacing is calibrated for data-heavy internal tools — tighter than consumer-facing libraries. This matches the admin panel's requirement to display many fields per screen (e.g. Driver Profile has 30+ data points).
- **DataGrid + Charts + DatePickers in one ecosystem.** MUI X provides all three under a single design token system. No cross-library style coordination needed.
- **Theming.** A single `createTheme()` call in `lib/theme.ts` applies Teeko brand colours (primary, secondary, error states) across all 22 screens consistently. Dark mode for a potential future preference can be toggled at the theme level.
- **Accessibility.** MUI components follow WAI-ARIA patterns — keyboard navigation, focus management, and screen reader support are built in.

#### MUI theme configuration

```ts
// lib/theme.ts
import { createTheme } from '@mui/material/styles';

export const adminTheme = createTheme({
  palette: {
    primary:   { main: '#1A56DB' },   // Teeko blue
    secondary: { main: '#7E3AF2' },   // Teeko purple
    error:     { main: '#E02424' },
    warning:   { main: '#FF5A1F' },
    success:   { main: '#057A55' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
  components: {
    MuiChip:   { defaultProps: { size: 'small' } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});
```

#### Emotion (MUI's CSS-in-JS runtime)

MUI v6 ships with Emotion as its default styling engine. For v0.1 this is fine — the CSS-in-JS runtime overhead is negligible at admin panel scale. At v1.0, MUI's Pigment CSS (zero-runtime, static extraction) can replace Emotion without changing component code.

---

### 4. Tables — MUI X DataGrid

#### What it does
Powers all 12+ list screens: Driver List, Rider List, Trip History, Payout Management, Audit Log, etc.

#### Why MUI X DataGrid (Community tier)
- **Native MUI integration.** Inherits the admin theme token system without style bridging — column headers, row hover states, and sort indicators match the rest of the UI automatically.
- **Built-in features.** Column sorting, column visibility toggle, client-side pagination, row selection (checkboxes), and CSV export are available on the Community (free) tier — covering all v0.1 requirements.
- **Server-side ready.** At v1.0, switching from `rows={localData}` to `rows={serverData}` with `paginationMode="server"` and `filterMode="server"` requires no component replacement — only the data source changes.
- **Column pinning and row grouping** (Pro tier, needed for e.g. payout grouping by driver) are deferred to v1.0 when a licence decision is made.

#### Pattern used across list screens

```tsx
// Consistent pattern for all list screens
<DataGrid
  rows={mockDrivers}
  columns={driverColumns}
  pageSizeOptions={[25, 50, 100]}
  checkboxSelection
  disableRowSelectionOnClick
  slots={{ toolbar: GridToolbar }}
  slotProps={{ toolbar: { showQuickFilter: true } }}
/>
```

The `GridToolbar` slot provides quick-filter search, column visibility menu, and CSV export out of the box — satisfying the search + export requirement across all list screens with no custom UI.

---

### 5. Charts — MUI X Charts

#### What it does
Powers the Revenue Reports screen: commission revenue over time, trip volume by day, payout totals, and refund trends.

#### Why MUI X Charts
- **Zero additional design tokens.** MUI X Charts reads the active MUI theme — chart colours, typography, and grid lines match the admin panel's palette automatically.
- **Required chart types covered.** `BarChart` (revenue by period), `LineChart` (trend over time), and `PieChart` (breakdown by payment method / city) are all available on the free Community tier.
- **Consistent with DataGrid.** Both come from `@mui/x-*` — one upgrade path, one licence tier to consider at v1.0.

#### Dashboard metric cards

The 6 live metric cards on the Dashboard (active trips, drivers online, etc.) use `MetricCard` — a custom component built from MUI `Card`, `Typography`, and `Chip`. These are seeded from Zustand and refreshed via `setInterval` (mock real-time). No chart library is needed for these.

---

### 6. Maps — @vis.gl/react-google-maps

#### What it does
Powers two screens: **Live Trip Map** (`/trips/live`) and **Surge Control** (`/surge`).

#### Why @vis.gl/react-google-maps
- **Google Maps API consistency.** The rider and driver mobile apps use `react-native-maps` backed by the Google Maps SDK — same API key, same tile style, same coordinate system. Admin operations staff will see the same map they know from the mobile apps.
- **Modern React wrapper.** `@vis.gl/react-google-maps` (maintained by the vis.gl / Google team) is the current recommended React wrapper for the Google Maps JavaScript API. It replaces the deprecated `@react-google-maps/api`.
- **Marker clustering.** `<AdvancedMarker>` with `@vis.gl/react-google-maps`'s clustering utilities handles the Live Trip Map use case (many pins during peak hours) without DOM performance issues.
- **Polygon support.** Surge zones are rendered as `<Polygon>` overlays with fill colour keyed to the active multiplier (e.g. light orange = 1.2×, deep orange = 1.5×). The Surge Control screen's manual override toggles polygon opacity.

#### Live Trip Map (mock real-time)

```tsx
// Mock interval: trip pins update every 5 seconds in v0.1
useEffect(() => {
  const interval = setInterval(() => {
    useLiveTripStore.getState().tickPositions();
  }, 5000);
  return () => clearInterval(interval);
}, []);
```

Driver positions are interpolated between mock waypoints — gives a convincing live-map demo without a real Socket.io connection.

#### Google Maps API key

For v0.1, the Maps JavaScript API key is stored in `.env.local` (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`). The `.env.local` file is already in `.gitignore`. At v1.0, the key moves to Vercel environment variables with HTTP referrer restrictions.

---

### 7. Forms — react-hook-form + zod

#### What it does
Manages all admin input forms: reject document (reason field), adjust commission rate, create incentive campaign, manual payout trigger, broadcast notification, admin user creation, surge rule configuration.

#### Why react-hook-form (same as driver web portal)
Uncontrolled inputs, minimal re-renders. Admin forms are simpler than driver onboarding (no multi-step flow) — react-hook-form is sufficient with `Controller` wrappers for MUI inputs.

#### MUI + react-hook-form pattern

```tsx
// MUI TextField wrapped via Controller
<Controller
  name="commissionRate"
  control={control}
  render={({ field, fieldState }) => (
    <TextField
      {...field}
      label="Commission Rate (%)"
      error={!!fieldState.error}
      helperText={fieldState.error?.message}
    />
  )}
/>
```

#### Shared zod schemas

Commission rate bounds, incentive campaign date ranges, and broadcast message max-length rules are defined as Zod schemas in `packages/shared/schemas/admin.ts`. These same schemas will be used by the v1.0 API route handlers — written once, validated on both client and server.

---

### 8. State Management — Zustand

#### What it does
Manages all client-side state: mock auth session, mock entity data (drivers, riders, trips, payouts), live dashboard tick state, and UI state (selected filters, open drawers).

#### Why Zustand
Same library used in `apps/rider`, `apps/driver`, and `apps/driver-web` — no context switching for developers working across apps. `persist` middleware syncs auth session to `sessionStorage` so a page refresh does not log the admin out during a demo.

---

### 9. Mock Auth & RBAC

#### Mock login

Four hardcoded accounts — one per role. The login screen (`/login`) presents a standard email + password form backed by `useAdminAuthStore`. The store checks credentials against a hardcoded lookup table and sets `mockAdminProfile.role`.

```ts
// lib/mock-accounts.ts
export const MOCK_ACCOUNTS = [
  { email: 'superadmin@teeko.my',  password: 'demo1234', role: 'super_admin'  },
  { email: 'ops@teeko.my',         password: 'demo1234', role: 'operations'   },
  { email: 'support@teeko.my',     password: 'demo1234', role: 'support'      },
  { email: 'finance@teeko.my',     password: 'demo1234', role: 'finance'      },
];
```

The login screen shows a **"Demo Accounts"** helper panel listing all four emails and the shared password — so stakeholders can switch roles without memorising credentials.

#### RBAC enforcement

`useRbac()` is a custom hook that reads `useAdminAuthStore().role` and exposes permission checks:

```ts
const { can } = useRbac();

// In Driver Profile action buttons:
{can('deactivate_driver') && <Button color="error">Deactivate</Button>}
{can('adjust_commission')  && <Button>Adjust Commission</Button>}
```

Permission rules are defined in `lib/rbac-config.ts` — a single mapping from action name to allowed roles, derived directly from PRD §4.5 and §5.3. No third-party RBAC library is needed for v0.1.

Sidebar navigation links are filtered by role — Finance sees Finance nav only; Operations sees Driver Management and Trips; Support sees Riders, Disputes, and Support Tickets.

---

## Mock Data Files

All mock data lives in `apps/admin/data/`. Zustand stores seed from these files on app start.

```
apps/admin/data/
  mock-drivers.json           ← 20 mock drivers across all statuses + EVP states
  mock-riders.json            ← 15 mock riders including banned and flagged accounts
  mock-trips.json             ← 50 mock trips (completed, cancelled, in-progress)
  mock-live-trips.json        ← 8 mock active trips with GPS waypoints for map animation
  mock-payouts.json           ← Pending and processed payouts, 2 failed
  mock-disputes.json          ← 6 open disputes across different categories
  mock-support-tickets.json   ← 10 support tickets in various states
  mock-revenue.json           ← 90 days of daily revenue/payout/refund data for charts
  mock-surge-zones.json       ← KL surge zone polygons with multipliers
  mock-audit-log.json         ← 100 mock audit entries across all admin actions
  mock-admin-users.json       ← 4 admin accounts matching the 4 mock login credentials
  mock-notifications.json     ← Sent broadcast notification history
```

---

## Zustand Stores

| Store | Key state | Persisted? |
|-------|-----------|------------|
| `useAdminAuthStore` | `isAuthenticated`, `mockAdminProfile` (`id`, `name`, `role`) | sessionStorage |
| `useDriverStore` | `drivers[]`, `selectedDriver`, `documentQueue[]`, `evpList[]`, `appealQueue[]` | No |
| `useRiderStore` | `riders[]`, `selectedRider` | No |
| `useTripStore` | `trips[]`, `selectedTrip`, `activeTrips[]` (for live map) | No |
| `useLiveTripStore` | `activePins[]` (positions tick every 5s via `setInterval`) | No |
| `useDisputeStore` | `disputes[]`, `selectedDispute` | No |
| `useSurgeStore` | `surgeZones[]`, `activeOverrides[]`, `surgeRules[]` | No |
| `usePayoutStore` | `payouts[]`, `pendingCashouts[]` | No |
| `useReportStore` | `revenueData[]`, `tripStats`, `payoutTotals` | No |
| `useAuditStore` | `auditEntries[]` (read-only, immutable mock) | No |
| `useSupportStore` | `tickets[]`, `selectedTicket` | No |
| `useAdminUserStore` | `adminUsers[]` — Super Admin only | No |
| `useNotificationStore` | `sentNotifications[]`, draft state for compose form | No |

---

## Packages Deferred to v1.0

| Package | What it enables | Why deferred |
|---------|----------------|-------------|
| Socket.io client | Real-time trip map updates, live dashboard metrics | Mock `setInterval` in v0.1 |
| Clerk / Auth.js | Persistent JWT sessions, 2FA (PRD §14.4) | Mock Zustand session in v0.1 |
| TanStack Query | Server state caching, background refetch, pagination | All data is local mock JSON in v0.1 |
| MUI X DataGrid Pro | Column pinning, row grouping, advanced filters | Community tier sufficient for v0.1 |
| `papaparse` / `fast-csv` | Server-side CSV generation for PDPA-compliant bulk export | Client-side DataGrid CSV export sufficient for v0.1 demo |
| Sentry | Error monitoring and session replay | No backend, no meaningful errors in v0.1 |
| PostHog / Mixpanel | Admin usage analytics | Deferred to v1.0 |
| Google Maps Routes API | Actual trip route polylines on map | Mock straight-line path in v0.1 |

---

## Full Package List

### Core

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^15.x | Framework — App Router, dev server, build |
| `react` + `react-dom` | ^19.x | UI framework |
| `typescript` | ^5.x | Type safety |

### UI Library

| Package | Version | Purpose |
|---------|---------|---------|
| `@mui/material` | ^6.x | Core MUI components |
| `@mui/icons-material` | ^6.x | MUI icon set |
| `@emotion/react` + `@emotion/styled` | ^11.x | MUI's CSS-in-JS runtime |
| `@mui/x-data-grid` | ^7.x | DataGrid (Community tier) |
| `@mui/x-charts` | ^7.x | Charts (Community tier) |
| `@mui/x-date-pickers` | ^7.x | Date range pickers for reports/filters |
| `dayjs` | ^1.x | Date library (required peer dep for MUI date pickers) |

### Maps

| Package | Version | Purpose |
|---------|---------|---------|
| `@vis.gl/react-google-maps` | ^1.x | Google Maps wrapper for Live Trip Map + Surge Control |

### Forms + Validation

| Package | Version | Purpose |
|---------|---------|---------|
| `react-hook-form` | ^7.x | Form management (commission, campaigns, notifications) |
| `zod` | ^3.x | Schema validation (from `packages/shared`) |
| `@hookform/resolvers` | ^3.x | zod ↔ react-hook-form bridge |

### State

| Package | Version | Purpose |
|---------|---------|---------|
| `zustand` | ^5.x | State management (consistent with all other apps) |

### Monorepo

| Package | Version | Purpose |
|---------|---------|---------|
| `pnpm` | ^9.x | Package manager + workspace linking |

**Total additional cost for admin panel v0.1: $0**
*(Google Maps JavaScript API free tier: 28,000 map loads/month)*

---

## Stack Summary

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 15 + React 19 | App Router; `'use client'` for all interactive screens |
| Routing | Next.js App Router — file-system routing | Route groups `(auth)` / `(panel)`; middleware auth guard |
| UI Library | Material UI (MUI) v6 | Information-dense admin aesthetic; Emotion CSS-in-JS |
| Tables | MUI X DataGrid (Community) | All 12+ list screens; built-in sort, filter, CSV export |
| Charts | MUI X Charts (Community) | Revenue, trip volume, payout breakdown on Reports screen |
| Date pickers | MUI X Date Pickers + dayjs | Date range filters on Trip History + Revenue Reports |
| Maps | @vis.gl/react-google-maps | Live trip pins (interval-animated) + surge zone polygons |
| Forms | react-hook-form + zod | Commission settings, campaigns, notifications, reject reasons |
| State | Zustand + sessionStorage persist | Mock auth survives page refresh; all data from JSON fixtures |
| Mock auth | Hardcoded 4-account lookup + Demo helper panel | One account per role; demo-visible credentials |
| RBAC | `useRbac()` hook + `lib/rbac-config.ts` | Permission rules from PRD §4.5 + §5.3; sidebar filtering |
| Mock real-time | `setInterval` in `useLiveTripStore` | Trip pins animate every 5s; dashboard metrics tick every 10s |
| Mock data | 12 JSON fixtures in `apps/admin/data/` | 20 drivers, 50 trips, 90-day revenue, 100 audit entries |
| Monorepo | pnpm workspaces | Shared Zod schemas and TypeScript types via `packages/shared` |
| Deployment | Vercel | Zero-config Next.js deploy; same org as docs site |

---

*Admin panel frontend tech stack v1.0 will be documented separately when the mockup is approved and backend development begins.*

*Drafted 2026-05-14 based on `teeko-admin-prd.md` (v1.0) and aligned with `teeko-driver-web-frontend-tech-stack.md`.*
