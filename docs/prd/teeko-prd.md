# Teeko — Product Requirements Document (PRD)

> **Version:** 1.0
> **Date:** 2026-03-31
> **Status:** Draft

---

## 1. Executive Summary

Teeko is a Malaysian e-hailing mobile application targeting local Malaysians across all major cities. It competes directly with Grab, Bolt, and inDriver by offering **lower fares** for riders through a leaner commission model — benefiting both everyday commuters and driver-partners. The MVP is scoped to be feature-complete (minus final compliance documentation) and is targeted to support the APAD/JPJ e-hailing operator licence application.

---

## 2. Problem Statement

Existing e-hailing platforms in Malaysia (Grab, inDriver, Bolt) charge riders high fares and take significant commissions from drivers (20–25%). This creates:
- **Rider dissatisfaction** due to high and unpredictable pricing.
- **Driver dissatisfaction** due to high platform cuts reducing their take-home income.
- A gap in the market for a fairer, lower-cost alternative that still provides a polished user experience.

---

## 3. Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Establish Teeko as a low-cost alternative | Average fare 15–20% lower than Grab for equivalent trips |
| Attract driver supply | 500+ active registered drivers within 3 months of launch |
| Rider adoption | 10,000+ registered riders within 3 months of launch |
| Reliability | Trip completion rate ≥ 90% |
| Compliance readiness | Submission of APAD/JPJ licence application post-MVP |

---

## 4. Target Audience

### Primary Users
| Persona | Description |
|---------|-------------|
| **Riders** | Local Malaysians aged 18–45, urban commuters in major cities seeking affordable, reliable transport |
| **Driver-Partners** | Malaysians seeking supplemental or full-time income through driving; attracted by lower commission rates vs competitors |

### Secondary Users
| Persona | Description |
|---------|-------------|
| **Tourists** | Visitors to Malaysia needing local transport (supported via multi-language UI) |

---

## 5. Geographic Scope

**Phase 1 Launch Cities:**
- Klang Valley (Kuala Lumpur, Petaling Jaya, Shah Alam, Subang Jaya)
- Penang (George Town)
- Johor Bahru
- Kota Kinabalu

---

## 6. Core Features

### 6.1 Rider App (iOS & Android)

#### Ride Booking
- Enter pickup and drop-off location (map pin or text search via Google Maps / Mapbox)
- View estimated fare before confirming booking
- Select ride type:
  - **Teeko Go** — Standard economy car
  - **Teeko XL** — Premium / larger vehicle
  - **Teeko Bike** — Motorbike taxi (for short, fast trips)
- Real-time driver matching with ETA display
- Live trip tracking on map
- In-app chat and call with driver

#### Pre-Schedule / Advance Booking
- Schedule a ride up to 7 days in advance
- Select date, time, pickup, and destination
- Fare estimate shown at time of booking (locked-in price)
- Driver assigned closer to the scheduled pickup time
- Reminder push notification sent 30 minutes before scheduled ride
- Rider can cancel/edit up to 15 minutes before the scheduled time

#### Payments
- Credit/Debit card (Visa, Mastercard)
- E-wallets: Touch 'n Go eWallet, GrabPay
- Receipts sent via email/in-app

#### Safety
- **SOS button** — alerts emergency contacts and optionally dials 999
- **Trip sharing** — share live trip link with up to 3 contacts
- Driver and vehicle info visible before and during trip
- End-trip safety check prompt

#### Ratings & Reviews
- Rate driver (1–5 stars) and leave a comment after each trip
- View driver's overall rating before accepting a match

#### Account & Profile
- Sign up / login via phone number (OTP)
- Profile: name, photo, preferred language
- Ride history with receipts
- Saved addresses (Home, Work, Favourites)

---

### 6.2 Driver-Partner App (iOS & Android)

#### Onboarding & Verification
- Register with: IC (MyKad), driving licence, vehicle registration card (JPJ), vehicle insurance
- Selfie verification (liveness check)
- Background check consent form
- Vehicle photo upload

#### Trip Management
- Go online / offline toggle
- Receive ride requests with pickup details and estimated earnings
- Accept or decline within timeout window
- Navigation to pickup and destination (Google Maps integration)
- Trip status flow: En Route → Arrived → Trip Started → Completed

#### Earnings & Payouts
- Real-time earnings dashboard
- Weekly payout to registered bank account
- Commission deducted automatically per trip (rate TBD by business team)
- Surge pricing indicator — show driver when surge is active in their area

#### Ratings & Feedback
- View rider rating and comments
- Report issues with a trip

---

### 6.3 Admin / Ops Dashboard (Web)

- Driver approval / rejection workflow
- Rider and driver account management
- Trip monitoring (live map, trip status)
- Surge pricing control (manual override + automated rules)
- Dispute resolution and refund management
- Revenue and commission reporting
- PDPA-compliant data export tools

---

## 7. Business Model

| Revenue Stream | Description |
|----------------|-------------|
| **Commission per trip** | Platform takes a % of each completed fare (rate to be confirmed by business team; targeting below 20% to compete on driver value) |
| **Surge pricing** | Dynamic fare multiplier during peak hours or high-demand zones; revenue proportional |

---

## 8. Pricing & Competitive Positioning

- **Teeko's fares will be 15–20% lower** than Grab for comparable trips, achieved via:
  - Lower commission rate
  - Lean operational model (no physical hubs)
- Surge pricing will be transparent and capped (max multiplier to be defined, e.g. 1.5x)

---

## 9. Multi-Language Support

| Language | Locale |
|----------|--------|
| English | `en` |
| Bahasa Malaysia | `ms` |
| Mandarin (Simplified) | `zh-Hans` |
| Tamil | `ta` |

