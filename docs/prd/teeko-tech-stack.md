# Teeko — Tech Stack PRD

> **Version:** 1.0
> **Date:** 2026-04-08
> **Status:** Draft
> **Purpose:** Defines and justifies every technology choice in the Teeko platform, with comparisons against alternatives.

---

## Guiding Principles

Every technology choice is evaluated against four criteria:
1. **Speed** — Can we ship MVP in 1 month with this?
2. **Cost** — Does it fit a lean startup budget?
3. **Talent** — Is it easy to hire for in Malaysia?
4. **Fit** — Does it solve the specific problem well?

---

## 1. Mobile Apps — React Native

### What it does
React Native is a JavaScript framework that lets one team write a single codebase that compiles to native iOS and Android apps. Teeko needs two apps — rider and driver — each on both platforms.

### Why React Native
- **One codebase, two platforms.** Writing separate Swift (iOS) and Kotlin (Android) apps would require two separate teams and double the development time — incompatible with a 1-month MVP.
- **Large talent pool.** React Native developers are widely available in Malaysia. React/JavaScript skills transfer directly.
- **Near-native performance.** For an e-hailing app (maps, real-time updates, payments), React Native performs on par with native for all required use cases.
- **Mature ecosystem.** Has production-proven SDKs for Google Maps, Firebase, Stripe, TNG, and GrabPay — all required for Teeko.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Flutter (Dart)** | Smaller talent pool in Malaysia; Dart is a niche language with fewer developers available. Strong technical choice but hiring risk is higher. |
| **Native iOS (Swift) + Native Android (Kotlin)** | Requires two separate teams, doubles development cost and time. Ideal for large teams post-Series A, not for a 1-month MVP. |
| **Ionic / Capacitor** | Web-wrapped apps with inferior performance for real-time map rendering and GPS tracking — critical for e-hailing. |
| **PWA (Progressive Web App)** | No access to background GPS tracking, push notifications, or deep device integrations needed for a driver app. Not viable. |

---

## 2. Backend API — Node.js (Express or Fastify)

### What it does
Node.js is the server-side runtime that powers Teeko's backend API — handling ride requests, user accounts, trip logic, payments, and all communication between the rider app, driver app, and admin panel.

### Why Node.js
- **JavaScript end-to-end.** The mobile apps (React Native) and admin panel (React) are JavaScript. Using Node.js means the entire team shares one language — reducing context-switching and enabling developers to contribute across the stack.
- **Event-driven, non-blocking I/O.** Node.js is purpose-built for high-concurrency workloads — exactly what an e-hailing platform needs (many simultaneous ride requests, real-time location pings, payment events).
- **Massive ecosystem (npm).** Every integration Teeko needs — Stripe, Firebase, Google Maps, Socket.io, PostgreSQL — has a mature, well-maintained Node.js library.
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

## 3. Real-Time Layer — WebSockets / Socket.io

### What it does
WebSockets enable a persistent, two-way connection between the server and the apps. Socket.io is a library built on top of WebSockets. This powers:
- Live driver location updates on the rider's map
- Real-time ride request delivery to the driver
- Trip status changes (driver arrived, trip started, trip completed)
- Surge zone activation alerts to drivers

### Why WebSockets / Socket.io
- **Persistent connection.** Unlike standard HTTP (which is request-response), WebSockets keep a live channel open — essential for real-time location tracking without constant polling.
- **Low latency.** Location updates need to be near-instant. A driver's pin on the rider's map must move smoothly. WebSockets deliver sub-100ms updates.
- **Socket.io fallback.** Socket.io automatically falls back to HTTP long-polling if WebSockets are unavailable — useful for older devices or poor network conditions common in Malaysian traffic.
- **Native Node.js integration.** Socket.io is built for Node.js — zero friction to integrate with the chosen backend.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **HTTP Polling** | Repeatedly asking the server "any updates?" wastes bandwidth, increases server load, and introduces noticeable lag — unacceptable for live location tracking. |
| **Firebase Realtime Database / Firestore** | Good for simpler real-time use cases. However, using Firebase as the primary real-time layer creates vendor lock-in and adds cost at scale. Socket.io on owned infrastructure is more cost-effective long-term. |
| **gRPC streaming** | More complex to implement and debug. Overkill for this use case. Limited browser/React Native support compared to WebSockets. |

---

## 4. Primary Database — PostgreSQL

### What it does
PostgreSQL is the main relational database storing all structured data: user accounts, driver profiles, vehicle records, trips, payments, commissions, payouts, ratings, and audit logs.

