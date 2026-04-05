# Teeko — Driver-Partner App: Product Requirements Document

> **Version:** 1.0
> **Date:** 2026-04-03
> **Status:** Draft

---

## 1. Overview

This document defines the product requirements for the **Teeko Driver-Partner App** — the iOS and Android application used by driver-partners to register, manage their vehicle, receive trips, and track earnings on the Teeko e-hailing platform.

This PRD covers the driver perspective exclusively. For rider-side requirements, refer to `teeko-ux-prd.md`.

---

## 2. Driver Persona

| Attribute | Description |
|-----------|-------------|
| **Who** | Malaysian citizens seeking supplemental or full-time income through e-hailing driving |
| **Motivation** | Lower platform commission vs. Grab; flexible working hours |
| **Operating region** | West Malaysia (regulated by APAD) and East Malaysia (regulated by LPKP) |
| **Device usage** | Android and iOS smartphones; app used actively while driving — UI must be glanceable and safe |

---

## 3. Eligibility Requirements

Only Malaysian citizens are eligible to register as Teeko driver-partners. The following conditions must be met before a driver can go live:

### 3.1 Driver Requirements
| Document | Notes |
|----------|-------|
| Valid NRIC / MyKad | Malaysian citizens only |
| Competent Driving Licence (CDL) | Valid Malaysian driving licence |
| PSV-D Licence (E-hailing Licence) | Must be valid at time of registration |
| Clear profile photo | Liveness/selfie check required |
| E-hailing Insurance Cover Note | Must be valid; renewed yearly |

### 3.2 Vehicle Requirements
Each vehicle registered under a driver account must have the following documents:

| Document | Notes |
|----------|-------|
| Car Grant / VOC | Proof of vehicle ownership |
| Valid Road Tax | Must be renewed yearly |
| E-hailing Insurance Cover Note | Per vehicle; renewed yearly |
| PUSPAKOM Inspection Certificate | Required for all registered vehicles |

**Vehicle age restriction:** Only vehicles manufactured within the last 15 years are accepted. Vehicles older than 15 years will be rejected during document review.

---

## 4. Driver Onboarding Flow

### 4.1 Registration Steps
```
Download App → Create Account (phone OTP) → Accept Driver Agreement (T&C)
→ Submit Personal Documents → Submit Vehicle Documents
→ Admin Document Review (1–3 working days)
→ EVP Application submitted by Teeko to APAD/LPKP (5–7 working days)
→ EVP Approved → Driver Account Activated → Driver Can Go Online
```

### 4.2 Document Review
- All submitted documents are reviewed **manually by admin**.
- Expected turnaround: **1–3 working days** for document approval.
- Driver is notified in-app at each stage (submitted, under review, approved/rejected).
- If rejected, the driver is shown the reason and can resubmit.

### 4.3 E-hailing Vehicle Permit (EVP)
- Once documents are approved, Teeko submits the EVP application on behalf of the driver to:
  - **APAD** — West Malaysia
  - **LPKP** — East Malaysia
- Expected EVP approval: **5–7 working days**.
- Driver is notified in-app when EVP is approved.
- **Both document approval AND EVP approval are required** before a driver can go online.
- Teeko handles **yearly EVP renewal** automatically and notifies the driver via in-app notification when renewal is processed.

### 4.4 Driver Agreement
- Drivers must read and accept Teeko's Terms & Conditions and Driver Agreement during onboarding before proceeding to document submission.

### 4.5 Multiple Vehicles
- A driver may register **multiple vehicles** under one account.
- Only **one vehicle can be set as Active** at any time.
- Each registered vehicle must have its own complete set of documents (Road Tax, Car Grant/VOC, E-hailing Insurance, PUSPAKOM Certificate).
- To change active vehicle, the driver must:
  1. Disable the current vehicle's EVP (temporarily or permanently)
  2. Apply for a new EVP for the replacement vehicle via support
- Vehicle changes are handled through the **support channel**, not self-served in-app.

---

## 5. Going Online

### 5.1 Online/Offline Toggle
- Driver can toggle between **Online** and **Offline** status from the app home screen.
- Driver **cannot go online** unless:
  - All documents are approved and valid
  - EVP is approved and active
  - No active suspension on the account

### 5.2 Fraud Prevention — Offline Trips
- Taking a trip while in **Offline** status is considered **fraudulent activity**.
- This will result in **temporary or permanent account suspension**.
- All trips must be conducted through the platform while the driver is in Online status.

### 5.3 Document Expiry Lockout
- When a driver's document (Road Tax, Insurance, PSV Licence, EVP) is nearing expiry, the driver receives an **in-app notification** to renew.
- If a document **expires**, the driver is **locked from going online** until the renewed document is uploaded and approved.

---

## 6. Ride Request Flow

