# Teeko — API Implementation Guide

> **Version:** 0.1
> **Date:** 2026-05-23
> **Status:** Draft
> **Scope:** Backend implementation detail for all REST, WebSocket, and third-party integrations
> **Depends on:** `teeko-api-reference.md`, `teeko-tech-stack.md`

---

## Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Standard Conventions](#2-standard-conventions)
3. [Google Maps Platform Integration](#3-google-maps-platform-integration)
4. [Authentication Implementation](#4-authentication-implementation)
5. [Rider API Implementation](#5-rider-api-implementation)
6. [Driver API Implementation](#6-driver-api-implementation)
7. [Real-Time Layer (Socket.io)](#7-real-time-layer-socketio)
8. [Push Notifications (FCM)](#8-push-notifications-fcm)
9. [PostgreSQL Schema](#9-postgresql-schema)
10. [Redis Usage Patterns](#10-redis-usage-patterns)
11. [File Storage (GCS)](#11-file-storage-gcs)
12. [Error Handling](#12-error-handling)
13. [Security & PDPA Compliance](#13-security--pdpa-compliance)
14. [Environment Variables](#14-environment-variables)

---

## 1. Architecture Overview

```
┌──────────────────┐     REST/WS      ┌──────────────────────────────────┐
│  Rider App       │ ◄──────────────► │  Node.js API (Cloud Run)         │
│  Driver App      │                  │  Express / Fastify                │
└──────────────────┘                  │                                  │
                                      │  ┌─────────┐  ┌──────────────┐  │
                                      │  │ Socket.io│  │ REST Router  │  │
                                      │  └────┬────┘  └──────┬───────┘  │
                                      └───────┼───────────────┼──────────┘
                                              │               │
                         ┌────────────────────┼───────────────┼────────────────┐
                         │                    ▼               ▼                │
                         │  ┌─────────────┐  ┌──────────────────────────────┐ │
                         │  │ Redis        │  │ PostgreSQL (Cloud SQL)       │ │
                         │  │ • locations  │  │ • users, trips, payments     │ │
                         │  │ • sessions   │  │ • drivers, vehicles, docs    │ │
                         │  │ • surge zones│  └──────────────────────────────┘ │
                         │  └─────────────┘                                    │
                         │                                                      │
                         │  ┌──────────────┐  ┌────────────┐  ┌─────────────┐ │
                         │  │ Google Maps  │  │ GCS        │  │ FCM         │ │
                         │  │ Platform     │  │ (docs/photos│  │ (push notif)│ │
                         │  └──────────────┘  └────────────┘  └─────────────┘ │
                         └──────────────────────────────────────────────────────┘
```

**Runtime:** Node.js 20 LTS on GCP Cloud Run (`asia-southeast1`)
**Framework:** Fastify (preferred over Express for throughput) with `@fastify/websocket` plugin
**ORM:** Prisma (PostgreSQL type-safe queries)
**Validation:** Zod schemas on every incoming request body

---

## 2. Standard Conventions

### Request / Response format

All responses follow this envelope:

```json
// Success
{ "ok": true, "data": { ... } }

// Error
{ "ok": false, "error": { "code": "RIDE_NOT_FOUND", "message": "Ride not found." } }
```

### HTTP Status Codes

| Status | When |
|--------|------|
| `200` | Successful GET / PUT / DELETE |
| `201` | Successful POST that creates a resource |
| `400` | Validation error (bad input) |
| `401` | Missing or invalid token |
| `403` | Token valid but insufficient permissions |
| `404` | Resource not found |
| `409` | Conflict (e.g. driver already online, duplicate booking) |
| `422` | Business logic rejection (e.g. driver not verified) |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |

### Auth middleware

Every authenticated route passes through `verifyToken` middleware:

```typescript
// middleware/verifyToken.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJWT } from '../lib/jwt';

export async function verifyToken(req: FastifyRequest, reply: FastifyReply) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ ok: false, error: { code: 'MISSING_TOKEN' } });
  const payload = verifyJWT(auth.slice(7));
  if (!payload) return reply.code(401).send({ ok: false, error: { code: 'INVALID_TOKEN' } });
  req.user = payload; // { userId, role: 'rider' | 'driver' | 'admin' }
}
```

JWT payload:
```json
{ "userId": "uuid", "role": "rider", "phone": "+601XXXXXXXX", "iat": 0, "exp": 0 }
```

Token TTL: **30 days** (refresh on every app open via a silent `/auth/refresh` call).

---

## 3. Google Maps Platform Integration

All Google Maps calls are made **server-side** from the Node.js backend using the `@googlemaps/google-maps-services-js` SDK. The API key used server-side is unrestricted to IP — the mobile SDK key is restricted to the app bundle ID.

### 3.1 API Keys Setup

| Key | Restrictions | Used for |
|-----|-------------|---------|
| `MAPS_SERVER_KEY` | Server IP allowlist | Directions, Distance Matrix, Geocoding, Places (server) |
| `MAPS_ANDROID_KEY` | Android package name | Maps SDK (rider/driver apps — Android) |
| `MAPS_IOS_KEY` | iOS bundle ID | Maps SDK (rider/driver apps — iOS) |

### 3.2 Fare Estimation — Distance Matrix API

Called by `POST /ride/estimate`. Returns fare options for all ride types in a single backend call.

```typescript
// services/maps/fareEstimate.ts
import { Client, TravelMode, UnitSystem } from '@googlemaps/google-maps-services-js';

const mapsClient = new Client({});

export async function getFareEstimates(
  pickupCoords: { lat: number; lng: number },
  destCoords: { lat: number; lng: number }
) {
  const response = await mapsClient.distancematrix({
    params: {
      origins: [`${pickupCoords.lat},${pickupCoords.lng}`],
      destinations: [`${destCoords.lat},${destCoords.lng}`],
      mode: TravelMode.driving,
      units: UnitSystem.metric,
      traffic_model: 'best_guess',          // uses live traffic
      departure_time: 'now',
      language: 'en',
      key: process.env.MAPS_SERVER_KEY!,
    },
  });

  const element = response.data.rows[0].elements[0];
  if (element.status !== 'OK') throw new Error('ROUTE_UNAVAILABLE');

  const distanceKm = element.distance.value / 1000;
  const durationMin = Math.ceil(element.duration_in_traffic?.value ?? element.duration.value) / 60;

  return calculateFareOptions(distanceKm, durationMin);
}

// Fare matrix — adjust rates as needed
const RIDE_TYPES = [
  { type: 'teeko_go',      baseFare: 2.00, perKm: 1.10, perMin: 0.18, minFare: 5.00 },
  { type: 'teeko_comfort', baseFare: 3.00, perKm: 1.40, perMin: 0.22, minFare: 7.00 },
  { type: 'teeko_xl',      baseFare: 4.00, perKm: 1.80, perMin: 0.25, minFare: 9.00 },
  { type: 'teeko_premium', baseFare: 6.00, perKm: 2.50, perMin: 0.35, minFare: 15.00 },
  { type: 'teeko_bike',    baseFare: 1.50, perKm: 0.70, perMin: 0.12, minFare: 3.00 },
];

function calculateFareOptions(distanceKm: number, durationMin: number) {
  return RIDE_TYPES.map(({ type, baseFare, perKm, perMin, minFare }) => {
    const raw = baseFare + (perKm * distanceKm) + (perMin * durationMin);
    const surgeMultiplier = getSurgeMultiplier(); // from Redis
    const fareRm = Math.max(minFare, parseFloat((raw * surgeMultiplier).toFixed(2)));
    return { ride_type: type, fare_rm: fareRm, distance_km: distanceKm, duration_min: Math.ceil(durationMin) };
  });
}
```

**Caching:** Cache Distance Matrix results in Redis for 3 minutes per unique `(pickup_hash, dest_hash)` pair to avoid redundant API calls for the same route.

### 3.3 Route Polyline — Directions API

Called once when a trip is matched to get the route polyline for the rider's map.

```typescript
// services/maps/getRoute.ts
export async function getRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ polyline: string; distanceKm: number; durationMin: number }> {
  const response = await mapsClient.directions({
    params: {
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      mode: TravelMode.driving,
      departure_time: 'now',
      traffic_model: 'best_guess',
      key: process.env.MAPS_SERVER_KEY!,
    },
  });

  const route = response.data.routes[0];
  const leg = route.legs[0];
  return {
    polyline: route.overview_polyline.points,   // encoded polyline string
    distanceKm: leg.distance.value / 1000,
    durationMin: Math.ceil((leg.duration_in_traffic?.value ?? leg.duration.value) / 60),
  };
}
```

### 3.4 Address Autocomplete — Places API

Used in the rider app for destination search. **Proxied through the backend** to keep the API key server-side.

```
GET /maps/autocomplete?input=KLCC&sessiontoken=<uuid>
```

```typescript
// routes/maps.ts
fastify.get('/maps/autocomplete', { preHandler: verifyToken }, async (req) => {
  const { input, sessiontoken, lat, lng } = req.query as Record<string, string>;

  const response = await mapsClient.placeAutocomplete({
    params: {
      input,
      sessiontoken,
      location: lat && lng ? `${lat},${lng}` : undefined,
      radius: lat && lng ? 50000 : undefined,       // bias results within 50km
      components: ['country:my'],                   // Malaysia only
      language: 'en',
      key: process.env.MAPS_SERVER_KEY!,
    },
  });

  return { ok: true, data: response.data.predictions.map(p => ({
    place_id: p.place_id,
    description: p.description,
    main_text: p.structured_formatting.main_text,
    secondary_text: p.structured_formatting.secondary_text,
  }))};
});
```

### 3.5 Place Details / Coordinates — Places API

Converts a `place_id` from autocomplete to lat/lng coordinates.

```
GET /maps/place?place_id=ChIJ...&sessiontoken=<uuid>
```

```typescript
fastify.get('/maps/place', { preHandler: verifyToken }, async (req) => {
  const { place_id, sessiontoken } = req.query as Record<string, string>;

  const response = await mapsClient.placeDetails({
    params: {
      place_id,
      sessiontoken,
      fields: ['geometry', 'name', 'formatted_address'],
      language: 'en',
      key: process.env.MAPS_SERVER_KEY!,
    },
  });

  const { geometry, name, formatted_address } = response.data.result;
  return { ok: true, data: {
    name,
    address: formatted_address,
    lat: geometry!.location.lat,
    lng: geometry!.location.lng,
  }};
});
```

### 3.6 Reverse Geocoding

Converts driver/rider GPS coordinates to a human-readable address (e.g. for "arrived at" notifications).

```typescript
// services/maps/reverseGeocode.ts
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const response = await mapsClient.reverseGeocode({
    params: {
      latlng: { lat, lng },
      result_type: ['street_address', 'route'],
      language: 'en',
      key: process.env.MAPS_SERVER_KEY!,
    },
  });
  return response.data.results[0]?.formatted_address ?? `${lat},${lng}`;
}
```

### 3.7 ETA to Pickup — Distance Matrix API

Called after a driver accepts a trip. Returns live ETA from driver's current location to rider's pickup.

```typescript
// services/maps/getEta.ts
export async function getEtaToPickup(
  driverLocation: { lat: number; lng: number },
  pickupCoords: { lat: number; lng: number }
): Promise<number> { // returns minutes
  const response = await mapsClient.distancematrix({
    params: {
      origins: [`${driverLocation.lat},${driverLocation.lng}`],
      destinations: [`${pickupCoords.lat},${pickupCoords.lng}`],
      mode: TravelMode.driving,
      departure_time: 'now',
      traffic_model: 'best_guess',
      key: process.env.MAPS_SERVER_KEY!,
    },
  });
  const secs = response.data.rows[0].elements[0].duration_in_traffic?.value ?? 0;
  return Math.max(1, Math.ceil(secs / 60));
}
```

**ETA refresh:** Re-calculated every 30 seconds during `en_route_to_pickup` status and broadcast to rider via WebSocket `driver.location` event.

---

## 4. Authentication Implementation

### 4.1 `POST /auth/send-otp`

```typescript
// Phone normalisation: strip spaces, ensure +60 prefix
// OTP: 6-digit numeric, TTL 5 minutes
// Rate limit: max 3 OTP requests per phone per 10 minutes (Redis counter)

async function sendOtp(phone: string) {
  const key = `otp:ratelimit:${phone}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, 600); // 10 min window
  if (attempts > 3) throw new AppError('OTP_RATE_LIMIT', 429);

  const otp = crypto.randomInt(100000, 999999).toString();
  await redis.set(`otp:${phone}`, otp, 'EX', 300); // 5 min TTL

  // Send via Firebase Auth phone verification OR SMS provider (Twilio/Vonage)
  await smsProvider.send(phone, `Your Teeko OTP is: ${otp}. Valid for 5 minutes.`);
  return { otp_sent: true };
}
```

### 4.2 `POST /auth/verify-otp`

```typescript
async function verifyOtp(phone: string, otp: string) {
  const stored = await redis.get(`otp:${phone}`);
  if (!stored || stored !== otp) throw new AppError('INVALID_OTP', 401);
  await redis.del(`otp:${phone}`); // single use

  // Upsert user — creates account on first login
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({ data: { phone, role: detectRole(phone) } });
    // detectRole: phone registered as driver during onboarding uses 'driver', else 'rider'
  }

  const token = signJWT({ userId: user.id, role: user.role, phone });
  return { token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } };
}
```

---

## 5. Rider API Implementation

### 5.1 Profile

**`GET /rider/profile`** — Fetch from PostgreSQL `users` table joined with `saved_places`.

**`PUT /rider/saved-places`** — Upsert `home`/`work` coordinates. Run reverse geocode on the coords to store a readable label alongside the coordinates.

```typescript
// Saved place shape in DB
type SavedPlace = {
  label: 'home' | 'work';
  lat: number;
  lng: number;
  address: string;  // from reverse geocode
};
```

### 5.2 Booking Flow

#### `POST /ride/estimate`

1. Validate `pickup_coords` and `dest_coords` (both within Malaysia bounding box).
2. Check Redis cache for existing estimate for this route pair.
3. If cache miss: call Distance Matrix API → calculate fare options (all 5 ride types).
4. Store result in Redis with 3-minute TTL.
5. Return array of fare options sorted by price ascending.

```typescript
// Request body shape
type EstimateRequest = {
  pickup_coords: { lat: number; lng: number };
  dest_coords: { lat: number; lng: number };
};

// Response shape
type EstimateResponse = Array<{
  ride_type: string;
  fare_rm: number;
  eta_min: number;       // ETA for nearest available driver of this type
  distance_km: number;
  duration_min: number;
}>;
```

**ETA per ride type:** Query Redis for the nearest online driver of each type (using geospatial commands) and compute ETA.

#### `POST /ride/request`

```typescript
async function requestRide(riderId: string, body: RideRequestBody) {
  // 1. Validate rider has no active ride
  const existing = await prisma.trip.findFirst({
    where: { rider_id: riderId, status: { notIn: ['completed', 'cancelled'] } }
  });
  if (existing) throw new AppError('ACTIVE_RIDE_EXISTS', 409);

  // 2. Validate payment method belongs to this rider
  const pm = await prisma.paymentMethod.findFirst({
    where: { id: body.payment_method_id, user_id: riderId }
  });
  if (!pm) throw new AppError('INVALID_PAYMENT_METHOD', 400);

  // 3. Re-calculate fare server-side (do not trust client fare)
  const estimates = await getFareEstimates(body.pickup, body.destination);
  const selectedFare = estimates.find(e => e.ride_type === body.ride_type);
  if (!selectedFare) throw new AppError('INVALID_RIDE_TYPE', 400);

  // 4. Create trip record
  const trip = await prisma.trip.create({
    data: {
      rider_id: riderId,
      pickup_coords: body.pickup,
      dest_coords: body.destination,
      ride_type: body.ride_type,
      fare_rm: selectedFare.fare_rm,
      payment_method_id: pm.id,
      status: 'searching',
    }
  });

  // 5. Get route polyline for the trip
  const route = await getRoute(body.pickup, body.destination);
  await prisma.trip.update({ where: { id: trip.id }, data: { route_polyline: route.polyline } });

  // 6. Find and notify nearby drivers (dispatch engine)
  await dispatchTripToDrivers(trip);

  return { ride_id: trip.id, status: 'searching' };
}
```

#### Driver Dispatch Engine

```typescript
// services/dispatch.ts
async function dispatchTripToDrivers(trip: Trip) {
  // Use Redis GEORADIUS to find online drivers sorted by distance
  const nearbyDrivers = await redis.georadius(
    'driver:locations',
    trip.pickup_coords.lng,
    trip.pickup_coords.lat,
    15,        // 15 km radius
    'km',
    'ASC',     // nearest first
    'COUNT', 10
  );

  // Filter by ride_type compatibility and driver's accept radius preference
  const eligible = await filterEligibleDrivers(nearbyDrivers, trip);

  if (eligible.length === 0) {
    await prisma.trip.update({ where: { id: trip.id }, data: { status: 'no_drivers' } });
    return;
  }

  // Send trip.request event to nearest driver first
  // If declined or timeout (15s), move to next driver
  await offerTripToDriver(eligible[0], trip);
}

async function offerTripToDriver(driverId: string, trip: Trip) {
  const socket = getDriverSocket(driverId); // retrieve socket from in-memory map
  if (!socket) { await offerToNextDriver(trip); return; }

  socket.emit('trip.request', {
    trip_id: trip.id,
    pickup: trip.pickup_coords,
    destination: trip.dest_coords,
    fare_rm: trip.fare_rm,
    rider_rating: await getRiderRating(trip.rider_id),
    ride_type: trip.ride_type,
    distance_km: trip.distance_km,
    duration_min: trip.duration_min,
    outside_radius: false,
  });

  // Store pending offer in Redis with 15s TTL
  await redis.set(`offer:${trip.id}`, driverId, 'EX', 15);

  // Schedule timeout handler
  setTimeout(async () => {
    const current = await redis.get(`offer:${trip.id}`);
    if (current === driverId) {
      socket.emit('trip.request.timeout', { trip_id: trip.id });
      await offerToNextDriver(trip);
    }
  }, 15000);
}
```

#### `DELETE /ride/:id/cancel`

Cancellation fee logic:
- `searching` status: no fee
- `matched` or `en_route_to_pickup` (driver on the way, < 2 min wait): no fee
- `arrived_at_pickup` (driver waiting > 5 min): RM 3.00 cancellation fee

```typescript
async function cancelRide(riderId: string, tripId: string, reason?: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, rider_id: riderId } });
  if (!trip) throw new AppError('RIDE_NOT_FOUND', 404);
  if (['completed', 'cancelled'].includes(trip.status)) throw new AppError('CANNOT_CANCEL', 409);

  let feeRm: number | undefined;
  if (trip.status === 'arrived_at_pickup' && trip.arrived_at) {
    const waitMin = (Date.now() - trip.arrived_at.getTime()) / 60000;
    if (waitMin > 5) feeRm = 3.00;
  }

  await prisma.trip.update({ where: { id: tripId }, data: { status: 'cancelled', cancel_reason: reason } });

  // Notify driver via WebSocket
  if (trip.driver_id) {
    const socket = getDriverSocket(trip.driver_id);
    socket?.emit('trip.cancelled', { trip_id: tripId, cancelled_by: 'rider', reason });
  }

  return { cancelled: true, fee_rm: feeRm };
}
```

#### `GET /ride/:id/status`

Combines PostgreSQL trip data with Redis live driver location:

```typescript
async function getRideStatus(riderId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, rider_id: riderId },
    include: { driver: { select: { name: true, phone: true, rating: true, vehicle: true } } }
  });
  if (!trip) throw new AppError('RIDE_NOT_FOUND', 404);

  // Get live driver location from Redis
  const driverLocation = trip.driver_id
    ? await redis.hgetall(`driver:location:${trip.driver_id}`)
    : null;

  const etaMin = driverLocation && trip.status === 'en_route_to_pickup'
    ? await getEtaToPickup(
        { lat: parseFloat(driverLocation.lat), lng: parseFloat(driverLocation.lng) },
        trip.pickup_coords
      )
    : null;

  return {
    status: trip.status,
    driver_info: trip.driver ? {
      name: trip.driver.name,
      phone: trip.driver.phone,
      rating: trip.driver.rating,
      vehicle: trip.driver.vehicle,
    } : null,
    eta_min: etaMin,
    live_location: driverLocation
      ? { lat: parseFloat(driverLocation.lat), lng: parseFloat(driverLocation.lng) }
      : null,
  };
}
```

### 5.3 Ratings

`POST /ride/:id/rate` — Rating is stored and the driver's average recalculated:

```typescript
async function rateRide(riderId: string, tripId: string, stars: number, comment?: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, rider_id: riderId, status: 'completed' }
  });
  if (!trip) throw new AppError('TRIP_NOT_FOUND_OR_NOT_COMPLETED', 404);
  if (trip.rider_rated) throw new AppError('ALREADY_RATED', 409);

  await prisma.$transaction([
    prisma.rating.create({ data: { trip_id: tripId, rated_user_id: trip.driver_id!, stars, comment } }),
    prisma.trip.update({ where: { id: tripId }, data: { rider_rated: true } }),
    // Recalculate driver avg rating
    prisma.$executeRaw`
      UPDATE users SET rating = (
        SELECT AVG(stars)::numeric(3,2) FROM ratings WHERE rated_user_id = ${trip.driver_id}
      ) WHERE id = ${trip.driver_id}
    `,
  ]);
  return { ok: true };
}
```

### 5.4 Payment Methods

Payment tokens are created **on the device** using the Stripe mobile SDK (or TNG eWallet SDK), then the token is sent to the backend for storage. The backend never handles raw card numbers.

```typescript
// POST /rider/payment-methods
// body: { type: 'card' | 'tng' | 'google_pay', token: string }
async function addPaymentMethod(riderId: string, type: string, token: string) {
  let externalId: string;
  let label: string;

  if (type === 'card') {
    // Attach to Stripe customer
    const customer = await getOrCreateStripeCustomer(riderId);
    const pm = await stripe.paymentMethods.attach(token, { customer: customer.id });
    externalId = pm.id;
    label = `${pm.card!.brand.toUpperCase()} •••• ${pm.card!.last4}`;
  } else {
    // TNG token stored as-is; charged at trip completion
    externalId = token;
    label = 'Touch \'n Go eWallet';
  }

  const isFirst = (await prisma.paymentMethod.count({ where: { user_id: riderId } })) === 0;

  const method = await prisma.paymentMethod.create({
    data: { user_id: riderId, type, external_id: externalId, label, is_default: isFirst }
  });
  return { method_id: method.id };
}
```

---

## 6. Driver API Implementation

### 6.1 Onboarding — Document Upload

Documents are uploaded directly to GCS via signed upload URLs. The backend generates the URL, the mobile app uploads directly to GCS (no binary data passes through the API server).

```typescript
// POST /driver/onboard/documents — returns signed upload URLs
async function initiateDocumentUpload(driverId: string) {
  const docTypes = ['nric', 'cdl', 'psv_d', 'selfie', 'insurance'];
  const uploadUrls: Record<string, string> = {};

  for (const doc of docTypes) {
    const objectPath = `drivers/${driverId}/docs/${doc}_${Date.now()}.jpg`;
    const [url] = await storage
      .bucket(process.env.GCS_BUCKET_DOCS!)
      .file(objectPath)
      .getSignedUrl({ action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType: 'image/jpeg' });

    uploadUrls[doc] = url;
    // Store pending path in DB
    await prisma.driverDocument.upsert({
      where: { driver_id_type: { driver_id: driverId, type: doc } },
      update: { gcs_path: objectPath, status: 'pending' },
      create: { driver_id: driverId, type: doc, gcs_path: objectPath, status: 'pending' },
    });
  }

  return { upload_urls: uploadUrls };
}