All UI strings, notifications, and customer support to be localised in all four languages.

---

## 10. Safety & Trust

| Feature | Details |
|---------|---------|
| IC / Licence Verification | Document upload + OCR validation + manual review for all drivers |
| SOS Button | In-trip emergency button; alerts 3 saved contacts + optional 999 dial |
| Trip Sharing | Shareable live-tracking link (no app install needed for recipient) |
| Driver Ratings | Minimum rating threshold enforced (e.g. drivers below 3.5 stars reviewed/suspended) |
| Insurance | Passenger accident coverage per trip (to comply with APAD requirements) |

---

## 11. Compliance & Regulatory Requirements

> **Critical:** The MVP must be structured to support the APAD/JPJ e-hailing licence application. Compliance documentation is out of scope for the 1-month build but the system must be architected to satisfy all technical requirements.

| Requirement | Details |
|-------------|---------|
| **APAD/JPJ E-Hailing Licence** | Teeko must register as a licensed e-hailing operator under the Land Public Transport Act 2010. Driver-partners must hold PSV licences. |
| **PDPA 2010 Compliance** | Personal data collection, storage, and processing must comply with Malaysia's Personal Data Protection Act. Consent flows, data retention policies, and right-to-erasure must be implemented. |
| **Trip Insurance** | Each trip must be covered by passenger accident insurance (PA). Teeko must partner with a licensed Malaysian insurer. |
| **Data Residency** | Consideration for storing Malaysian user data on local or regionally-compliant infrastructure. |

---

## 12. Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile (Rider & Driver apps) | React Native (iOS + Android) |
| Backend API | Node.js (Express or Fastify) |
| Real-time | WebSockets / Socket.io (driver location, ride status) |
| Database | PostgreSQL (relational data) + Redis (sessions, live location cache) |
| Maps & Navigation | Google Maps Platform (Places API, Directions API, Distance Matrix) |
| Payments | Stripe (card) + Touch 'n Go / GrabPay SDKs |
| Auth | Phone OTP (Firebase Auth or Twilio Verify) |
| File Storage | AWS S3 or equivalent (driver documents, photos) |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Admin Dashboard | React (web) |
| CI/CD | GitHub Actions |
| Hosting | AWS / GCP (Malaysia region preferred for PDPA) |

---

## 13. MVP Scope (Target: 1 Month)

> **Note:** A 1-month timeline for a full-featured e-hailing app is extremely aggressive. The team must prioritise ruthlessly. The recommendation is a focused sprint with parallel tracks.

### In Scope for MVP
- Rider app: Booking flow, ride types, advance booking, live tracking, payments (card + e-wallet), SOS, trip sharing, ratings
- Driver app: Onboarding/verification, trip acceptance, navigation, earnings dashboard
- Admin dashboard: Driver approval, trip monitoring, surge control
- 4-language support
- PDPA-aligned data handling (consent, encryption)

### Out of Scope for MVP (Post-Launch)
- APAD/JPJ compliance documentation submission (MVP builds the system; licence application follows)
- Carpool / ride-sharing
- Corporate accounts (B2B)
- Loyalty / rewards programme
- In-app wallet top-up via ATM or FPX bank transfer
- Advanced analytics dashboard

---

## 14. User Flow Overview

### Rider Booking Flow
```
Open App → Enter Destination → Select Ride Type → View Fare Estimate
→ Confirm Booking → Driver Matched (ETA shown) → Live Track Driver
→ Trip in Progress → Trip Completed → Rate Driver → Receipt
```

### Driver Trip Flow
```
Go Online → Receive Request (accept/decline) → Navigate to Rider
→ Confirm Pickup → Trip Started → Navigate to Destination
→ Trip Completed → Fare Credited to Earnings
```

---

## 15. Risk & Mitigations

| Risk | Mitigation |
|------|-----------|
| 1-month timeline too aggressive | Prioritise core booking + payment loop first; safety & ratings can be simplified at launch |
| Driver supply at launch | Pre-registration campaign before launch; onboarding incentives |
| APAD licence delays | MVP operates in limited beta/pilot mode; full public launch after licence approval |
| Payment gateway integration time | Start Stripe + TNG integration in Week 1 in parallel |
| Fraud / fake drivers | Document verification + manual review; block accounts on red flags |

---

## 16. Out of Scope (All Phases)

- Delivery / logistics (food, parcels)
- Rental / hourly booking
- Intercity travel
- Driver vehicle financing

---

## 17. Phase 2 Features (Post-MVP)

These features are deferred to Phase 2 and should not be built in the initial 1-month sprint.

| Feature | Description |
|---------|-------------|
| **Teeko Wallet** | In-app balance that riders can top up via card or e-wallet and use to pay for rides. Requires additional financial compliance (Bank Negara guidelines on e-money). |
| **Carpool / Ride-sharing** | Shared rides to reduce fares further |
| **Corporate accounts (B2B)** | Company billing, employee ride management |
| **Loyalty / rewards programme** | Points, vouchers, referral rewards |
| **FPX / ATM wallet top-up** | Additional top-up methods for Teeko Wallet |
| **Advanced analytics dashboard** | Detailed reporting for ops and finance teams |

---

## 18. Open Questions

1. What is the confirmed commission rate? This affects driver messaging and revenue projections.
2. Who is the insurance partner for trip PA coverage?
3. Will APAD licence be applied under a company entity already incorporated?
4. What is the minimum viable driver count per city before going live?
5. Is there a customer support channel at launch (in-app chat, email, WhatsApp)?

---

*This PRD was drafted based on the Teeko product interview session on 2026-03-31.*
