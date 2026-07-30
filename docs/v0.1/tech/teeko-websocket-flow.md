---
title: WebSocket Flow — Join & Reconnect
version: v0.1
---

# WebSocket Flow — Room Join & Reconnect Mechanics

Server: `apps/backend/src/api/ws/gateway.ts` (Socket.IO, `path: /ws`, `pingInterval 25s`, `pingTimeout 60s`).
Registry + emit helpers: `apps/backend/src/modules/tracking/service.ts`.
Clients: `apps/driver/lib/socket.ts` + `apps/driver/app/_layout.tsx`, `apps/rider/lib/socket.ts` + `apps/rider/app/_layout.tsx`.

## 1. Common join sequence

There is **no role in the handshake** — role is derived from the DB after token verification.

```
client connect()  →  server 'connection' (no identity yet, socket is anonymous)
client emit 'auth' { token }
server: verifyRiderClerkToken(token)  → on failure, verifyDriverClerkToken(token)
server: findUserByExternalId('clerk', claims.sub)
   no user row → emit 'auth.error' { user not provisioned } + disconnect()
   verify throws → emit 'auth.error' { invalid token } + disconnect()
   ok → socket.data.userId / socket.data.role set
```

Note the server always emits `auth.error` **before** disconnecting — a bare disconnect is indistinguishable from a network drop and would put the client in a 1s reconnect spin.

### Driver branch
1. `trackingService.registerDriver(userId, socket)` — in-memory `Map<userId, Socket>`.
2. `socket.join('driver:{userId}')`.
3. `emit 'auth.ok' { role: 'driver', userId }`.
4. **Presence repair:** reads `driverProfiles.availability`; if `online`, re-sets Redis `driver:online:{userId}` = 1, TTL 3600s.

### Rider branch
1. `trackingService.registerRider(userId, socket)`.
2. `socket.join('rider:{userId}')`.
3. `emit 'auth.ok' { role: 'rider', userId }`.
4. **State replay:** looks up any trip in `matched | driver_arrived | in_trip` for the rider and re-emits `trip.status_update` with driver + vehicle payload, so a rider that missed events while offline resyncs.

### Why both a Map and a room
`emitToDriver` / `emitToRider` try the direct socket first (fastest), then fall back to `io.to('driver:{id}')` / `io.to('rider:{id}')` if the map entry is missing or stale from reconnect churn. The room is the safety net; it is also the multi-instance path once the Redis adapter lands.

## 2. Server-side disconnect handling

`disconnect(reason)` logs `sid / userId / reason / transport / livedMs`. Reasons are the diagnosis: `ping timeout` (frozen app), `transport close` (LB/network), `client namespace disconnect` (client code bug), `server namespace disconnect` (auth rejection).

- **Driver:** `unregisterDriver(userId, socket.id)` returns `false` if this socket no longer owns the registry entry (a reconnect already registered a newer socket) — teardown is skipped. Otherwise `removeDriverLocation` (del `driver:location:{id}`, zrem from `driver:locations`) and `clearDriverOnlineStatus` (del `driver:online:{id}`) run inside try/catch so a Redis outage cannot kill the process.
- **Rider:** `unregisterRider(userId, socket.id)` with the same ownership guard; no Redis state to clear.

## 3. Driver reconnect mechanism

Transport layer (`apps/driver/lib/socket.ts`): singleton socket, `autoConnect:false`, `reconnection:true`, `attempts: Infinity`, delay 1s → max 10s, `transports: ['websocket','polling']` with upgrade.

- **Listeners bound once** (`listenersBound` flag); the token is read via a module-level `tokenGetter`, so re-calling `connectSocket` swaps the token source without stacking duplicate handlers.
- **Every `connect` re-emits `auth`** — the server keeps no session across sockets, so re-auth is mandatory on each reconnect. Null token → `disconnect()`.
- **Auth backoff:** on `auth.error` it disables socket.io's own reconnection and retries itself on `5s → 15s → 60s`, then stops entirely ("staying offline until re-armed"). `auth.ok` resets `authRetryIndex` to 0.
- **Foreground resume:** `AppState` `active` → `resumeSocket()` (driver `_layout.tsx`), which clears the backoff, resets the index, and calls `connectSocket` — reconnecting if the transport is down, or re-emitting `auth` if the socket survived but the server dropped it.
- **Session guard:** `hasConnectedRef` connects once per sign-in; a momentarily-null Clerk token during a 55s refresh does *not* tear the socket down. Only `!isSignedIn` calls `disconnectSocket()`.
- On connect the bridge first calls `api.auth.me()` (provisioning) and `api.driver.getActiveTrip()` (state restore), then binds `trip.request` / `trip.request.timeout` after `s.off(...)` to avoid duplicate offer popups.
- Presence is restored two ways: the `driver:online` key re-set in the auth handler, plus the next `driver.location` ping re-adding the driver to the `driver:locations` GEO set (hash TTL 45s).

## 4. Rider reconnect mechanism

Transport layer (`apps/rider/lib/socket.ts`): same socket.io options (infinite retries, 1s→10s backoff, ws+polling).

- **Listeners re-bound per call** using `s.off(event)` then `s.on(event)` — `connectSocket` is idempotent but rebinds rather than using a bound-once flag.
- **`emitAuth` retry loop:** up to 5 attempts, 500ms apart, because Clerk's `getToken()` can return null right after sign-in before the session hydrates; after 5 failures it disconnects.
- **No auth backoff and no AppState resume** on the rider side — an `auth.error` only logs, and socket.io keeps retrying at the 1s–10s cadence. This is the main asymmetry versus the driver client.
- **Recovery is server-driven instead:** the rider's re-`auth` triggers the gateway's active-trip replay (`trip.status_update`), and `restoreActiveTrip()` in `ClerkBridge` re-hydrates the trip store over HTTP after an app restart.
- `SocketBridge` keys purely on `isSignedIn`; sign-out (or unmount) calls `disconnectSocket()`.

## 5. Known asymmetries / follow-ups

| Concern | Driver | Rider |
|---|---|---|
| Auth-error backoff | 5/15/60s then stop | none — 1s reconnect loop persists |
| Foreground (`AppState`) resume | yes | no |
| Listener binding | bound once, token via getter | `off`+`on` per call |
| Presence cleanup on disconnect | GEO + `driver:online` cleared | n/a |

The in-memory `driverSockets` / `riderSockets` maps are per-process; behind a load balancer only the room fallback reaches a socket owned by another instance — see `teeko-realtime-multi-instance.md`.