// POST /driver/onboard/documents/confirm — called after all files uploaded
async function confirmDocumentUpload(driverId: string) {
  await prisma.driverSubmission.create({
    data: { driver_id: driverId, submitted_at: new Date(), status: 'under_review' }
  });

  // Trigger Cloud Vision OCR for IC and licence
  await triggerDocumentOcr(driverId);

  // Notify admin dashboard
  await notifyAdminNewSubmission(driverId);

  return { submission_id: uuid(), status: 'under_review' };
}
```

**Cloud Vision OCR** extracts IC number and expiry dates to pre-populate the driver's profile and flag mismatches before manual admin review.

### 6.2 Presence & Location

#### `PUT /driver/status` — Go Online / Offline

```typescript
async function setDriverStatus(driverId: string, online: boolean) {
  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    include: { documents: true, activeVehicle: true }
  });

  if (online) {
    // Validate driver is allowed online
    const canGoOnline = checkDriverEligibility(driver);
    if (!canGoOnline.eligible) {
      return { status: 'offline', rejection_reason: canGoOnline.reason };
    }

    await redis.set(`driver:online:${driverId}`, '1', 'EX', 3600); // expires if driver forgets to go offline
    await prisma.user.update({ where: { id: driverId }, data: { is_online: true } });
    return { status: 'online' };
  } else {
    await redis.del(`driver:online:${driverId}`);
    await redis.zrem('driver:locations', driverId); // remove from geospatial index
    await prisma.user.update({ where: { id: driverId }, data: { is_online: false } });
    return { status: 'offline' };
  }
}