### 6.1 Incoming Request Card
When a ride request is sent to a driver, the following information is displayed:

| Field | Description |
|-------|-------------|
| Pickup location | Address and map pin of rider's pickup point |
| Estimated pickup time | ETA from driver's current location to pickup |
| Trip distance | Total distance of the trip |
| Trip duration | Estimated trip time |
| Rider's destination | Full destination address |
| Fixed fare | Upfront fixed price for the trip |
| Rider rating | Rider's overall star rating |
| Ride category | Standard / Comfort / XL / Premium |
| Outside radius warning | Shown if pickup is outside the driver's set operating radius |

### 6.2 Accept / Decline
- Driver has **15–20 seconds** to respond to a request.
- No response within the timeout is treated as a **Decline**.
- Declining a request **outside the driver's set radius** does **not impact** the driver's acceptance rate score.
- Repeatedly declining requests **within radius** will lower the driver's acceptance rate and may lead to **account suspension**.

### 6.3 Operating Radius
- Drivers can set a preferred operating radius/zone.
- This setting can be changed by the driver at any time from within the app.

---

## 7. Trip Flow

### 7.1 Trip Status Progression
```
Online → Receive Request → Accept → Navigate to Pickup (Google Maps / Waze)
→ Arrived at Pickup → Rider Confirmed → Trip Started
→ Navigate to Destination (Google Maps / Waze)
→ Trip Completed → Fare Credited to Earnings Balance
```

