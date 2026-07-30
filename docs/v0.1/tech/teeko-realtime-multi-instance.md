---
title: Realtime Multi-Instance Readiness — Socket.IO Adapter & Durable Dispatch Timers
status: proposed
date: 2026-07-28
---

# Realtime Multi-Instance Readiness

> **Status: proposed, not implemented.** Per `CLAUDE.md`, substantive changes to the
> tech stack must be discussed before editing. This document is the discussion.

## 1. Problem

The realtime layer is correct on exactly one backend process and silently wrong on two.
Two independent pieces of state live in process memory:

| State | Location | Breaks when |
|---|---|---|
| Driver/rider socket maps | `modules/tracking/service.ts:10-11` (`Map<userId, Socket>`) | Rider on instance A, driver on instance B — neither is in the other's map, so `emitToDriver`/`emitToRider` drop the event. |
| The `io` server handle | `config/socketio.ts` (`setIO` per process) | Room fallback (`io.to('rider:{id}')`) only reaches sockets connected to *that* process. |
| Offer expiry + search timeout | `modules/dispatch/service.ts` — `setTimeout` at `:229` (15s offer TTL) and `:132` (60s search cap) | Process restart or redeploy. Timers vanish; the trip stays `requested` forever and the relay never advances. |

The existing code acknowledges the first one: *"In-memory socket maps — replaced by
Redis adapter in multi-instance prod"* (`tracking/service.ts:9`).

Today staging runs a single container, so none of this is visible. It becomes a
production incident the moment a second replica or a rolling deploy is introduced —
including an ordinary zero-downtime deploy, where old and new containers overlap.

Note the failure mode is **silent**: no error, no 500, no log line. A rider simply
never sees their driver move, and a driver never receives a trip request.

## 2. Proposal

### 2.1 Socket.IO Redis adapter

Add `@socket.io/redis-adapter` and attach it in `mountSocketIO`, using a duplicated
pair of the existing `ioredis` client (pub + sub — the adapter requires two, and a
subscriber connection cannot issue normal commands).

Consequences:

- `io.to('rider:{id}').emit(...)` and `io.to('driver:{id}').emit(...)` fan out across
  every instance. Rooms become the **primary** transport.
- The in-memory maps degrade to a same-process fast path. They are still useful (a
  direct `socket.emit` avoids a Redis round trip) but must never be the only path.
  `emitToDriver` already falls back to the room; `emitToRider` already does too.
- `trackingService.hasDriverSocket()` becomes **process-local and therefore wrong**
  as a global presence check. Dispatch currently uses it for the ghost-driver
  fast-skip. It must move to a Redis-backed presence check (see 2.3), or a driver
  connected to another instance gets skipped as a ghost.

This last point matters: the adapter alone is not sufficient. Adding it without
fixing the presence check converts a delivery bug into a dispatch bug.

### 2.2 Durable dispatch timers

The offer relay is a state machine driven by two in-process timers. Options:

| Option | Notes |
|---|---|
| **BullMQ delayed jobs** (recommended) | The repo already runs BullMQ workers (`src/jobs/*.worker.ts`) on the same Redis. Schedule `offer-expiry` (delay 15s) and `search-timeout` (delay 60s) jobs keyed by `tripId`; the handler re-reads trip state and advances the queue. Survives restarts, runs once cluster-wide, and reuses infrastructure already in production. |
| Redis keyspace notifications on the existing `offer:{tripId}:current` TTL | Elegant — the key already expires at exactly the right moment — but keyspace events are fire-and-forget: an expiry delivered while no instance is subscribed is lost. Not durable enough for trip state. |
| Postgres polling sweep | A worker scanning `trip_offers` for `status='pending' AND expires_at < now()`. Simplest and fully durable, but adds latency equal to the poll interval on every decline-by-timeout. Reasonable fallback if BullMQ scheduling proves awkward. |

Recommendation: **BullMQ**, because the queue, the Redis connection, and the worker
process all already exist. The change is additive.

A durable timer also fixes a bug the current design cannot express: the 60s search
cap and the 15s offer TTL are unrelated timers racing each other, so a queue of ≥5
drivers is cancelled mid-walk. Moving to jobs makes the relay resumable and the cap
enforceable in one place.

### 2.3 Presence as shared state

Replace the process-local socket-map check with Redis, which mostly exists already:

- `driver:online:{id}` — written on `goOnline` and restored on WS auth
  (`api/ws/gateway.ts:69`), deleted on disconnect.
- `driver:location:{id}` — 45s TTL heartbeat hash.

Proposal: treat `driver:online:{id}` as the cluster-wide connectivity signal and
drop `hasDriverSocket` from dispatch. This also resolves the three-way disagreement
between `driverProfiles.availability` (Postgres), the presence key (Redis), and the
`driver:locations` GEO set — documented in §3 below.

## 3. Known state divergence (context for the above)

Three stores answer "is this driver available?" and they disagree:

| Store | Written by | Cleared by | Read by |
|---|---|---|---|
| `driverProfiles.availability` | `PUT /driver/status/online`/`offline` | explicit REST call only | dispatch (authoritative) |
| `driver:online:{id}` | same routes + WS auth | socket disconnect | dispatch ghost-skip (added 2026-07-28) |
| `driver:locations` GEO + `driver:location:{id}` | `PUT /driver/status/location` | 45s TTL, offline, disconnect | `nearby-drivers`, dispatch candidate search |

Notably `availability` is **never** cleared on disconnect, so a driver who closes the
app stays in the dispatch pool indefinitely. The ghost-skip added in
`dispatch/service.ts` mitigates the cost (previously 8s of the 60s search window per
ghost) but does not reconcile the underlying column.

**Open question for discussion:** should a socket disconnect flip `availability` to
`offline` after a grace period (~90s)? It would make the DB self-healing, but it
risks re-introducing the regression called out at `dispatch/service.ts:82-88`, where
drivers on flaky mobile connections dropped out of the pool during reconnects. A
grace period longer than the WS `pingTimeout` (20s) plus a reconnect backoff would
likely be safe, but this needs a decision before implementation.

## 4. Scope and sequencing

1. Redis adapter + move dispatch presence off `hasDriverSocket` — **must ship together.**
2. Durable timers via BullMQ.
3. Decide the `availability` reconciliation question in §3.

Items 1 and 2 are independent of each other and can be sequenced either way.

## 5. Not proposed here

- Sticky sessions at the load balancer. They reduce reconnect churn but do not fix
  cross-instance delivery — a rider and their driver are different clients and will
  land on different instances regardless.
- Replacing Socket.IO. Out of scope.