function checkDriverEligibility(driver: DriverWithDocs) {
  if (!driver.evp_approved) return { eligible: false, reason: 'EVP_NOT_APPROVED' };
  if (!driver.activeVehicle) return { eligible: false, reason: 'NO_ACTIVE_VEHICLE' };
  const expiredDocs = driver.documents.filter(d => d.expires_at && d.expires_at < new Date());
  if (expiredDocs.length > 0) return { eligible: false, reason: `DOCUMENT_EXPIRED:${expiredDocs[0].type}` };
  return { eligible: true };
}
```

#### `PUT /driver/location` — REST fallback (not during active trip)

```typescript
async function updateDriverLocation(driverId: string, lat: number, lng: number, heading: number) {
  // Store in Redis hash for fast reads
  await redis.hset(`driver:location:${driverId}`, { lat, lng, heading, ts: Date.now() });
  await redis.expire(`driver:location:${driverId}`, 30); // expire if driver stops updating

  // Update geospatial index for dispatch (GEOADD)
  await redis.geoadd('driver:locations', lng, lat, driverId);

  return { ok: true };
}
```

### 6.3 Trip Lifecycle

```typescript
// POST /trip/:id/accept
async function acceptTrip(driverId: string, tripId: string) {
  // Atomic check-and-assign to prevent race conditions
  const trip = await prisma.$transaction(async (tx) => {
    const t = await tx.trip.findFirst({ where: { id: tripId, status: 'searching' } });
    if (!t) throw new AppError('TRIP_NOT_AVAILABLE', 409);
    return tx.trip.update({
      where: { id: tripId },
      data: { driver_id: driverId, status: 'matched', matched_at: new Date() }
    });
  });

  // Clear pending offer from Redis
  await redis.del(`offer:${tripId}`);

  // Notify rider via WebSocket
  io.to(`rider:${trip.rider_id}`).emit('trip.status_update', { trip_id: tripId, status: 'matched' });

  // Send FCM push to rider
  await sendPushNotification(trip.rider_id, {
    title: 'Driver on the way',
    body: `Your driver is matched and heading to you.`,
  });

  const riderInfo = await prisma.user.findUnique({ where: { id: trip.rider_id }, select: { name: true, phone: true, rating: true } });
  return { rider_info: riderInfo, pickup_coords: trip.pickup_coords, dest_coords: trip.dest_coords, fare_rm: trip.fare_rm, ride_type: trip.ride_type };
}

