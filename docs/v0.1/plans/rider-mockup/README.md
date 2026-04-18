# Rider Mockup Implementation Plan

> **Version:** 0.1 (mockup)
> **Scope:** Rider app only (`@teeko/rider`)
> **Status:** Planning
> **Last updated:** 2026-04-18

Phased implementation plan for the Teeko rider app in its v0.1 mockup phase — frontend-only, mock data, no backend. Built on the Expo monorepo that is already partly scaffolded (Expo SDK 52, React Native 0.76, Expo Router 4).

## Source of truth

| Doc | Purpose |
|-----|---------|
| [`docs/v0.1/prd/teeko-rider-prd.md`](../../prd/teeko-rider-prd.md) | Screen-by-screen UX requirements |
| [`docs/v0.1/prd/teeko-prd.md`](../../prd/teeko-prd.md) | Core product requirements |
| [`docs/v0.1/tech/teeko-tech-stack.md`](../../tech/teeko-tech-stack.md) | Stack decisions (v0.1 → v1.0) |
| [`docs/v0.1/tech/teeko-frontend-architecture.md`](../../tech/teeko-frontend-architecture.md) | Monorepo layout, routes, shared packages |
| [`docs/v0.1/claude-code/claude-code-guide.md`](../../claude-code/claude-code-guide.md) | Build workflow (spec → mockup → plan → build) |

## Index

| # | Doc | Covers |
|---|-----|--------|
| 00 | [Overview](./00-overview.md) | Goals, constraints, stack, definition of done, milestones |
| 01 | [Scaffold gaps](./01-scaffold-gaps.md) | What exists today vs what to add (packages + deps + configs) |
| 02 | [Design system](./02-design-system.md) | Colors, typography, spacing, icons, `@teeko/ui` inventory |
| 03 | [Navigation shell](./03-navigation.md) | Expo Router tree, tab bar, stacks, deep links |
| 04 | [Mock data & stores](./04-mock-data.md) | JSON seeds, Zustand stores, simulated delays, `@teeko/api` |
| 05 | [Phase A — Auth](./05-phase-auth.md) | Permission prompt, phone, OTP, session |
| 06 | [Phase B — Booking](./06-phase-booking.md) | Home, search, confirm-destination, ride-selection, finding-driver |
| 07 | [Phase C — Trip](./07-phase-trip.md) | Driver-matched, driver-arrived, in-trip, trip-complete |
| 08 | [Phase D — History & Account](./08-phase-history-account.md) | Rides tab, receipt, account, saved places |
| 09 | [Phase E — Polish & delivery](./09-phase-polish.md) | i18n, push notifs, cancellation, states, demo mode, EAS |

## Reading order

Read 00 → 01 → 02 → 03 → 04 first (foundation). Phases A–E (05–09) can then be built in order, each phase ending at a demo-able checkpoint.

## How to execute this plan

Follow the workflow in [`claude-code-guide.md`](../../claude-code/claude-code-guide.md): for each screen or flow, write a short frontend spec under `docs/v0.1/claude-code/specs/`, then generate the mockup in a fresh session with `/frontend-design` referencing that spec. This plan defines the *sequence* and *contracts* — the specs define the *pixels*.
