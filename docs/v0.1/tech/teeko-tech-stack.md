# Teeko — Tech Stack PRD

> **Version:** 2.0
> **Date:** 2026-04-11
> **Status:** Draft
> **Purpose:** Defines and justifies every technology choice in the Teeko platform, split by phase.

---

## Contents

1. [Guiding Principles](#guiding-principles)
2. [Phase Overview](#phase-overview)

**v0.1 — Mockup Stack (Frontend Only)**

3. [Mobile Framework — React Native + Expo](#1-mobile-framework--react-native--expo)
4. [Navigation — Expo Router](#2-navigation--expo-router)
5. [Styling — NativeWind (Tailwind for RN)](#3-styling--nativewind-tailwind-for-rn)
6. [Maps — Google Maps SDK](#4-maps--google-maps-sdk-react-native-maps)
7. [Mock Data & State — Zustand + Local JSON](#5-mock-data--state--zustand--local-json)
8. [Dev Tooling — Expo Go, Metro, React Native DevTools](#6-dev-tooling--expo-go-metro-react-native-devtools)

**v1.0 — Full Production Stack**

9. [Backend API — Node.js (Express or Fastify)](#7-backend-api--nodejs-express-or-fastify)
10. [Real-Time Layer — Socket.io](#8-real-time-layer--socketio)
11. [Primary Database — PostgreSQL](#9-primary-database--postgresql)
12. [Cache & Sessions — Redis](#10-cache--sessions--redis)
13. [Maps & Location — Google Maps Platform (Full)](#11-maps--location--google-maps-platform-full)
14. [Payments — Stripe + TNG + GrabPay + Google Pay](#12-payments--stripe--tng--grabpay--google-pay)
15. [Authentication — Clerk vs Firebase Auth](#13-authentication--clerk-vs-firebase-auth)
16. [File Storage — Google Cloud Storage](#14-file-storage--google-cloud-storage)
17. [Push Notifications — Firebase Cloud Messaging](#15-push-notifications--firebase-cloud-messaging-fcm)
18. [Driver Verification — Google Cloud Vision API](#16-driver-verification--google-cloud-vision-api)
19. [Email — SendGrid](#17-email--sendgrid)
20. [Admin Dashboard — React (Web)](#18-admin-dashboard--react-web)
21. [Infrastructure — GCP (Southeast Asia)](#19-infrastructure--gcp-southeast-asia)
22. [CI/CD — GitHub Actions](#20-cicd--github-actions)
23. [Stack Summary](#stack-summary)

---

## Guiding Principles

Every technology choice is evaluated against four criteria:
1. **Speed** — Can we ship MVP in 1 month with this?
2. **Cost** — Does it fit a lean startup budget?
3. **Talent** — Is it easy to hire for in Malaysia?
4. **Fit** — Does it solve the specific problem well?

---

## Phase Overview

| Phase | Goal | What gets built | Backend needed? |
|-------|------|----------------|-----------------|
| **v0.1 — Mockup** | Validate UI/UX, get stakeholder feedback, support APAD application | Rider app screens, driver app screens, navigation flows, map UI — all with mock data | No |
| **v1.0 — Production** | Launch the real app with live rides, payments, and driver onboarding | Full backend, real-time tracking, payments, auth, admin panel | Yes |

**v0.1 is frontend only.** No server, no database, no payments, no authentication against a real backend. All data is mocked locally. This lets the team focus on getting the UI right before building infrastructure.

---

# v0.1 — MOCKUP STACK (Frontend Only)

Everything below is what the team needs to build and run the mockup. Total cost: **$0.**

---

## 1. Mobile Framework — React Native + Expo

### What it does
React Native is a JavaScript framework that lets one team write a single codebase that compiles to native iOS and Android apps. Expo is a managed platform on top of React Native that handles configuration, builds, and tooling.

### Why React Native + Expo
- **One codebase, two platforms.** Writing separate Swift (iOS) and Kotlin (Android) apps would require two separate teams and double the development time — incompatible with a 1-month MVP.
- **Large talent pool.** React Native developers are widely available in Malaysia. React/JavaScript skills transfer directly.
- **Expo removes native complexity.** No need to touch Xcode or Android Studio config files. `npx expo start` and you're developing.
- **Mature ecosystem.** Has production-proven SDKs for Google Maps, Firebase, Stripe, TNG, and GrabPay — all required for Teeko.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Flutter (Dart)** | Smaller talent pool in Malaysia; Dart is a niche language with fewer developers available. Strong technical choice but hiring risk is higher. |
| **Native iOS (Swift) + Native Android (Kotlin)** | Requires two separate teams, doubles development cost and time. Not viable for a 1-month MVP. |
| **Ionic / Capacitor** | Web-wrapped apps with inferior performance for real-time map rendering and GPS tracking — critical for e-hailing. |
| **PWA (Progressive Web App)** | No access to background GPS tracking, push notifications, or deep device integrations needed for a driver app. Not viable. |

---

## 2. Navigation — Expo Router

### What it does
Handles screen-to-screen navigation in the app — e.g. home → booking → ride tracking → trip complete.

### Why Expo Router
- **File-based routing.** Works like Next.js — create a file, get a route. Familiar to web developers.
- **Built into Expo.** No extra installation or config. Ships with the Expo SDK.
- **Deep linking support.** Required later for payment app callbacks (TNG, GrabPay returning to Teeko after payment).
- **Type-safe.** Full TypeScript support for route parameters.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **React Navigation** | The underlying library Expo Router is built on. Using React Navigation directly requires more manual setup (stack/tab config). Expo Router wraps it with file-based routing — less boilerplate. |
| **Custom navigation** | Reinventing the wheel. No benefit for this use case. |

---

## 3. Styling — NativeWind (Tailwind for RN)

### What it does
NativeWind brings Tailwind CSS utility classes to React Native. Instead of writing `StyleSheet.create({ container: { flex: 1, padding: 16 } })`, you write `className="flex-1 p-4"`.

### Why NativeWind
- **Familiar to web developers.** If the team knows Tailwind CSS, they can style React Native components with the same classes — near-zero learning curve.
- **Fast iteration.** Utility classes are faster to write and modify than React Native stylesheets, especially during a mockup phase where the UI changes constantly.
- **Works with Expo.** NativeWind v4 is built for Expo and supports the new React Native architecture.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **React Native StyleSheet (default)** | Verbose, harder to iterate quickly during mockup phase. Fine for production polish but slows down rapid UI exploration. |
| **Tamagui** | Powerful but has a steeper learning curve and more complex setup. Better suited for design-system-heavy apps post-MVP. |
| **Styled Components / Emotion** | CSS-in-JS libraries designed for web. React Native support is less mature and adds bundle size. |
| **Unistyles** | Promising alternative but smaller community. NativeWind has broader adoption and more learning resources. |

---

## 4. Maps — Google Maps SDK (react-native-maps)

### What it does
Renders the interactive map in the rider and driver app mockups — showing a map view, pickup/dropoff pins, and a mock route.

### Why Google Maps (even for mockup)
- **Included in the Expo SDK.** `react-native-maps` ships with Expo — no custom native build needed. Works in Expo Go.
- **Best coverage in Malaysia.** Google Maps has the most accurate road data, POIs, and addresses in Malaysia.
- **$200/month free credit.** Google Maps Platform gives $200 free credit monthly — more than enough for mockup development with a small team.
- **Same SDK used in production.** No migration needed later. The mockup map code carries forward to v1.0.

### For v0.1 specifically
- Use static pickup/dropoff coordinates for mock rides
- Display a hardcoded route polyline (no Directions API calls needed)
- Driver location can be animated locally with `setInterval` — no backend needed

---

## 5. Mock Data & State — Zustand + Local JSON

### What it does
Since v0.1 has no backend, all data (rides, drivers, user profiles, trip history) is stored locally using a lightweight state manager and JSON fixtures.

### Why Zustand
- **Tiny and simple.** ~1 KB, no boilerplate, no reducers, no providers wrapping your app. Create a store in 5 lines.
- **Familiar pattern.** Works like React hooks — `const rides = useStore(s => s.rides)`. Any React developer picks it up immediately.
- **Carries forward.** When the backend is added in v1.0, Zustand stores stay the same — you just swap mock data for API calls.

### How mock data works

```
/data
  mock-rides.json        — sample ride history
  mock-drivers.json      — driver profiles with photos
  mock-fare-estimates.json — precalculated fares for demo routes
```

Screens read from these JSON files via Zustand stores. No API calls, no network dependency. The mockup works entirely offline.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Redux** | Too much boilerplate (actions, reducers, middleware) for a mockup with local data. Overkill. |
| **React Context** | Works but causes unnecessary re-renders. Zustand is more performant and has a cleaner API for shared state. |
| **MobX** | Observable pattern adds complexity. Zustand's hook-based API is simpler for this team. |
| **No state manager (just `useState`)** | Fine for a single screen, but Teeko's mockup has shared state across screens (selected ride, driver location, user profile). A store avoids prop-drilling. |

---

## 6. Dev Tooling — Expo Go, Metro, React Native DevTools

### What it does
The development tools used daily to write, preview, and debug the mockup.

| Tool | Purpose | Cost |
|------|---------|------|
| **Expo Go** | Preview the app on a physical iPhone or Android phone by scanning a QR code — no build step | Free |
| **Metro** | The dev server (like webpack) that bundles JS and serves it to the device | Free (ships with Expo) |
| **React Native DevTools** | Debugger with Chrome DevTools UI — inspect components, set breakpoints, view console logs | Free (built into RN 0.76+) |
| **Expo Orbit** | Windows app for one-click Android emulator management | Free |
| **`npx expo start --web`** | Preview the app in your browser for fastest iteration (before testing on device) | Free |

### v0.1 Development Workflow

```
Code change → Browser preview (instant) → Android emulator (spot-check) → Phone via Expo Go (final test)
```

See [react-native-getting-started.md](react-native-getting-started.md) for full setup instructions.

---

## v0.1 Mockup Stack — Summary

| Layer | Technology | Cost | Notes |
|-------|-----------|------|-------|
| Mobile framework | React Native + Expo | Free | One codebase for iOS + Android |
| Navigation | Expo Router | Free | File-based routing, ships with Expo |
| Styling | NativeWind (Tailwind CSS) | Free | Familiar to web devs, fast iteration |
| Maps | Google Maps SDK (`react-native-maps`) | Free | $200/mo free credit, works in Expo Go |
| State management | Zustand | Free | Lightweight, carries forward to production |
| Mock data | Local JSON files | Free | No backend dependency |
| Dev preview | Expo Go + browser + Android emulator | Free | Full hot reload workflow on Windows |
| Debugging | React Native DevTools | Free | Chrome DevTools frontend |

**Total cost for v0.1: $0**

---

# v1.0 — FULL PRODUCTION STACK

Everything below is planned for when the mockup is approved and development moves to a working product. These sections are included now for planning — they will not be built during v0.1.

---

## 7. Backend API — Node.js (Express or Fastify)

### What it does
Node.js is the server-side runtime that powers Teeko's backend API — handling ride requests, user accounts, trip logic, payments, and all communication between the rider app, driver app, and admin panel.

### Why Node.js
- **JavaScript end-to-end.** The mobile apps (React Native) and admin panel (React) are JavaScript. Using Node.js means the entire team shares one language — reducing context-switching and enabling developers to contribute across the stack.
- **Event-driven, non-blocking I/O.** Node.js is purpose-built for high-concurrency workloads — exactly what an e-hailing platform needs (many simultaneous ride requests, real-time location pings, payment events).
- **Massive ecosystem (npm).** Every integration Teeko needs — Stripe, Google Maps, Socket.io, PostgreSQL — has a mature, well-maintained Node.js library.
- **Express / Fastify.** Express is the most widely used Node.js framework globally — easy to hire for. Fastify is a faster drop-in alternative if performance becomes a concern.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Python (Django / FastAPI)** | Strong choice technically, but splits the team language. FastAPI is excellent for ML/data workloads — less compelling for a real-time API without those needs. |
| **Go (Golang)** | Exceptional performance and concurrency, but far fewer Malaysian developers are proficient in Go. Hiring risk too high for a 1-month build. |
| **Ruby on Rails** | Rapid prototyping framework but declining in adoption globally. Limited talent pool. Less suited for high-concurrency real-time workloads. |
| **Java / Spring Boot** | Enterprise-grade but verbose and slow to build with. Significant overhead for a startup MVP. |
| **PHP (Laravel)** | Common in Malaysia but not suited to real-time event-driven architecture. Better for traditional request-response web apps. |

---

## 8. Real-Time Layer — Socket.io

### What it does
WebSockets enable a persistent, two-way connection between the server and the apps. Socket.io is a library built on top of WebSockets. This powers:
- Live driver location updates on the rider's map
- Real-time ride request delivery to the driver
- Trip status changes (driver arrived, trip started, trip completed)
- Surge zone activation alerts to drivers

### Why Socket.io
- **Persistent connection.** Unlike standard HTTP (which is request-response), WebSockets keep a live channel open — essential for real-time location tracking without constant polling.
- **Low latency.** Location updates need to be near-instant. A driver's pin on the rider's map must move smoothly. WebSockets deliver sub-100ms updates.
- **Automatic fallback.** Socket.io automatically falls back to HTTP long-polling if WebSockets are unavailable — useful for older devices or poor network conditions common in Malaysian traffic.
- **Native Node.js integration.** Socket.io is built for Node.js — zero friction to integrate with the chosen backend.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **HTTP Polling** | Repeatedly asking the server "any updates?" wastes bandwidth, increases server load, and introduces noticeable lag — unacceptable for live location tracking. |
| **Firebase Realtime Database / Firestore** | Good for simpler real-time use cases. However, using Firebase as the primary real-time layer creates vendor lock-in and adds cost at scale. Socket.io on owned infrastructure is more cost-effective long-term. |
| **gRPC streaming** | More complex to implement and debug. Overkill for this use case. Limited browser/React Native support compared to WebSockets. |

---

## 9. Primary Database — PostgreSQL

### What it does
PostgreSQL is the main relational database storing all structured data: user accounts, driver profiles, vehicle records, trips, payments, commissions, payouts, ratings, and audit logs.

### Why PostgreSQL
- **Relational data model.** E-hailing data is highly relational — a trip links a rider, a driver, a vehicle, a fare, a payment, and a rating. A relational database with foreign keys and joins handles this naturally and safely.
- **ACID compliance.** Financial transactions (commission deductions, payouts, refunds) require strict transactional guarantees. PostgreSQL is fully ACID-compliant — data integrity is never compromised.
- **Mature and battle-tested.** Used in production by companies at Teeko's scale and far beyond. No stability risk.
- **Free and open source.** No licensing costs.
- **PDPA compliance support.** PostgreSQL supports row-level security, encryption at rest, and fine-grained access controls — important for PDPA 2010 compliance.
- **GCP managed option.** Cloud SQL for PostgreSQL on GCP provides automated backups, replication, and patching.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **MySQL / MariaDB** | Solid alternative with similar capabilities. PostgreSQL is preferred for its stricter standards compliance, better JSON support, and more advanced query planner. Either would work. |
| **MongoDB (document store)** | Flexible schema is useful for unstructured data but creates data integrity risks for financial records. Joins and transactions are less natural. Not the right fit for relational e-hailing data. |
| **Firebase Firestore** | Managed, easy to set up, but expensive at scale, limited querying capability, and creates vendor lock-in. Not suitable as a primary database for a platform of this complexity. |
| **SQLite** | Embedded database — not designed for multi-server, high-concurrency production use. |

---

## 10. Cache & Sessions — Redis

### What it does
Redis is an in-memory data store used for data that needs to be accessed extremely fast or updated frequently:
- **Live driver location cache** — driver GPS coordinates updated every few seconds; stored in Redis for fast reads by the rider app
- **Session tokens** — user authentication sessions
- **Surge zone state** — active surge multipliers per zone, read by every ride request
- **Rate limiting** — prevent abuse of the API (e.g. too many OTP requests)
- **Job queues** — background tasks like sending push notifications or processing payouts

### Why Redis
- **In-memory speed.** Redis reads and writes in microseconds — critical for driver location lookups happening dozens of times per second across all active trips.
- **Purpose-built for caching.** The most widely adopted caching layer in the industry.
- **Pub/Sub support.** Redis pub/sub can be used alongside Socket.io for scaling real-time events across multiple server instances.
- **TTL (time-to-live).** Driver location entries automatically expire if the driver goes offline — no manual cleanup needed.
- **GCP managed option.** Memorystore for Redis on GCP provides a fully managed Redis instance with automatic failover.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Memcached** | Simpler and faster for pure key-value caching, but lacks persistence, pub/sub, sorted sets, and the rich data structures Redis provides. Redis does everything Memcached does and more. |
| **Storing location in PostgreSQL** | A relational database is not optimised for thousands of tiny writes per second (location pings). It would create unnecessary load and latency on the primary database. |
| **In-memory (application-level)** | Does not survive server restarts and cannot be shared across multiple server instances. Not viable for production. |

---

## 11. Maps & Location — Google Maps Platform (Full)

### What it does
Extends the v0.1 Maps SDK usage with server-side API calls:
- **Places API** — destination search with autocomplete (rider app)
- **Directions API** — route calculation between pickup and destination
- **Distance Matrix API** — fare estimation based on distance and duration
- **Maps SDK** — renders the interactive map (already used in v0.1)
- **Geocoding API** — converts GPS coordinates to readable addresses

### Why Google Maps
- **Best coverage in Malaysia.** Google Maps has the most accurate, up-to-date road data, POIs, and addresses in Malaysia — critical for e-hailing.
- **Industry standard for e-hailing.** Grab, Bolt, and virtually every e-hailing platform globally uses Google Maps. The APIs are proven at scale.
- **Integrated ecosystem.** Places, Directions, Distance Matrix, and the Maps SDK are all under one billing account and one SDK — simpler to manage.
- **Natural fit with GCP.** Same billing account as the rest of the infrastructure.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Mapbox** | Strong alternative with competitive pricing at scale. However, map data quality and POI accuracy in Malaysia is inferior to Google Maps. Higher integration risk for MVP. |
| **HERE Maps** | Enterprise-grade but less developer-friendly, higher cost, and less accurate in Southeast Asia. |
| **OpenStreetMap (OSM)** | Free but map data in Malaysia is incomplete and inconsistently maintained. Requires significant effort to self-host tiles. Not viable for a production app. |
| **Apple Maps (MapKit)** | iOS only — incompatible with a cross-platform React Native app. |

---

## 12. Payments — Stripe + TNG + GrabPay + Google Pay

### What it does
Handles all rider payment flows — charging for trips, processing refunds, and managing payment methods.

- **Stripe** — credit/debit card processing (Visa, Mastercard)
- **Touch 'n Go eWallet SDK** — Malaysia's most widely used e-wallet
- **GrabPay SDK** — second most popular e-wallet in Malaysia
- **Google Pay SDK** — card-on-file payments via Google Pay

### Why this combination
- **Market coverage.** In Malaysia, cash is declining but card penetration is moderate. TNG eWallet has over 20 million users — it is the dominant payment method for many Malaysians. Offering only card payments would exclude a large segment of the target market.
- **Stripe for cards.** Stripe is the gold standard for card processing globally — PCI DSS compliant, excellent developer experience, supports MYR, and handles fraud detection.
- **TNG and GrabPay are table stakes.** Competing e-hailing apps in Malaysia (including Grab itself) offer both. Not supporting them is a competitive disadvantage.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Braintree (PayPal)** | Lower adoption in Malaysia. Stripe has better documentation, a stronger SDK, and is more widely used by Malaysian startups. |
| **iPay88 / Billplz** | Malaysian payment gateways suitable for FPX/bank transfers, but not designed for in-app mobile payment flows. Better suited for the deferred Teeko Wallet top-up feature. |
| **FPX (bank transfer)** | Suitable for wallet top-ups but too slow and cumbersome for in-trip payments. Deferred to Phase 2. |
| **Cash payments** | Eliminates the payment data trail needed for receipts, commissions, and PDPA compliance. Creates safety risks (drivers carrying cash). Not supported. |

---

## 13. Authentication — Clerk vs Firebase Auth

### What it does
Authenticates riders and drivers via phone number + one-time password (OTP). The user enters their Malaysian phone number, receives an SMS code, and is verified.

### Why Phone OTP
- **Universally accessible.** Every Malaysian smartphone user has a phone number. No dependency on having a Google or Apple account.
- **Strong identity signal.** Phone numbers are tied to real SIM registrations in Malaysia (MCMC-regulated) — harder to fake than email addresses.
- **Industry norm for e-hailing.** Grab, Bolt, and inDriver all use phone OTP. Riders expect it.

### Clerk vs Firebase Auth vs Auth0

| Criteria | Clerk | Firebase Auth | Auth0 |
|----------|-------|--------------|-------|
| **Expo/React Native SDK** | Excellent — native `@clerk/expo` package with full phone OTP support | Good — `@react-native-firebase/auth` is mature | Poor — browser-based OAuth on mobile, reported App Store rejections |
| **Phone OTP** | ✅ Supported (requires Pro plan for SMS) | ✅ Supported (free tier: 10K verifications/mo) | ✅ Supported but browser-based flow |
| **Free tier** | 50,000 MAUs free, but **SMS/OTP requires Pro plan ($25/mo)** | 10,000 phone verifications/month free | 25,000 MAUs free, SMS add-on costs extra |
| **Malaysia SMS** | Must manually add Malaysia to SMS allowlist (defaults to US/Canada only) | Works globally out of the box | Works globally |
| **User management UI** | Built-in dashboard with user management, session controls, device tracking | Basic user list in Firebase Console | Full dashboard with user management |
| **Push notification integration** | Separate — no FCM integration | Same SDK as FCM — one integration for auth + push | Separate |
| **Pre-built UI components** | Yes — `<SignIn />`, `<SignUp />` Expo components | No — must build your own UI | Yes — but browser-based (Universal Login) |
| **DX (Developer Experience)** | Best-in-class | Good, well-documented | Complex setup, steep learning curve |

### Recommendation: Decide based on budget

**If $25/month for auth is acceptable → Clerk**
- Best developer experience, pre-built Expo UI components, modern user management dashboard
- Pro plan ($25/mo) needed for phone SMS — non-negotiable for OTP login
- Configure Malaysia in SMS allowlist during setup

**If everything must be free → Firebase Auth**
- 10,000 free phone verifications/month covers MVP and early launch
- Already shares the Firebase SDK with FCM (push notifications) — one integration for both
- Simpler setup, less feature-rich user management

**Not recommended → Auth0**
- Browser-based mobile auth creates friction and App Store rejection risk
- More complex pricing, harder to set up for React Native

### Why not social login only

| Alternative | Why Not |
|-------------|---------|
| **Google Sign-In / Social login** | Excludes users without a Google account. Phone OTP is more inclusive for the Malaysian target market. |
| **Email + Password** | Slower sign-up flow; email addresses are less reliable identity signals than phone numbers for this use case. |
| **Apple Sign-In** | iOS only — incompatible with Android-first Malaysian market. |

---

## 14. File Storage — Google Cloud Storage

### What it does
Stores all binary files uploaded to the platform:
- Driver document photos (IC, CDL, PSV-D licence, insurance, PUSPAKOM cert)
- Vehicle photos
- Driver and rider profile photos

### Why Google Cloud Storage
- **GCP-native.** Since Teeko runs on GCP, Cloud Storage integrates natively with Cloud Run, Cloud Vision API, and IAM — no cross-cloud networking.
- **Firebase Storage compatibility.** Cloud Storage is the underlying engine for Firebase Storage — can use the simpler Firebase SDK for mobile uploads while retaining full GCP access controls for the backend.
- **Fine-grained access control.** Driver documents are sensitive personal data. IAM policies and signed URLs ensure only authorised services can access documents.
- **Signed URLs.** The admin panel generates temporary, expiring URLs to view driver documents without exposing the underlying storage path — important for PDPA compliance.
- **Southeast Asia region available.** `asia-southeast1` (Singapore) keeps data within the region for PDPA data residency requirements.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **AWS S3** | Equally capable, but adds cross-cloud complexity since the rest of the stack is on GCP. Better to stay within one cloud provider. |
| **Firebase Storage (only)** | Built on Cloud Storage but with a simpler API. Suitable for mobile uploads, but the backend and admin panel need full GCP SDK access for document management workflows. Use Firebase SDK for uploads, GCP SDK for backend access — they point to the same bucket. |
| **Storing files in PostgreSQL (binary)** | Storing large binary files in a relational database bloats storage, degrades query performance, and is not cost-effective. Never recommended for production. |
| **Self-hosted (MinIO)** | Adds operational overhead — managing storage infrastructure is not a core competency for Teeko. Managed cloud storage is more reliable and cheaper at this scale. |

---

## 15. Push Notifications — Firebase Cloud Messaging (FCM)

### What it does
Delivers push notifications to iOS and Android devices for both the rider and driver apps:
- Rider: driver matched, driver arrived, trip started, trip completed, ride cancelled
- Driver: new ride request, EVP approval, document expiry warning, suspension notice
- Both: broadcast notifications from admin

### Why FCM
- **Free.** FCM is entirely free with no volume limits — significant cost saving for a startup.
- **Cross-platform.** One integration handles both iOS (via APNs) and Android. React Native libraries (e.g. `@react-native-firebase/messaging`) make this seamless.
- **Reliable delivery.** Google's infrastructure ensures high delivery rates globally, including Malaysia.
- **Shares Firebase SDK.** If Firebase Auth is chosen, FCM comes with the same SDK at no extra integration cost.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **OneSignal** | Solid managed alternative with a generous free tier. Adds an extra third-party vendor dependency when FCM is already available via Firebase. |
| **Expo Notifications** | Good for Expo Go development (used in v0.1), but FCM is the production standard for reliable delivery and topic-based messaging. |
| **Pusher** | Better suited for in-app real-time UI updates (already handled by Socket.io). Not the standard choice for OS-level push notifications. |

---

## 16. Driver Verification — Google Cloud Vision API

### What it does
- **OCR (Optical Character Recognition)** — automatically reads text from uploaded driver documents (IC number, expiry dates, licence class) to pre-fill fields and flag mismatches before manual review
- **Liveness / Selfie Check** — confirms the person registering is physically present (not using a photo of someone else's face)

### Why this is needed
APAD requires drivers to hold valid PSV-D licences and registered vehicles. Teeko is legally responsible for verifying this before a driver goes live. Manual review alone is too slow at scale.

### Recommended options
- **Google Cloud Vision API** — OCR for document reading; integrates natively with GCP infrastructure and Cloud Storage
- **Google ML Kit** — on-device OCR for faster document scanning in the mobile app (runs locally, no API call needed)
- **Jumio / Onfido** — specialist identity verification SaaS products with pre-built Malaysian IC support; higher cost but fastest to integrate for MVP

### Liveness detection
Google Cloud Vision API does not include liveness detection natively. Options:
- **Jumio / Onfido** — includes liveness as part of their identity verification flow (recommended for MVP speed)
- **Google ML Kit Face Detection** — on-device face detection with liveness indicators; requires custom implementation
- **FaceTec** — specialist liveness SDK; high accuracy but adds a vendor dependency

### Why not skipping this
Skipping automated verification means 100% manual document review for every driver — not scalable and a liability risk if fraudulent drivers slip through.

---

## 17. Email — SendGrid

### What it does
Sends transactional emails to riders and drivers:
- Trip receipts (post-trip)
- Account registration confirmation
- Payout notifications to drivers

### Why SendGrid
- **GCP's recommended email partner.** GCP does not have a native email service (unlike AWS SES). Google recommends SendGrid for transactional email.
- **Free tier covers MVP.** 100 emails/day free — sufficient for development and early launch.
- **Good developer experience.** Pre-built email templates, analytics, and a well-documented API.
- **Deliverability.** Managed deliverability, bounce handling, and spam compliance.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **AWS SES** | Extremely low cost (USD 0.10/1,000 emails) but adds a cross-cloud dependency. If email volume grows significantly post-MVP, SES migration is straightforward. |
| **Mailgun** | Comparable to SendGrid. Either works. SendGrid has a slightly better free tier and is GCP's recommended partner. |
| **Sending email directly (SMTP)** | Poor deliverability — emails land in spam. A dedicated service manages reputation and compliance. |

---

## 18. Admin Dashboard — React (Web)

### What it does
The internal web application used by Teeko's operations, support, and finance teams. Built as a standard web app — no mobile app required for admin.

### Why React
- **Same language as React Native.** The mobile team's JavaScript/React knowledge transfers directly to the admin panel — no separate frontend skillset needed.
- **Rich component ecosystem.** Libraries like Ant Design, MUI, or TanStack Table provide pre-built data tables, forms, and dashboards — significantly reducing build time.
- **SPA (Single Page Application).** React's SPA architecture makes data-heavy admin interfaces (live maps, large tables, real-time updates) responsive and fast.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Next.js** | Adds server-side rendering capability — useful for public-facing marketing sites, but unnecessary for an internal admin tool behind a login. Adds complexity without benefit here. |
| **Vue.js** | Capable framework but the team is already invested in React/React Native. No benefit in splitting the frontend into two frameworks. |
| **Angular** | Heavier framework, steeper learning curve. Overkill for an internal dashboard. |
| **No-code tools (Retool, AppSmith)** | Fast to prototype but lack the customisation needed for a live trip map, complex document review workflows, and real-time surge control. Technical debt accumulates quickly. |

---

## 19. Infrastructure — GCP (Southeast Asia)

### What it does
Hosts all Teeko backend services, databases, file storage, and the admin panel.

### Why GCP
- **Natural fit with existing stack.** Google Maps, Firebase Auth/FCM, and Cloud Storage are all Google products. One billing account, one IAM system, one console — simpler to manage and debug.
- **Cloud Run for containers.** Cloud Run is a serverless container platform — deploy the Node.js API without managing servers. Scales to zero when idle (cost saving for MVP), scales up automatically under load.
- **Managed databases.** Cloud SQL (PostgreSQL) and Memorystore (Redis) with automated backups, patching, and failover.
- **Southeast Asia region.** `asia-southeast1` (Singapore) provides low latency for Malaysian users. GCP has announced a future Malaysia region — migration will be straightforward when available.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **AWS** | Equally capable and has a Kuala Lumpur region (`ap-southeast-5`). However, the rest of the Teeko stack (Maps, Firebase, Cloud Storage) is Google-native. Splitting across AWS and GCP adds operational complexity with no benefit. |
| **Azure** | Strong enterprise offering but less commonly used by Malaysian startups. Smaller local developer community for support. |
| **DigitalOcean / Linode** | Cost-effective for simple workloads but lacks the managed services (Cloud SQL, Memorystore, Cloud Vision) that accelerate development. |
| **Self-hosted (on-premise)** | Requires significant infrastructure investment and ops expertise. Not appropriate for a startup MVP. |

### PDPA Compliance
Malaysia's Personal Data Protection Act (PDPA 2010) requires that personal data of Malaysian users be handled with appropriate safeguards. Hosting in `asia-southeast1` (Singapore) keeps data within the region. When GCP's Malaysia region launches, migration will reduce latency further and strengthen data residency compliance.

---

## 20. CI/CD — GitHub Actions

### What it does
Automates the build, test, and deployment pipeline:
- Runs automated tests on every pull request
- Builds and deploys the backend API when code is merged to main
- Triggers EAS Build for React Native app bundles

### Why GitHub Actions
- **Already on GitHub.** The repo is hosted at GitHub (Blueprint-Agency/teeko-ehailing). GitHub Actions is built-in — no separate CI tool to set up or pay for.
- **Free for public repos; generous free tier for private.** 2,000 minutes/month free — sufficient for MVP.
- **Large marketplace.** Pre-built actions for Node.js, React Native, GCP deployment, and EAS Build.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **CircleCI** | Capable but adds cost and a separate platform to manage. No advantage over GitHub Actions for this stack. |
| **Jenkins** | Self-hosted, requires dedicated infrastructure to maintain. Overkill for a startup. |
| **Google Cloud Build** | GCP-native but less community support and fewer pre-built actions than GitHub Actions. Can be added later if tighter GCP integration is needed. |

---

## Stack Summary

### v0.1 — Mockup (Frontend Only)

| Layer | Technology | Cost |
|-------|-----------|------|
| Mobile framework | React Native + Expo | Free |
| Navigation | Expo Router | Free |
| Styling | NativeWind (Tailwind CSS) | Free |
| Maps | Google Maps SDK | Free ($200/mo credit) |
| State / mock data | Zustand + local JSON | Free |
| Dev tooling | Expo Go, Metro, RN DevTools | Free |
| **Total** | | **$0** |

### v1.0 — Full Production

| Layer | Technology | Cost |
|-------|-----------|------|
| Mobile apps | React Native + Expo | Free |
| Backend API | Node.js (Express/Fastify) | Free |
| Real-time | Socket.io (WebSockets) | Free |
| Primary database | PostgreSQL (Cloud SQL) | ~$7/mo (smallest instance) |
| Cache / sessions | Redis (Memorystore) | ~$35/mo (basic tier) |
| Maps | Google Maps Platform | $200/mo free credit |
| Card payments | Stripe | 2.9% + $0.30/txn |
| E-wallets | TNG + GrabPay + Google Pay | Integration cost only |
| Auth | Clerk ($25/mo) or Firebase Auth (free) | $0–$25/mo |
| File storage | Google Cloud Storage | ~$0.02/GB/mo |
| Push notifications | Firebase FCM | Free |
| Driver verification | Cloud Vision API / Jumio | Pay-per-use |
| Email | SendGrid | Free (100/day) |
| Admin panel | React (web) | Free |
| Hosting | GCP Cloud Run (asia-southeast1) | Pay-per-use, scales to zero |
| CI/CD | GitHub Actions | Free (2,000 min/mo) |

---

*This document should be reviewed when the team scales beyond MVP. Technology choices at startup scale may not be optimal at 10× or 100× load.*

*Updated 2026-04-11.*