// POST /trip/:id/arrived
async function markArrived(driverId: string, tripId: string) {
  const trip = await prisma.trip.update({
    where: { id: tripId, driver_id: driverId, status: 'en_route_to_pickup' },
    data: { status: 'arrived_at_pickup', arrived_at: new Date() }
  });

  io.to(`rider:${trip.rider_id}`).emit('trip.status_update', { trip_id: tripId, status: 'arrived_at_pickup' });
  await sendPushNotification(trip.rider_id, {
    title: 'Driver has arrived',
    body: `Your driver has arrived at the pickup point.`,
  });

  return { wait_timer_start: new Date().toISOString() };
}

// POST /trip/:id/complete
async function completeTrip(driverId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, driver_id: driverId, status: 'in_progress' }
  });
  if (!trip) throw new AppError('TRIP_NOT_IN_PROGRESS', 422);

  // Recalculate final fare (could differ if surge changed — lock in original agreed fare)
  const finalFare = trip.fare_rm;
  const commissionRate = 0.10; // Teeko charges 10%
  const commissionRm = parseFloat((finalFare * commissionRate).toFixed(2));
  const netRm = parseFloat((finalFare - commissionRm).toFixed(2));

  await prisma.$transaction([
    prisma.trip.update({
      where: { id: tripId },
      data: { status: 'completed', completed_at: new Date(), final_fare_rm: finalFare }
    }),
    prisma.driverEarning.create({
      data: { driver_id: driverId, trip_id: tripId, gross_rm: finalFare, commission_rm: commissionRm, net_rm: netRm }
    }),
  ]);

  io.to(`rider:${trip.rider_id}`).emit('trip.status_update', { trip_id: tripId, status: 'completed' });
  await sendPushNotification(trip.rider_id, {
    title: 'Trip complete',
    body: `You've arrived! Your fare is RM ${finalFare.toFixed(2)}.`,
  });

  return { final_fare_rm: finalFare, commission_rm: commissionRm, net_rm: netRm, earnings_credited: true };
}
```

### 6.4 Earnings & Cashout

```typescript
// GET /driver/earnings?period=today|week
async function getEarnings(driverId: string, period: 'today' | 'week') {
  const since = period === 'today'
    ? new Date(new Date().setHours(0, 0, 0, 0))
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [earnings, bonuses] = await Promise.all([
    prisma.driverEarning.aggregate({
      where: { driver_id: driverId, created_at: { gte: since } },
      _sum: { gross_rm: true, commission_rm: true, net_rm: true },
      _count: { id: true },
    }),
    prisma.incentivePayout.aggregate({
      where: { driver_id: driverId, paid_at: { gte: since } },
      _sum: { amount_rm: true },
    }),
  ]);

  return {
    gross_rm: earnings._sum.gross_rm ?? 0,
    commission_rm: earnings._sum.commission_rm ?? 0,
    net_rm: earnings._sum.net_rm ?? 0,
    trip_count: earnings._count.id,
    bonuses_rm: bonuses._sum.amount_rm ?? 0,
  };
}

