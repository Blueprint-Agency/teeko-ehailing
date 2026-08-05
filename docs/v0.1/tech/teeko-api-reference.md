# Teeko — API Reference

> **Version:** 0.1
> **Date:** 2026-05-23
> **Status:** Draft
> **Scope:** Rider App + Driver App REST & WebSocket APIs

---

## Base URL

```
https://api.teeko.my/v1
```

---

## Authentication

All authenticated endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are issued by `POST /auth/verify-otp`.

---

## 1. Auth (Shared — Rider & Driver)

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| `POST` | `/auth/send-otp` | `{ phone_number }` | `{ otp_sent: bool }` |
| `POST` | `/auth/verify-otp` | `{ phone_number, otp }` | `{ token, user }` |

---

## 2. Rider APIs

### 2.1 Profile

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| `GET` | `/rider/profile` | — | `{ name, phone, email, rating, saved_places }` |
| `PUT` | `/rider/profile` | `{ name?, email? }` | `{ user }` |
| `PUT` | `/rider/saved-places` | `{ home?, work? }` (coords + label) | `{ saved_places }` |

### 2.2 Booking

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| `POST` | `/ride/estimate` | `{ pickup_coords, dest_coords }` | `[{ ride_type, fare_rm, eta_min, distance_km, duration_min }]` |
| `POST` | `/ride/request` | `{ pickup, destination, ride_type, payment_method_id }` | `{ ride_id, status: "searching" }` |
| `DELETE` | `/ride/:id/cancel` | `{ reason? }` | `{ cancelled: bool, fee_rm? }` |
| `GET` | `/ride/:id/status` | — | `{ status, driver_info, eta_min, live_location }` |

### 2.3 Trip History & Receipt

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| `GET` | `/rider/rides` | `{ page, limit }` | `[{ ride_id, date, pickup, destination, fare_rm, status }]` |
| `GET` | `/ride/:id` | — | `{ ride_id, date, pickup, destination, ride_type, fare_rm, payment_method, driver_info }` |
| `POST` | `/ride/:id/rate` | `{ stars (1–5), comment? }` | `{ ok: bool }` |

### 2.4 Payment Methods

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| `GET` | `/rider/payment-methods` | — | `[{ id, type, label, is_default }]` |
| `POST` | `/rider/payment-methods` | `{ type, token }` (token from payment SDK) | `{ method_id }` |
| `PUT` | `/rider/payment-methods/:id/default` | — | `{ ok: bool }` |
| `DELETE` | `/rider/payment-methods/:id` | — | `{ ok: bool }` |

---

## 3. Driver APIs

### 3.1 Onboarding & Documents

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| `POST` | `/driver/onboard/documents` | `{ nric, cdl, psv_d, selfie, insurance }` (multipart files) | `{ submission_id, status: "under_review" }` |
| `GET` | `/driver/onboard/status` | — | `{ doc_status, evp_status, can_go_online: bool }` |

### 3.2 Vehicle

A driver has exactly one vehicle, so this is a singular resource — there is no list and no active-vehicle selection. Registering and re-submitting documents happens in the driver web portal; the mobile app is read-only here.

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| `GET` | `/driver/vehicle` | — | `{ vehicle: { id, plateNumber, make, model, year, colour, category, documents: [{ kind, status, expiry }] } \| null }` |

### 3.3 Presence & Location

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| `PUT` | `/driver/status` | `{ online: bool }` | `{ status, rejection_reason? }` |
| `PUT` | `/driver/location` | `{ lat, lng, heading }` | `{ ok: bool }` |
| `PUT` | `/driver/radius` | `{ radius_km }` | `{ ok: bool }` |

> **Note:** Location updates during an active trip should use the WebSocket channel instead of polling this endpoint.