### Why PostgreSQL
- **Relational data model.** E-hailing data is highly relational — a trip links a rider, a driver, a vehicle, a fare, a payment, and a rating. A relational database with foreign keys and joins handles this naturally and safely.
- **ACID compliance.** Financial transactions (commission deductions, payouts, refunds) require strict transactional guarantees. PostgreSQL is fully ACID-compliant — data integrity is never compromised.
- **Mature and battle-tested.** Used in production by companies at Teeko's scale and far beyond. No stability risk.
- **Free and open source.** No licensing costs.
- **PDPA compliance support.** PostgreSQL supports row-level security, encryption at rest, and fine-grained access controls — important for PDPA 2010 compliance.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **MySQL / MariaDB** | Solid alternative with similar capabilities. PostgreSQL is preferred for its stricter standards compliance, better JSON support, and more advanced query planner. Either would work. |
| **MongoDB (document store)** | Flexible schema is useful for unstructured data but creates data integrity risks for financial records. Joins and transactions are less natural. Not the right fit for relational e-hailing data. |
| **Firebase Firestore** | Managed, easy to set up, but expensive at scale, limited querying capability, and creates vendor lock-in. Not suitable as a primary database for a platform of this complexity. |
| **SQLite** | Embedded database — not designed for multi-server, high-concurrency production use. |

---

## 5. Cache & Session Store — Redis

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

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Memcached** | Simpler and faster for pure key-value caching, but lacks persistence, pub/sub, sorted sets, and the rich data structures Redis provides. Redis does everything Memcached does and more. |
| **Storing location in PostgreSQL** | A relational database is not optimised for thousands of tiny writes per second (location pings). It would create unnecessary load and latency on the primary database. |
| **In-memory (application-level)** | Does not survive server restarts and cannot be shared across multiple server instances. Not viable for production. |

---

## 6. Maps & Location — Google Maps Platform

### What it does
Google Maps Platform provides the mapping and location intelligence across all Teeko apps:
- **Places API** — destination search with autocomplete (rider app)
- **Directions API** — route calculation between pickup and destination
- **Distance Matrix API** — fare estimation based on distance and duration
- **Maps SDK** — renders the interactive map in the rider and driver apps
- **Geocoding API** — converts GPS coordinates to readable addresses

### Why Google Maps
- **Best coverage in Malaysia.** Google Maps has the most accurate, up-to-date road data, POIs, and addresses in Malaysia — critical for e-hailing.
- **Industry standard for e-hailing.** Grab, Bolt, and virtually every e-hailing platform globally uses Google Maps. The APIs are proven at scale.
- **Integrated ecosystem.** Places, Directions, Distance Matrix, and the Maps SDK are all under one billing account and one SDK — simpler to manage.
- **Driver navigation handoff.** The driver app deep-links to Google Maps or Waze for turn-by-turn navigation — both are Google products and deeply familiar to Malaysian drivers.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Mapbox** | Strong alternative with competitive pricing at scale. However, map data quality and POI accuracy in Malaysia is inferior to Google Maps. Higher integration risk for MVP. |
| **HERE Maps** | Enterprise-grade but less developer-friendly, higher cost, and less accurate in Southeast Asia. |
| **OpenStreetMap (OSM)** | Free but map data in Malaysia is incomplete and inconsistently maintained. Requires significant effort to self-host tiles. Not viable for a production app. |
| **Apple Maps (MapKit)** | iOS only — incompatible with a cross-platform React Native app. |

---

## 7. Payment Processing — Stripe + TNG + GrabPay + Google Pay

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

## 8. Authentication — Firebase Auth / Twilio Verify (Phone OTP)

### What it does
Authenticates riders and drivers via phone number + one-time password (OTP). The user enters their Malaysian phone number, receives an SMS code, and is verified.

### Why Phone OTP
- **Universally accessible.** Every Malaysian smartphone user has a phone number. No dependency on having a Google or Apple account.
- **Strong identity signal.** Phone numbers are tied to real SIM registrations in Malaysia (MCMC-regulated) — harder to fake than email addresses.
- **Industry norm for e-hailing.** Grab, Bolt, and inDriver all use phone OTP. Riders expect it.

### Firebase Auth vs Twilio Verify
Both are viable. **Firebase Auth** is preferred for MVP because:
- Free tier covers early-stage volume
- Deeply integrated with FCM (push notifications) — one SDK for both
- Simpler to set up

**Twilio Verify** is the fallback if Firebase Auth OTP delivery rates in Malaysia prove unreliable.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Google Sign-In / Social login** | Excludes users without a Google account. Phone OTP is more inclusive for the Malaysian target market. |
| **Email + Password** | Slower sign-up flow; email addresses are less reliable identity signals than phone numbers for this use case. |
| **Apple Sign-In** | iOS only — incompatible with Android-first Malaysian market. |

---

## 9. File Storage — AWS S3

### What it does
Stores all binary files uploaded to the platform:
- Driver document photos (IC, CDL, PSV-D licence, insurance, PUSPAKOM cert)
- Vehicle photos
- Driver and rider profile photos