// POST /driver/earnings/cashout — daily cashout to registered bank account
async function requestCashout(driverId: string) {
  const lastCashout = await prisma.cashout.findFirst({
    where: { driver_id: driverId },
    orderBy: { created_at: 'desc' }
  });

  // Cashout available once per day
  const nextEligible = lastCashout
    ? new Date(lastCashout.created_at.getTime() + 24 * 60 * 60 * 1000)
    : null;

  if (nextEligible && nextEligible > new Date()) {
    return { ok: false, eligible: false, next_eligible_at: nextEligible.toISOString(), amount_rm: 0 };
  }

  const pending = await prisma.driverEarning.aggregate({
    where: { driver_id: driverId, cashed_out: false },
    _sum: { net_rm: true },
  });
  const amount = pending._sum.net_rm ?? 0;
  if (amount < 1) return { ok: false, eligible: false, amount_rm: 0 };

  await prisma.$transaction([
    prisma.cashout.create({ data: { driver_id: driverId, amount_rm: amount } }),
    prisma.driverEarning.updateMany({ where: { driver_id: driverId, cashed_out: false }, data: { cashed_out: true } }),
  ]);
  // Trigger bank transfer via payment provider
  await initiateBankTransfer(driverId, amount);

  return { ok: true, eligible: true, amount_rm: amount };
}
```

---

## 7. Real-Time Layer (Socket.io)

### 7.1 Server Setup

```typescript
// lib/socket.ts
import { Server } from 'socket.io';