### 7.2 Navigation
- The driver app **hands off navigation** to an external app — **Google Maps** or **Waze** (driver's choice).
- No in-app navigation is built into the driver app.

### 7.3 Fare Structure
- **Upfront fixed pricing**: The fare shown on the request card is the fare the driver earns (minus commission), subject to the adjustments below.
- **Variable adjustments**: The final fare may vary if the actual route or duration changes significantly due to traffic or rider-requested stops.
- **Fixed-route fares**: Specific high-traffic corridors (e.g. KLIA/KLIA2, Genting Highlands) have standardised fixed rates.

### 7.4 Driver Cancellation
- Drivers may cancel an accepted trip, but **repeated cancellations** will result in **temporary or permanent account suspension**.
- No explicit penalty-free cancellation conditions are defined — all cancellations are tracked.

### 7.5 Rider No-Show
- After arriving at the pickup point, the driver must **wait 10 minutes** before cancelling penalty-free.
- After 10 minutes, the driver may cancel and a **no-show fee is charged to the rider** and credited to the driver.

---

## 8. Ride Categories

| Category | Description |
|----------|-------------|
| **Teeko Go (Standard)** | Economy car |
| **Teeko Comfort** | Newer or higher-comfort vehicle |
| **Teeko XL** | Larger vehicle (MPV/SUV) for groups |
| **Teeko Premium** | Premium/luxury vehicle class |
| **Teeko Bike** | Motorbike taxi (short, fast trips) |

Drivers are matched to ride categories based on their registered vehicle type.

---

## 9. Earnings & Payouts

### 9.1 Commission
| Parameter | Value |
|-----------|-------|
| Standard commission rate | 15% per completed trip | the commission rate can be adjusted from admin panel
| Promotional rate (new drivers / launch period) | 10% | the commission rate can be adjusted from admin panel
| Commission on tolls | Not applied |
| Commission on KLIA2 airport fees | Not applied |
| Commission on rider tips | Not applied |

### 9.2 Payout Schedule
| Method | Details |
|--------|---------|
| Standard payout | Weekly (Monday–Sunday cycle), paid out in the first half of the following week |
| Early Cashout | Available once per day; requires minimum 25 completed trips to be eligible |
| Payment method | Direct bank transfer to a linked Malaysian bank account |

### 9.3 Earnings Dashboard
The driver earnings dashboard displays:
- Today's earnings
- Weekly earnings summary
- Trip history with per-trip fare breakdown
- Commission deducted per trip
- Bonuses and incentives earned
- Early cashout option and eligibility status

### 9.4 Surge Pricing
- Surge zones and multipliers are visible on the driver's map and on the request card.
- Commission (15%) is applied to the **full surged fare** before crediting the driver's balance.

### 9.5 Tips
- Riders can tip drivers in-app after a completed trip.
- Tips are credited to the driver in full — **no commission is deducted** on tips.

---

## 10. Incentives & Bonuses

| Programme | Details |
|-----------|---------|
| **Activation Bonus** | New drivers earn RM 200 for completing 30 rides within the first 60 days |
| **Referral Programme** | Bonuses awarded when a referred driver meets specific trip requirements |
| **Daily / Weekly Campaigns** | Incentives for hitting trip targets or driving during peak/high-demand hours |

---

## 11. Advance Bookings

- When a rider schedules a trip in advance, the request is offered to drivers **closer to the scheduled pickup time**.
- The request card displays the same information as a standard request, with the addition of the scheduled pickup date and time.
- Fixed upfront fare is locked in at the time of the rider's booking.

---

## 12. Ratings & Feedback

### 12.1 Driver Rating
- Riders rate drivers (1–5 stars) after each completed trip.
- Drivers can view their overall rating and individual rider comments in the app.
- **Minimum rating threshold:** Drivers who fall below **4.5 stars** are flagged for review and may be suspended (mirrors Bolt's policy).

### 12.2 Rider Reporting
- Drivers can report riders for bad behaviour (e.g. no-show, rude behaviour, damage to vehicle).
- Teeko actions against reported riders follow a progressive escalation:
  1. Warning
  2. Temporary ban
  3. Permanent deactivation

---

## 13. Safety

### 13.1 Driver SOS Button
- The driver app includes an **SOS emergency button**.
- Activating SOS alerts the driver's emergency contacts and optionally dials emergency services.

### 13.2 Rider Verification
- Driver can see the rider's profile photo, name, and rating before and during the trip.
- Driver and vehicle details are visible to the rider in the same way.

---

## 14. Account Management & Compliance

### 14.1 Suspension & Deactivation

| Trigger | Outcome |
|---------|---------|
| Low acceptance rate (within radius) | Warning → Temporary suspension |
| Repeated trip cancellations after acceptance | Temporary or permanent suspension |
| Fraudulent offline trip detected | Temporary or permanent suspension |
| Rider with criminal record found in background check | Permanent deactivation |
| Serious rider complaint | Review → Permanent deactivation |
| Consistently low rating (below threshold) | Review → Suspension or deactivation |

### 14.2 Suspension Notification & Appeal
- Drivers are notified **in-app** with a reason when their account is suspended.
- Drivers can **appeal** by submitting a form through the in-app support channel.
- Appeal outcome is communicated in-app.

### 14.3 PDPA — Right to Erasure
- Drivers can submit a request to **delete their account and all associated personal data** in compliance with PDPA 2010.
- This request is handled through the support channel.

---

## 15. Support

| Channel | Availability |
|---------|-------------|
| In-app chat | 24/7 |
| In-app support form (appeals, EVP changes, deactivation requests) | 24/7 submission; response within working hours |

---

## 16. Driver App UI Requirements

| Requirement | Details |
|-------------|---------|
| **Language support** | English, Bahasa Malaysia, Mandarin (Simplified), Tamil |
| **Dark mode** | Supported — important for night driving |
| **Large text / glanceable UI** | Ride request card and trip status must be readable at a glance while stationary |
| **Accessibility** | Follow platform accessibility standards (iOS/Android) |

---

## 17. Driver App — Screen Inventory

| Screen | Description |
|--------|-------------|
| Registration & Document Upload | Multi-step onboarding with document photo upload per driver and per vehicle |
| Driver Agreement | Full T&C acceptance screen |
| Home / Map | Online/offline toggle, live map, surge zone overlay, operating radius indicator |
| Ride Request Card | Incoming request with accept/decline and countdown timer |
| Trip Active Screen | Current trip status, rider info, handoff button to Google Maps / Waze |
| Earnings Dashboard | Today, weekly summary, trip history, early cashout |
| Incentives | Active campaigns and bonus progress |
| Vehicle Management | List of registered vehicles, active vehicle indicator, document status per vehicle |
| Profile | Personal info, documents, rating, language preference |
| Support | In-app chat, appeal form, EVP/vehicle change requests |
| Notifications | EVP renewal, document expiry alerts, suspension notices, incentive updates |

---

## 18. Compliance Notes

| Requirement | Implementation |
|-------------|---------------|
| EVP mandatory before driving | App enforces this — driver cannot go online without approved EVP |
| PSV-D licence validity | Tracked in driver profile; expiry triggers lockout |
| APAD/LPKP submission | Teeko submits EVP applications on behalf of drivers; region determined by driver's operating city |
| Offline trip prohibition | Platform detects and flags offline trips; enforced via account suspension policy |
| PDPA 2010 | Driver data collected only with consent; right-to-erasure supported via support request |
| Trip insurance | Each trip covered by passenger accident insurance (PA); Teeko responsible as operator |

---

## 19. Open Questions

1. What is the exact no-show fee amount charged to riders (and credited to drivers)?
2. Is early cashout free or does it carry a transaction fee?
3. What are the specific vehicle categories (make/model) accepted for each ride type (Standard, Comfort, XL, Premium)?
4. Is there a maximum number of vehicles a driver can register under one account?
5. What is the appeal review turnaround time for suspended accounts?
6. Will the driver app support biometric login (Face ID / fingerprint) for faster access?

---

*This PRD was drafted based on a driver-focused product interview session on 2026-04-03.*