### Why AWS S3
- **Industry standard object storage.** Reliable, scalable, and cost-effective. Pay only for what is stored.
- **Fine-grained access control.** Driver documents are sensitive personal data. S3 bucket policies and IAM roles ensure only authorised backend services can read documents — not the public.
- **Pre-signed URLs.** The admin panel can generate temporary, expiring URLs to view driver documents without exposing the underlying storage path — important for PDPA compliance.
- **Malaysia region available.** AWS has a Malaysia region (ap-southeast-1 in Singapore, ap-southeast-5 in Kuala Lumpur) — keeping data within the region for PDPA data residency requirements.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Google Cloud Storage** | Equally capable alternative. If GCP is chosen as the primary cloud provider, GCS is the natural equivalent. Decision depends on overall cloud provider choice. |
| **Firebase Storage** | Built on Google Cloud Storage but with a simpler API. Suitable for small projects; less control over access policies for sensitive documents. |
| **Storing files in PostgreSQL (binary)** | Storing large binary files in a relational database bloats storage, degrades query performance, and is not cost-effective. Never recommended for production. |
| **Self-hosted (MinIO)** | Adds operational overhead — managing storage infrastructure is not a core competency for Teeko. Managed cloud storage is more reliable and cheaper at this scale. |

---

## 10. Push Notifications — Firebase Cloud Messaging (FCM)

### What it does
Delivers push notifications to iOS and Android devices for both the rider and driver apps:
- Rider: driver matched, driver arrived, trip started, trip completed, ride cancelled
- Driver: new ride request, EVP approval, document expiry warning, suspension notice
- Both: broadcast notifications from admin

### Why FCM
- **Free.** FCM is entirely free with no volume limits — significant cost saving for a startup.
- **Cross-platform.** One integration handles both iOS (via APNs) and Android. React Native libraries (e.g. `@react-native-firebase/messaging`) make this seamless.
- **Reliable delivery.** Google's infrastructure ensures high delivery rates globally, including Malaysia.
- **Already a dependency.** Firebase Auth is already in the stack — FCM comes with the same Firebase SDK at no extra integration cost.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **OneSignal** | Solid managed alternative with a generous free tier. Adds an extra third-party vendor dependency when FCM is already available via Firebase. |
| **AWS SNS (Simple Notification Service)** | Capable but more complex to set up for mobile push than FCM. Better suited for server-to-server notifications. |
| **Pusher** | Better suited for in-app real-time UI updates (already handled by Socket.io). Not the standard choice for OS-level push notifications. |

---

## 11. Driver Verification — OCR + Liveness Check