export const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'], // polling fallback for poor connections
  pingInterval: 10000,
  pingTimeout: 5000,
});

// In-memory maps: socket lookup by userId
const driverSockets = new Map<string, Socket>(); // driverId → socket
const riderSockets = new Map<string, Socket>();   // riderId  → socket

io.on('connection', async (socket) => {
  // Auth on connect
  socket.on('auth', async ({ token }) => {
    const payload = verifyJWT(token);
    if (!payload) { socket.disconnect(); return; }

    socket.data.userId = payload.userId;
    socket.data.role = payload.role;

    if (payload.role === 'driver') {
      driverSockets.set(payload.userId, socket);
      socket.join(`driver:${payload.userId}`);
    } else {
      riderSockets.set(payload.userId, socket);
      socket.join(`rider:${payload.userId}`);
    }
  });

  // Driver sends location updates during active trip
  socket.on('driver.location', async ({ lat, lng, heading }) => {
    const driverId = socket.data.userId;
    if (socket.data.role !== 'driver') return;

    // Update Redis
    await redis.hset(`driver:location:${driverId}`, { lat, lng, heading, ts: Date.now() });
    await redis.geoadd('driver:locations', lng, lat, driverId);

    // Find active trip for this driver
    const trip = await prisma.trip.findFirst({
      where: { driver_id: driverId, status: { in: ['en_route_to_pickup', 'arrived_at_pickup', 'in_progress'] } }
    });

    if (trip) {
      // Recompute ETA every 30s (throttled)
      const etaMin = await getEtaToPickup({ lat, lng }, trip.pickup_coords);

      // Forward to rider
      io.to(`rider:${trip.rider_id}`).emit('driver.location', { lat, lng, eta_min: etaMin });
    }
  });

  socket.on('disconnect', async () => {
    const { userId, role } = socket.data;
    if (role === 'driver') {
      driverSockets.delete(userId);
      await redis.del(`driver:location:${userId}`);
      await redis.zrem('driver:locations', userId);
    } else {
      riderSockets.delete(userId);
    }
  });
});