### 3.4 Trip

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| `POST` | `/trip/:id/accept` | — | `{ rider_info, pickup_coords, dest_coords, fare_rm, ride_type }` |
| `POST` | `/trip/:id/decline` | — | `{ ok: bool }` |
| `POST` | `/trip/:id/arrived` | — | `{ wait_timer_start }` |
| `POST` | `/trip/:id/start` | — | `{ ok: bool }` |
| `POST` | `/trip/:id/complete` | — | `{ final_fare_rm, commission_rm, net_rm, earnings_credited: bool }` |
| `POST` | `/trip/:id/cancel` | `{ reason }` | `{ ok: bool }` |
| `POST` | `/trip/:id/report-rider` | `{ reason }` | `{ report_id }` |

### 3.5 Earnings

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| `GET` | `/driver/earnings` | `{ period: "today" \| "week" }` | `{ gross_rm, commission_rm, net_rm, trip_count, bonuses_rm }` |
| `GET` | `/driver/earnings/history` | `{ page, limit }` | `[{ trip_id, date, fare_rm, commission_rm, net_rm }]` |
| `POST` | `/driver/earnings/cashout` | — | `{ ok: bool, amount_rm, eligible: bool, next_eligible_at? }` |

### 3.6 Ratings & Incentives

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| `GET` | `/driver/ratings` | — | `{ avg_rating, review_count, recent_reviews[] }` |
| `GET` | `/driver/incentives` | — | `[{ campaign, target_trips, completed_trips, bonus_rm, expires_at }]` |

---

## 4. Real-Time (WebSocket / Socket.io)

**Connection URL:** `wss://api.teeko.my/v1/ws`

Authenticate on connect:
```json
{ "event": "auth", "data": { "token": "<bearer token>" } }
```

### 4.1 Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `trip.request` | Server → Driver | `{ trip_id, pickup, destination, fare_rm, rider_rating, ride_type, distance_km, duration_min, outside_radius: bool }` |
| `trip.request.timeout` | Server → Driver | `{ trip_id }` — no response within 15–20s |
| `trip.cancelled` | Server → Driver / Rider | `{ trip_id, cancelled_by, reason }` |
| `trip.status_update` | Server → Driver / Rider | `{ trip_id, status }` |
| `driver.location` | Driver → Server | `{ lat, lng, heading }` |
| `driver.location` | Server → Rider | `{ lat, lng, eta_min }` |

### 4.2 Trip Status Values

```
searching → matched → en_route_to_pickup → arrived_at_pickup
→ in_progress → completed | cancelled
```

---

## 5. Push Notifications (FCM)

| Trigger | Recipient | Message |
|---------|-----------|---------|
| Driver matched | Rider | "Your driver [Name] is on the way. ETA: X min." |
| Driver arrived | Rider | "Your driver has arrived at [pickup]." |
| Trip started | Rider | "Your trip has started. Heading to [destination]." |
| Trip completed | Rider | "You've arrived! Your fare is RM XX." |
| Ride cancelled by driver | Rider | "Your ride was cancelled. Please try booking again." |
| Document expiring | Driver | "Your [document] expires on [date]. Please renew." |
| Document expired — lockout | Driver | "Your [document] has expired. You cannot go online until renewed." |
| EVP approved | Driver | "Your EVP has been approved. You can now go online." |
| Account suspended | Driver | "Your account has been suspended. Tap to view details." |
| New incentive available | Driver | "New campaign: [name]. Complete X trips to earn RM Y." |

---

## 6. API Summary

| Category | Endpoints |
|----------|-----------|
| Auth (shared) | 2 |
| Rider — Profile | 3 |
| Rider — Booking | 4 |
| Rider — Trips & Rating | 3 |
| Rider — Payments | 4 |
| Driver — Onboarding | 2 |
| Driver — Vehicle | 1 |
| Driver — Presence | 3 |
| Driver — Trip | 7 |
| Driver — Earnings | 3 |
| Driver — Ratings & Incentives | 2 |
| **Total REST** | **34** |
| WebSocket events | 6 |
| Push notification triggers | 10 |

---

*Derived from `teeko-rider-prd.md` and `teeko-driver-prd.md`. Tech stack (Node.js, Socket.io, PostgreSQL) per `teeko-tech-stack.md`.*
