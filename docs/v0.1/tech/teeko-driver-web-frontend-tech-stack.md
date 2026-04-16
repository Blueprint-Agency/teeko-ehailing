# Teeko — Driver-Partner Web Portal Frontend Tech Stack

> **Version:** 1.0
> **Date:** 2026-04-15
> **Status:** Draft
> **Scope:** v0.1 Mockup (frontend only — no backend, $0 cost)
> **Companion PRD:** `prd/teeko-driver-web-prd.md`
> **Related doc:** `tech/teeko-driver-frontend-tech-stack.md` (mobile app stack)

---

## Contents

1. [Overview](#overview)
2. [Monorepo Architecture](#monorepo-architecture)
3. [App Architecture — Route Structure](#app-architecture--route-structure)
4. [Screen Inventory](#screen-inventory)
5. [Package Decisions](#package-decisions)
   - [Framework — Next.js 15 + React 19](#1-framework--nextjs-15--react-19)
   - [Routing — Next.js App Router](#2-routing--nextjs-app-router)
   - [Styling — Tailwind CSS v4 + shadcn/ui](#3-styling--tailwind-css-v4--shadcnui)
   - [Forms — react-hook-form + zod](#4-forms--react-hook-form--zod)
   - [i18n — i18next + react-i18next](#5-i18n--i18next--react-i18next)
   - [State Management — Zustand](#6-state-management--zustand)
   - [File Upload — react-dropzone + Browser Camera](#7-file-upload--react-dropzone--browser-camera)
6. [Mock Data Files](#mock-data-files)
7. [Zustand Stores](#zustand-stores)
8. [Packages Deferred to v1.0](#packages-deferred-to-v10)
9. [Full Package List](#full-package-list)
10. [Stack Summary](#stack-summary)

---

## Overview

The Teeko Driver-Partner Web Portal is a browser-based onboarding gateway. Prospective driver-partners register, upload their required documents, and track their application status here — before downloading the Teeko Driver mobile app.

This is a **pre-mobile gateway**, not a replacement for the mobile app. All active driving functions remain in the iOS/Android app.

This document covers the **web portal frontend stack** only. The mobile app stack is documented in `tech/teeko-driver-frontend-tech-stack.md`.

### Guiding principles

1. **Carry shared code.** Zod schemas, i18n locale JSON, and TypeScript types are shared between the web portal and the mobile app via `packages/shared`. No duplication.
2. **Zero backend in v0.1.** No API calls, no real auth, no cloud storage. All state is simulated locally via Zustand + JSON fixtures.
3. **Carry forward.** Every package chosen for v0.1 is the production choice for v1.0. No throwaway code.
4. **Accessibility first.** WCAG 2.1 AA is a hard requirement (PRD §9). shadcn/ui's Radix UI primitives provide accessible focus management, keyboard navigation, and ARIA attributes out of the box.

---

## Monorepo Architecture

The web portal and mobile app share a single monorepo managed with **pnpm workspaces**. This allows shared validation schemas, locale JSON files, and TypeScript types without duplication.

```
teeko/                              ← monorepo root
  pnpm-workspace.yaml
  package.json                      ← root scripts (lint, typecheck all)

  apps/
    mobile/                         ← existing Expo project (moved here)
    web/                            ← new Next.js 15 app (this document)
      next.config.ts
      tailwind.config.ts
      app/                          ← Next.js App Router root
        layout.tsx                  ← root layout (i18n init, providers)
        page.tsx                    ← Landing page (/)
        auth/
          login/page.tsx
          verify/page.tsx
          register/page.tsx
        onboarding/
          layout.tsx                ← shared onboarding layout + progress bar
          agreement/page.tsx
          personal-docs/page.tsx
          vehicle-details/page.tsx
          vehicle-docs/page.tsx
          confirmation/page.tsx
        dashboard/
          page.tsx
          resubmit/[docId]/page.tsx
        profile/page.tsx
      components/
        ui/                         ← shadcn/ui generated components
        driver/                     ← domain components (DocumentSlot, StatusTracker, etc.)
      stores/                       ← Zustand stores
      data/                         ← mock JSON fixtures
      hooks/                        ← custom hooks
      lib/                          ← i18n init, utils

  packages/
    shared/                         ← shared across apps/mobile + apps/web
      schemas/                      ← zod validation schemas
      locales/                      ← en/ms/zh/ta JSON files
      types/                        ← TypeScript interfaces
```

### Why pnpm workspaces (not Turborepo)

Turborepo adds build caching and task orchestration — useful at scale, but unnecessary for two apps in v0.1. pnpm workspaces alone handles workspace linking with zero config overhead. Turborepo can be layered in at v1.0 if build times grow.

---

## App Architecture — Route Structure

Next.js App Router uses the filesystem for routing. Nested `layout.tsx` files wrap child routes with shared headers, progress bars, and auth guards.

```
/                               ← app/page.tsx — Landing page (public)

/auth/
  login                         ← Phone number + OTP (returning drivers)
  verify                        ← OTP entry step
  register                      ← Account creation (name, email, password)

/onboarding/                    ← Protected; requires completed auth
  agreement                     ← Scrollable T&C; accept checkbox
  personal-docs                 ← 5-step guided upload: NRIC, CDL, PSV-D, insurance, selfie
  vehicle-details               ← Vehicle make, model, year, plate, colour
  vehicle-docs                  ← 4-step guided upload: Car Grant, Road Tax, Insurance, PUSPAKOM
  confirmation                  ← Success state + App Store / Google Play buttons

/dashboard                      ← Protected; post-submission
  (index)                       ← Application status tracker
  resubmit/[docId]              ← View rejection reason + upload replacement

/profile                        ← Protected; name, email, phone, language, logout
```

### Client components

All interactive screens use the `'use client'` directive — form state (react-hook-form), Zustand stores, file uploads, and i18next hooks are all client-side only. Server components are used only for static layouts (root layout, onboarding layout wrapper) where no interactivity is needed.

### Progress persistence

Onboarding step is stored in `useOnboardingStore` and synced to `localStorage`. A driver who closes the browser mid-flow resumes at their last completed step on re-login — satisfying PRD §4.1 ("save & continue").

### Mock role switching (v0.1)

`useWebAuthStore` holds a mock driver session. The landing page has a hidden dev toggle that simulates a logged-in returning driver vs. a new registrant — enabling testers to reach the dashboard without completing the full flow.

---

## Screen Inventory

All 12 screens from PRD §10, mapped to routes and key UI elements.

| Screen | Route | Key UI Elements |
|--------|-------|----------------|
| Landing page | `/` | Value proposition, "Register as a Driver" CTA, login link, language picker |
| Phone verification | `/auth/verify` | Phone input (MY format), OTP input (6-digit), resend timer |
| Account creation | `/auth/register` | Full name, email, password, PDPA consent checkbox |
| Driver Agreement | `/onboarding/agreement` | Scrollable T&C container, accept checkbox (enabled at scroll end) |
| Personal documents | `/onboarding/personal-docs` | 5 × DocumentSlot (NRIC front/back, CDL, PSV-D, insurance, selfie), step progress bar |
| Vehicle details | `/onboarding/vehicle-details` | Make, model, year, plate number, colour — form with zod validation |
| Vehicle documents | `/onboarding/vehicle-docs` | 4 × DocumentSlot (Car Grant, Road Tax, Insurance, PUSPAKOM) |
| Submission confirmation | `/onboarding/confirmation` | Success illustration, next-steps timeline, App Store + Google Play buttons |
| Login | `/auth/login` | Phone number entry, OTP, "Remember me" toggle |
| Application status | `/dashboard` | 3-stage progress tracker (Doc Review → EVP → Account), per-document state badges |
| Document resubmission | `/dashboard/resubmit/:docId` | Rejection reason display, DocumentSlot for replacement upload |
| Profile | `/profile` | Name, email, phone (read-only), language picker, logout, PDPA erasure link |

---

## Package Decisions

### 1. Framework — Next.js 15 + React 19

#### What it does
Provides the development server, build toolchain, file-system routing, and UI rendering for the web portal via the Next.js App Router.

#### Why Next.js 15
- **App Router file-system routing.** Routes are defined by the folder structure under `app/` — no separate router config file. Nested `layout.tsx` files handle shared UI (progress bars, auth guards) at each segment level.
- **Carries forward cleanly.** When the backend is introduced at v1.0, Next.js Server Actions and Route Handlers replace the mock Zustand layer without a framework switch. API calls, auth middleware (Next.js Middleware), and server-side data fetching slot in naturally.
- **Vercel-native deployment.** Next.js deploys to Vercel with zero config — optimal for Malaysian traffic via Vercel's Singapore edge. Equivalent to a static Vite export for v0.1, with a clear upgrade path.
- **Middleware for auth guards.** `middleware.ts` at the app root enforces route protection (redirect to `/auth/login` for unauthenticated users) without per-route loader logic.
- **React 19 first-class.** Next.js 15 ships with React 19 as the default renderer — same version as the mobile app.

#### Client vs. server components
All interactive screens are `'use client'` components (Zustand, react-hook-form, file uploads). Server components are used for static layout shells only. This boundary is clear and consistent — no accidental server/client confusion.

---

### 2. Routing — Next.js App Router

#### What it does
Handles all navigation, nested layouts, and route protection across the 12-screen inventory via the Next.js App Router file-system convention.

#### Why Next.js App Router (not a separate routing library)
- **Zero routing config.** Folders under `app/` define routes; `layout.tsx` files define shared wrapping UI. No `createBrowserRouter` config to maintain.
- **Nested layouts.** `app/onboarding/layout.tsx` wraps all onboarding steps with the progress bar and back-navigation shell. `app/dashboard/layout.tsx` wraps dashboard screens. Each layout is defined once and composed automatically.
- **Middleware-based auth guards.** `middleware.ts` at the repo root intercepts all protected route requests and redirects unauthenticated users to `/auth/login`. Auth logic lives in one place, separate from all page components.
- **`next/link` + `next/navigation`.** `<Link>` handles prefetching and navigation. `useRouter` / `redirect()` handle programmatic navigation — no third-party router hook API to learn.
- **v1.0 upgrade path.** At v1.0, Route Handlers (`app/api/`) and Server Actions replace the Zustand mock layer incrementally. No routing library swap required.

#### Route group convention
Auth-only sections use Next.js route groups `(auth)`, `(onboarding)`, `(dashboard)` — these group routes under a shared `layout.tsx` without affecting the URL path.

---

### 3. Styling — Tailwind CSS v4 + shadcn/ui

#### What it does
- **Tailwind CSS v4** provides utility classes for all layout and spacing.
- **shadcn/ui** provides copy-paste accessible component primitives used throughout the portal.

#### Why Tailwind CSS
- **Design continuity.** The mobile app uses NativeWind (Tailwind for React Native). Shared design tokens (colours, spacing scale) can be defined once and referenced in both `tailwind.config.ts` files. No design drift between web and mobile.
- **No runtime CSS.** Tailwind generates a static CSS file at build time — no CSS-in-JS runtime overhead.
- **v4.** Tailwind v4's CSS-first config (`@theme`) replaces `tailwind.config.js` — simpler setup, better IDE support. The `@tailwindcss/postcss` plugin integrates cleanly with Next.js's PostCSS pipeline.

#### Why shadcn/ui
- **WCAG 2.1 AA compliance.** Built on Radix UI primitives, which provide correct focus trapping, keyboard navigation, and ARIA attributes for Dialog, Select, Checkbox, RadioGroup, and Tabs — all used heavily in the onboarding flow. Building these from scratch would require significant accessibility work.
- **No dep lock-in.** shadcn/ui copies component source into `src/components/ui/`. There is no external package to upgrade or break. Components are owned by this project.
- **Tailwind-native.** Components use Tailwind classes directly — no CSS module conflicts, no style override complexity.
- **Key components used:** Form, Input, Button, Progress, Badge, Checkbox, RadioGroup, Tabs, Dialog, Separator, Avatar, Skeleton.

#### Why not a hosted component library (MUI, Ant Design, Chakra)
| Alternative | Why Not |
|-------------|---------|
| **Material UI** | Opinionated visual style that conflicts with Teeko's brand. Heavy bundle. CSS-in-JS runtime. |
| **Ant Design** | Enterprise aesthetic; not designed for mobile-first consumer flows. Large bundle. |
| **Chakra UI** | Good accessibility, but adds a runtime theme provider and style system. shadcn/ui is leaner. |

---

### 4. Forms — react-hook-form + zod

#### What it does
Manages the multi-step onboarding form: input validation, error states, step-gating (cannot proceed without completing current step), and submission.

#### Why react-hook-form
Same rationale as the mobile app (see `teeko-driver-frontend-tech-stack.md` §2). Uncontrolled inputs, minimal re-renders, clean step-gating via `trigger()`.

#### Why zod (shared schemas)
Zod schemas live in `packages/shared/schemas/` and are imported by both `apps/web` and `apps/mobile`. This means:
- The NRIC format validation, expiry date check, and vehicle year restriction are written once and enforced identically on both platforms.
- A schema change (e.g., updating NRIC regex) propagates to both apps without manual sync.

```
packages/shared/schemas/
  onboarding.ts     ← personal info, vehicle details
  documents.ts      ← file presence, type, size constraints
  auth.ts           ← phone format (MY), password rules
```

#### Why @hookform/resolvers
One-line bridge between zod schemas and react-hook-form. No custom validation adapters needed.

---

### 5. i18n — i18next + react-i18next

#### What it does
Powers 4-language support: English (EN), Bahasa Malaysia (BM), Mandarin Simplified (ZH-Hans), and Tamil (TA). In v0.1, only English strings are populated — infrastructure is wired so other languages require only JSON file additions, no code changes.

#### Why wire i18n in v0.1

Same rationale as the mobile app — retrofitting hardcoded strings at v1.0 is costly; the APAD driver agreement must be available in BM; translation teams can work on locale JSON files in parallel with development.

#### Why i18next-browser-languagedetector (web-specific addition)

The mobile app uses `expo-localization` to read the device locale. On the web, `i18next-browser-languagedetector` reads the browser's `navigator.language` (equivalent role). The driver can override language from the Profile screen — preference stored in Zustand + `localStorage`.

#### Shared locale files

Locale JSON files live in `packages/shared/locales/` and are imported by both apps. String keys are namespaced by screen, matching the mobile app's convention:

```json
{
  "driver": {
    "onboarding": {
      "agreement": {
        "title": "Driver Agreement",
        "acceptButton": "I Accept",
        "scrollPrompt": "Please scroll to the bottom to accept"
      }
    },
    "dashboard": {
      "docReview": "Document Review",
      "evpApplication": "EVP Application",
      "accountStatus": "Account Status"
    }
  }
}
```

---

### 6. State Management — Zustand

#### What it does
Manages all client-side state: mock auth session, onboarding progress, document upload state, and application status.

#### Why Zustand
Same library as the mobile app — no context switching for developers working across both platforms. Lightweight, no boilerplate, easy `persist` middleware for `localStorage` sync.

#### Web-specific stores

| Store | Key state |
|-------|-----------|
| `useWebAuthStore` | `isAuthenticated`, `mockDriverProfile`, `role` |
| `useOnboardingStore` | `currentStep`, `personalDocs` (upload state), `vehicleDocs`, `vehicleDetails`, `agreementAccepted` |
| `useApplicationStatusStore` | `docReviewStatus`, `evpStatus`, `accountStatus`, `notifications` |
| `useLanguageStore` | `locale` (persisted to `localStorage`) |

`useOnboardingStore` uses Zustand's `persist` middleware with `localStorage` — driver progress survives browser close and resumes on re-login (PRD §4.1 requirement).

---

### 7. File Upload — react-dropzone + Browser Camera

#### What it does
Enables driver-partners to upload the 9 required documents (5 personal + 4 vehicle) via drag-and-drop on desktop and camera capture on mobile browser.

#### Why react-dropzone
- **Drag-and-drop + file picker in one.** `useDropzone` hook handles both interaction modes, file type filtering (JPG, PNG, PDF), and size validation — no custom event handling needed.
- **No native module.** Pure browser API wrapper; works in all modern browsers.
- **Composable.** The `getRootProps` / `getInputProps` pattern lets the `DocumentSlot` component control its own visual state (empty, filled, rejected) without coupling to the library.

#### Why native browser camera (no library)

Mobile browser camera capture requires only a single HTML attribute:

```html
<input type="file" accept="image/*" capture="environment" />
```

No JavaScript library is needed. `react-dropzone` renders this input internally when the `useFsAccessApi: false` option is set — ensuring the native camera sheet appears on mobile browsers without any extra dependency.

#### Client-side image quality check

Before the upload state is set, the captured image is drawn to an off-screen Canvas and checked for blur (via Laplacian variance) and minimum resolution. Blurry or low-resolution images show an inline warning with a retake prompt. This is implemented as a `useImageQuality` custom hook using only the Canvas API — no library.

```
Each document slot is a <DocumentSlot /> component:
  → Empty: dashed drop zone with upload icon + "Take Photo / Choose File" button
  → Filled: image thumbnail + file name + "Replace" button
  → Error: red border + validation message (blurry, wrong type, too large)
  → Rejected (post-submission): rejection reason + "Resubmit" CTA
```

#### In v0.1 vs v1.0

| Phase | Behaviour |
|-------|-----------|
| v0.1 | File stored as `object URL` in `useOnboardingStore`; displayed as thumbnail only; no network call |
| v1.0 | File uploaded to Google Cloud Storage (or equivalent); signed URL stored server-side; admin reviewer accesses via GCS |

The `DocumentSlot` component API does not change between versions. Only the Zustand action that receives the file changes — from setting a local URL to calling an upload service.

---

## Mock Data Files

All mock data lives in `apps/web/src/data/`. Zustand stores seed from these files on app start. No network calls in v0.1.

```
apps/web/src/data/
  mock-driver-profile.json        ← name, phone, email, onboarding step completed
  mock-application-status.json    ← doc review states, EVP state, account state, rejection reasons
  mock-documents.json             ← per-document state: uploaded / under review / approved / rejected
  mock-notifications.json         ← in-portal notification list (doc approved, EVP submitted, etc.)
```

---

## Zustand Stores

| Store | Key state | Persisted? |
|-------|-----------|------------|
| `useWebAuthStore` | `isAuthenticated`, `mockProfile`, dev role toggle | sessionStorage |
| `useOnboardingStore` | `currentStep` (0–7), per-step form data, document upload state | localStorage |
| `useApplicationStatusStore` | `docReview`, `evpApplication`, `accountStatus`, `notifications` | No |
| `useLanguageStore` | `locale` (en / ms / zh / ta) | localStorage |

---

## Packages Deferred to v1.0

| Package | What it enables | Why deferred |
|---------|----------------|-------------|
| Twilio Verify / Firebase Phone Auth | Real phone OTP verification | Mock OTP (any 6-digit code) in v0.1 |
| Google Cloud Storage / AWS S3 SDK | Real document upload + storage | Files stored as object URLs in v0.1 |
| Clerk / Auth.js | Persistent session tokens, JWT | Mock session in Zustand + localStorage |
| Jumio / Onfido Web SDK | Liveness check for selfie | Selfie captured via camera; admin reviews manually |
| Socket.io / SSE | Real-time document status updates | Status read from mock JSON; manual page refresh in v0.1 |
| Sentry | Error monitoring | No backend, no meaningful errors to track in v0.1 |

---

## Full Package List

### Core

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `next` | ^15.x | Framework — App Router, dev server, build | Replaces Vite |
| `react` + `react-dom` | ^19.x | UI framework | |
| `typescript` | ^5.x | Type safety | |

### Routing

Routing is provided by Next.js App Router — no additional routing package required.

### Styling + UI

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `tailwindcss` | ^4.x | Utility CSS | Shared design tokens with NativeWind |
| `@tailwindcss/postcss` | ^4.x | PostCSS plugin for Tailwind v4 (Next.js) | |
| `shadcn/ui` components | — | Accessible UI primitives (copy-paste) | No external package |
| `@radix-ui/*` | ^1.x | Headless primitives behind shadcn/ui | Auto-installed by shadcn CLI |
| `lucide-react` | ^0.4x | Icon set (used by shadcn/ui) | |
| `class-variance-authority` | ^0.7.x | Variant management for shadcn components | |
| `clsx` + `tailwind-merge` | ^2.x | Conditional class merging | |

### Forms + Validation

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `react-hook-form` | ^7.x | Multi-step form management | Same as mobile |
| `zod` | ^3.x | Schema validation (from `packages/shared`) | Same as mobile |
| `@hookform/resolvers` | ^3.x | zod ↔ react-hook-form bridge | Same as mobile |

### i18n

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `i18next` | ^23.x | i18n engine | Shared locale JSON |
| `react-i18next` | ^14.x | React hooks for i18n | |
| `i18next-browser-languagedetector` | ^8.x | Auto-detects browser locale | Web equivalent of expo-localization |

### State

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `zustand` | ^5.x | State management | Same as mobile |

### File Upload

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `react-dropzone` | ^14.x | Drag-and-drop + file picker | Desktop upload; wraps native camera input for mobile |

### Monorepo

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `pnpm` | ^9.x | Package manager + workspace linking | |

**Total additional cost for web portal v0.1: $0**

---

## Stack Summary

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 15 + React 19 | App Router; `'use client'` for all interactive screens |
| Routing | Next.js App Router — file-system routing | Nested layouts; middleware auth guards |
| Styling | Tailwind CSS v4 | Shared design language with NativeWind (mobile) |
| Component library | shadcn/ui (Radix UI primitives) | WCAG 2.1 AA compliance; no dep lock-in |
| Forms | react-hook-form + zod | Same as mobile; schemas shared via `packages/shared` |
| i18n | i18next + react-i18next | Same locale JSON as mobile via `packages/shared` |
| State | Zustand + localStorage persist | Onboarding progress survives browser close |
| File upload | react-dropzone + native browser camera | Drag-and-drop desktop; `capture="environment"` mobile |
| Image quality | Custom `useImageQuality` hook (Canvas API) | Client-side blur/resolution check before upload |
| Mock data | Local JSON fixtures in `src/data/` | 4 driver web fixtures; no network calls |
| Monorepo | pnpm workspaces | Shared schemas, locales, types across web + mobile |

---

*Web portal frontend tech stack v1.0 will be documented separately when the mockup is approved and backend development begins.*

*Drafted 2026-04-15 based on `teeko-driver-web-prd.md` (v1.0) and alignment with `teeko-driver-frontend-tech-stack.md` (mobile app).*