export function getDriverSocket(driverId: string) {
  return driverSockets.get(driverId);
}
```

### 7.2 Location Update Rate

- **During active trip:** Driver app sends `driver.location` every **3 seconds** via WebSocket.
- **Online but no active trip:** Driver app calls `PUT /driver/location` REST endpoint every **10 seconds**.
- **Rider map refresh:** Rider map re-renders on each received `driver.location` event (~3s cadence during trip).

### 7.3 Trip Status State Machine

```
searching
  │  dispatch engine finds driver
  ▼
matched
  │  driver navigates to pickup, POST /trip/:id/start (en route)
  ▼
en_route_to_pickup
  │  POST /trip/:id/arrived
  ▼
arrived_at_pickup
  │  POST /trip/:id/start
  ▼
in_progress
  │  POST /trip/:id/complete
  ▼
completed

Any state → cancelled   (via DELETE /ride/:id/cancel or POST /trip/:id/cancel)
```

---

## 8. Push Notifications (FCM)

### 8.1 FCM Token Management

Driver and rider apps send their FCM token on every app open:

```
POST /device/token
Body: { fcm_token: string, platform: 'android' | 'ios' }
```

```typescript
// Upsert token in DB — one token per (user, platform) pair
await prisma.deviceToken.upsert({
  where: { user_id_platform: { user_id: req.user.userId, platform: body.platform } },
  update: { token: body.fcm_token, updated_at: new Date() },
  create: { user_id: req.user.userId, platform: body.platform, token: body.fcm_token },
});
```

### 8.2 Notification Dispatch

```typescript
// lib/fcm.ts
import { getMessaging } from 'firebase-admin/messaging';

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, string> }
) {
  const tokens = await prisma.deviceToken.findMany({ where: { user_id: userId } });
  if (tokens.length === 0) return;

  await getMessaging().sendEachForMulticast({
    tokens: tokens.map(t => t.token),
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  });
}
```

### 8.3 Document Expiry Cron Job

Runs daily at 08:00 MYT (UTC+8). Queries drivers with documents expiring within 14 days.

```typescript
// cron/documentExpiry.ts  (run via Cloud Scheduler → Cloud Run job)
export async function checkDocumentExpiry() {
  const soon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const expiring = await prisma.driverDocument.findMany({
    where: { expires_at: { lte: soon }, status: 'approved' },
    include: { driver: true }
  });

  for (const doc of expiring) {
    const daysLeft = Math.ceil((doc.expires_at!.getTime() - Date.now()) / 86400000);
    await sendPushNotification(doc.driver_id, {
      title: 'Document expiring soon',
      body: `Your ${doc.type.toUpperCase()} expires in ${daysLeft} days. Please renew to stay online.`,
    });
  }
}
```

---

## 9. PostgreSQL Schema

```sql
-- Users (riders + drivers share this table, role field distinguishes)
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        VARCHAR(20)  UNIQUE NOT NULL,
  name         VARCHAR(100),
  email        VARCHAR(200),
  role         VARCHAR(20)  NOT NULL DEFAULT 'rider', -- 'rider' | 'driver' | 'admin'
  rating       NUMERIC(3,2) DEFAULT 5.00,
  is_online    BOOLEAN      DEFAULT false,
  evp_approved BOOLEAN      DEFAULT false,
  suspended    BOOLEAN      DEFAULT false,
  created_at   TIMESTAMPTZ  DEFAULT now(),
  updated_at   TIMESTAMPTZ  DEFAULT now()
);

-- Saved places (rider home/work)
CREATE TABLE saved_places (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  label     VARCHAR(20) NOT NULL,   -- 'home' | 'work'
  lat       NUMERIC(10,7),
  lng       NUMERIC(10,7),
  address   TEXT,
  UNIQUE(user_id, label)
);

-- Driver documents
CREATE TABLE driver_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(30) NOT NULL,  -- 'nric' | 'cdl' | 'psv_d' | 'selfie' | 'insurance'
  gcs_path    TEXT,
  status      VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  expires_at  DATE,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(driver_id, type)
);

-- Vehicles
CREATE TABLE vehicles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  make        VARCHAR(50),
  model       VARCHAR(50),
  plate       VARCHAR(20),
  year        SMALLINT,
  is_active   BOOLEAN DEFAULT false,
  doc_status  VARCHAR(20) DEFAULT 'pending'
);

-- Trips
CREATE TABLE trips (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id         UUID REFERENCES users(id),
  driver_id        UUID REFERENCES users(id),
  vehicle_id       UUID REFERENCES vehicles(id),
  status           VARCHAR(30) NOT NULL DEFAULT 'searching',
  ride_type        VARCHAR(20) NOT NULL,
  pickup_lat       NUMERIC(10,7),
  pickup_lng       NUMERIC(10,7),
  pickup_address   TEXT,
  dest_lat         NUMERIC(10,7),
  dest_lng         NUMERIC(10,7),
  dest_address     TEXT,
  route_polyline   TEXT,
  fare_rm          NUMERIC(8,2),
  final_fare_rm    NUMERIC(8,2),
  payment_method_id UUID REFERENCES payment_methods(id),
  cancel_reason    TEXT,
  rider_rated      BOOLEAN DEFAULT false,
  driver_rated     BOOLEAN DEFAULT false,
  matched_at       TIMESTAMPTZ,
  arrived_at       TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_trips_rider   ON trips(rider_id, status);
CREATE INDEX idx_trips_driver  ON trips(driver_id, status);
CREATE INDEX idx_trips_status  ON trips(status);

-- Payment methods
CREATE TABLE payment_methods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL,  -- 'card' | 'tng' | 'google_pay'
  external_id TEXT NOT NULL,
  label       VARCHAR(100),
  is_default  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Driver earnings
CREATE TABLE driver_earnings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id     UUID REFERENCES users(id),
  trip_id       UUID REFERENCES trips(id),
  gross_rm      NUMERIC(8,2),
  commission_rm NUMERIC(8,2),
  net_rm        NUMERIC(8,2),
  cashed_out    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Cashouts
CREATE TABLE cashouts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id  UUID REFERENCES users(id),
  amount_rm  NUMERIC(8,2),
  status     VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'completed' | 'failed'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ratings
CREATE TABLE ratings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        UUID REFERENCES trips(id),
  rated_user_id  UUID REFERENCES users(id),
  stars          SMALLINT CHECK (stars BETWEEN 1 AND 5),
  comment        TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Device tokens (FCM)
CREATE TABLE device_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  platform   VARCHAR(10) NOT NULL, -- 'android' | 'ios'
  token      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Incentive campaigns
CREATE TABLE incentive_campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100),
  target_trips INTEGER,
  bonus_rm     NUMERIC(8,2),
  expires_at   TIMESTAMPTZ,
  active       BOOLEAN DEFAULT true
);