### What it does
- **OCR (Optical Character Recognition)** — automatically reads text from uploaded driver documents (IC number, expiry dates, licence class) to pre-fill fields and flag mismatches before manual review
- **Liveness / Selfie Check** — confirms the person registering is physically present (not using a photo of someone else's face)

### Why this is needed
APAD requires drivers to hold valid PSV-D licences and registered vehicles. Teeko is legally responsible for verifying this before a driver goes live. Manual review alone is too slow at scale.

### Recommended options
- **AWS Rekognition** — liveness detection and facial comparison; integrates naturally if AWS is the cloud provider
- **Google Cloud Vision API** — OCR for document reading; integrates naturally if GCP is chosen
- **Jumio / Onfido** — specialist identity verification SaaS products with pre-built Malaysian IC support; higher cost but fastest to integrate for MVP

### Why not skipping this
Skipping automated verification means 100% manual document review for every driver — not scalable and a liability risk if fraudulent drivers slip through.

---

## 12. Email — AWS SES / SendGrid

### What it does
Sends transactional emails to riders and drivers:
- Trip receipts (post-trip)
- Account registration confirmation
- Payout notifications to drivers

### Why transactional email service
Sending email directly from the app server (SMTP) results in poor deliverability — emails land in spam. A dedicated email service manages deliverability, bounce handling, and unsubscribes.

### AWS SES vs SendGrid
- **AWS SES** — extremely low cost (USD 0.10 per 1,000 emails). Minimal setup if already on AWS. Less user-friendly for managing templates.
- **SendGrid** — better developer experience, pre-built email templates, analytics. Free tier covers early-stage volume.

Either works. **SendGrid** recommended for MVP speed; migrate to SES later if cost becomes a concern.

---

## 13. Admin Dashboard — React (Web)

### What it does
The internal web application used by Teeko's operations, support, and finance teams. Built as a standard web app — no mobile app required for admin.

### Why React
- **Same language as React Native.** The mobile team's JavaScript/React knowledge transfers directly to the admin panel — no separate frontend skillset needed.
- **Rich component ecosystem.** Libraries like Ant Design, MUI, or TanStack Table provide pre-built data tables, forms, and dashboards — significantly reducing build time for the admin panel.
- **SPA (Single Page Application).** React's SPA architecture makes data-heavy admin interfaces (live maps, large tables, real-time updates) responsive and fast.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Next.js** | Adds server-side rendering capability — useful for public-facing marketing sites, but unnecessary for an internal admin tool behind a login. Adds complexity without benefit here. |
| **Vue.js** | Capable framework but the team is already invested in React/React Native. No benefit in splitting the frontend into two frameworks. |
| **Angular** | Heavier framework, steeper learning curve. Overkill for an internal dashboard. |
| **No-code tools (Retool, AppSmith)** | Fast to prototype but lack the customisation needed for a live trip map, complex document review workflows, and real-time surge control. Technical debt accumulates quickly. |

---

## 14. Infrastructure & Hosting — AWS / GCP (Malaysia Region)

### What it does
Hosts all Teeko backend services, databases, file storage, and the admin panel.

### Why Malaysia / Southeast Asia region
**PDPA 2010 compliance.** Malaysia's Personal Data Protection Act requires that personal data of Malaysian users be handled with appropriate safeguards. Hosting in AWS `ap-southeast-5` (Kuala Lumpur) or GCP `asia-southeast1` (Singapore) keeps data within the region, simplifying PDPA compliance and reducing latency for Malaysian users.

### AWS vs GCP
Both are viable. Decision factors:
- **AWS** — broader service catalogue, more Malaysian developers familiar with it, S3 + SES + Rekognition available natively. Recommended if the team has AWS experience.
- **GCP** — natural fit if Google Maps and Firebase are heavily used (same billing account). Google Cloud Run simplifies container deployment.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **Azure** | Strong enterprise offering but less commonly used by Malaysian startups. Smaller local developer community for support. |
| **DigitalOcean / Linode** | Cost-effective for simple workloads but lacks the managed services (RDS, ElastiCache, Rekognition) that accelerate development. No Malaysia/Singapore region on DigitalOcean. |
| **Self-hosted (on-premise)** | Requires significant infrastructure investment and ops expertise. Not appropriate for a startup MVP. |

---

## 15. CI/CD — GitHub Actions

### What it does
Automates the build, test, and deployment pipeline:
- Runs automated tests on every pull request
- Builds and deploys the backend API when code is merged to main
- Builds React Native app bundles for TestFlight (iOS) and Play Store (Android) testing

### Why GitHub Actions
- **Already on GitHub.** The repo is hosted at GitHub (Blueprint-Agency/teeko-ehailing). GitHub Actions is built-in — no separate CI tool to set up or pay for.
- **Free for public repos; generous free tier for private.** No additional cost for a startup.
- **Large marketplace.** Pre-built actions for Node.js, React Native, AWS/GCP deployment, and app store distribution.

### Why not the alternatives

| Alternative | Why Not |
|-------------|---------|
| **CircleCI** | Capable but adds cost and a separate platform to manage. No advantage over GitHub Actions for this stack. |
| **Jenkins** | Self-hosted, requires dedicated infrastructure to maintain. Overkill for a startup. |
| **Bitbucket Pipelines** | Tied to Bitbucket — the repo is on GitHub. |

---

## Stack Summary

| Layer | Chosen Technology | Key Reason |
|-------|------------------|------------|
| Mobile apps | React Native | One codebase, iOS + Android, large talent pool |
| Backend API | Node.js (Express/Fastify) | JavaScript end-to-end, event-driven, npm ecosystem |
| Real-time | Socket.io (WebSockets) | Live location tracking, low latency |
| Primary database | PostgreSQL | Relational, ACID-compliant, PDPA-ready |
| Cache / sessions | Redis | In-memory speed for location + sessions |
| Maps | Google Maps Platform | Best Malaysia coverage, industry standard |
| Card payments | Stripe | Global standard, PCI DSS, MYR support |
| E-wallets | TNG + GrabPay + Google Pay | Malaysian market coverage |
| Auth | Firebase Auth (Phone OTP) | Free, cross-platform, phone-first |
| File storage | AWS S3 | Scalable, access-controlled, Malaysia region |
| Push notifications | Firebase FCM | Free, cross-platform, already in Firebase SDK |
| Driver verification | AWS Rekognition / Jumio | Liveness + OCR for APAD compliance |
| Email | SendGrid (migrate to SES) | Deliverability, free tier for MVP |
| Admin panel | React (web) | Shared language with mobile team |
| Hosting | AWS / GCP (MY region) | PDPA data residency, managed services |
| CI/CD | GitHub Actions | Built into existing GitHub repo, free tier |

---

*This document should be reviewed when the team scales beyond MVP. Technology choices at startup scale may not be optimal at 10× or 100× load.*

*Drafted 2026-04-08.*