CREATE TABLE driver_incentive_progress (
  driver_id    UUID REFERENCES users(id),
  campaign_id  UUID REFERENCES incentive_campaigns(id),
  trips_done   INTEGER DEFAULT 0,
  paid_out     BOOLEAN DEFAULT false,
  PRIMARY KEY (driver_id, campaign_id)
);
```

---

## 10. Redis Usage Patterns

| Key pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `otp:<phone>` | String | 5 min | OTP value for verification |
| `otp:ratelimit:<phone>` | String (counter) | 10 min | Limit OTP requests |
| `driver:online:<driverId>` | String | 1 hour (refreshed) | Mark driver as online |
| `driver:location:<driverId>` | Hash `{lat,lng,heading,ts}` | 30 sec | Live driver coordinates |
| `driver:locations` | Sorted Set (GEO) | none | Geospatial driver index for dispatch |
| `offer:<tripId>` | String (driverId) | 15 sec | Pending trip offer to a driver |
| `estimate:<routeHash>` | JSON string | 3 min | Cached fare estimate |
| `session:<userId>` | String (token) | 30 days | Session invalidation support |
| `surge:<zoneId>` | String (multiplier) | 5 min | Active surge multiplier per zone |

```typescript
// Geospatial queries for dispatch
// Find drivers within 15km of pickup, sorted by distance
const drivers = await redis.georadiusAsync(
  'driver:locations',
  pickupLng, pickupLat,
  15, 'km',
  'ASC', 'COUNT', 20, 'WITHCOORD', 'WITHDIST'
);
```

---

## 11. File Storage (GCS)

### Bucket Structure

| Bucket | Contents | Access |
|--------|----------|--------|
| `teeko-driver-docs` | NRIC, CDL, PSV-D, insurance scans | Private; signed URLs only |
| `teeko-vehicle-docs` | Car grant, road tax, puspakom certs | Private; signed URLs only |
| `teeko-profile-photos` | Rider/driver profile pictures | Public read |

### Signed URL for Admin Document Review

```typescript
// Signed URL expires in 15 minutes — admin only
async function getDocumentSignedUrl(gcsPath: string): Promise<string> {
  const [url] = await storage
    .bucket(process.env.GCS_BUCKET_DOCS!)
    .file(gcsPath)
    .getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    });
  return url;
}
```

---

## 12. Error Handling

All thrown `AppError` instances are caught by the global error handler:

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(public code: string, public statusCode: number, message?: string) {
    super(message ?? code);
  }
}

// Fastify error handler
fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({ ok: false, error: { code: error.code, message: error.message } });
  }
  // Unexpected error — don't leak stack trace
  fastify.log.error(error);
  return reply.code(500).send({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
});
```

---

## 13. Security & PDPA Compliance

| Requirement | Implementation |
|-------------|---------------|
| Phone number hashing | Store SHA-256 hash alongside raw number; hash used for deduplication queries |
| Driver document access | GCS private buckets, signed URLs with 15-min TTL, admin role required |
| JWT signing | RS256 (asymmetric) — private key stored in GCP Secret Manager |
| HTTPS | Enforced by Cloud Run; HTTP → HTTPS redirect at load balancer |
| Rate limiting | Redis-backed per-IP and per-phone limits on `/auth/*` endpoints |
| SQL injection | Prisma parameterised queries — no raw SQL except for aggregate updates (use `$queryRaw` with tagged templates) |
| PDPA data residency | All Cloud Run, Cloud SQL, GCS, and Memorystore in `asia-southeast1` (Singapore) |
| Rider PII in WebSocket | Location events carry only `lat/lng/eta_min` — no name, phone, or IC over the wire |
| Audit log | All admin actions (approve/reject/suspend) written to `audit_log` table with `admin_id`, `action`, `target_id`, `timestamp` |

---

## 14. Environment Variables

```bash
# Server
PORT=8080
NODE_ENV=production
JWT_PRIVATE_KEY=<RS256 PEM from Secret Manager>

# Database
DATABASE_URL=postgresql://user:pass@host:5432/teeko

# Redis
REDIS_URL=redis://host:6379

# Google Maps
MAPS_SERVER_KEY=<unrestricted server key>

# Google Cloud Storage
GCS_BUCKET_DOCS=teeko-driver-docs
GCS_BUCKET_VEHICLE=teeko-vehicle-docs
GCS_BUCKET_PROFILES=teeko-profile-photos

# Firebase Admin SDK
FIREBASE_CREDENTIALS=<path to service account JSON>

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# SMS Provider (Twilio or Vonage)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...

# Email
SENDGRID_API_KEY=SG...

# App
COMMISSION_RATE=0.10
CANCELLATION_FEE_RM=3.00
CASHOUT_COOLDOWN_HOURS=24
```

---

*References: `teeko-api-reference.md` (endpoint contracts), `teeko-tech-stack.md` (stack decisions), `teeko-rider-prd.md`, `teeko-driver-prd.md` (feature scope).*
