# Teeko — Admin Panel: Product Requirements Document

> **Version:** 1.0
> **Date:** 2026-04-04
> **Status:** Draft
> **Scope:** Web-based admin and operations dashboard

---

## 1. Overview

This document defines the product requirements for the **Teeko Admin Panel** — the internal web application used by Teeko operations, support, and finance teams to manage the entire platform. The admin panel provides oversight and control over all rider, driver, and trip activity on the Teeko platform.

Built with React (web). Accessible by authorised Teeko staff only.

---

## 2. Admin Roles & Permissions

| Role | Description | Access Level |
|------|-------------|--------------|
| **Super Admin** | Full access to all modules, settings, and configurations | All |
| **Operations** | Driver onboarding, EVP submissions, trip monitoring, surge control | Driver management, trips, surge |
| **Support** | Handle disputes, refunds, appeals, rider/driver account issues | Rider/driver accounts, disputes, support tickets |
| **Finance** | Commission configuration, payout management, revenue reporting | Earnings, payouts, commissions, reports |

---

## 3. Dashboard Overview

The landing page after login. Provides a real-time snapshot of platform health.

### Key Metrics (Live)
- Active trips (currently in progress)
- Drivers online
- Riders with active bookings
- Trips completed today
- Trips cancelled today
- Average trip completion rate (%)

### Alerts Panel
- Drivers with expiring documents (within 30 days)
- Pending driver document reviews
- Pending EVP applications
- Open disputes awaiting resolution
- Accounts flagged for review (low rating, fraud signals)

---

## 4. Driver Management

### 4.1 Driver List
- View all registered driver accounts
- Filter by: status (pending, active, suspended, deactivated), city, ride category, EVP status
- Search by name, phone number, IC number, plate number

### 4.2 Driver Profile View
Full driver profile showing:
- Personal details (name, IC, phone, photo)
- Documents: IC, CDL, PSV-D licence, e-hailing insurance — with expiry dates and approval status
- Vehicle(s): plate number, make/model, year, road tax, car grant, PUSPAKOM cert, e-hailing insurance
- Active vehicle indicator
- EVP status (pending / approved / expired) per vehicle
- Account status (active / suspended / deactivated)
- Trip history summary (total trips, completion rate, cancellation rate, acceptance rate)
- Ratings overview (average rating, total ratings)
- Earnings summary (total earned, total commission deducted)
- Suspension/deactivation history with reasons

### 4.3 Document Review Workflow
```
Driver submits documents → Appears in "Pending Review" queue
→ Admin opens driver profile → Reviews each document
→ Approve all → Trigger EVP application
   OR
→ Reject with reason → Driver notified in-app to resubmit
```

- Expected turnaround: **1–3 working days**
- Admin can approve or reject individual documents
- Rejection requires a reason (shown to driver in-app)
- Once all documents approved, admin submits EVP application to APAD (West Malaysia) or LPKP (East Malaysia)

### 4.4 EVP Management
- Track EVP application status per driver per vehicle: submitted / pending / approved / rejected
- Record EVP approval date and expiry date
- Trigger **yearly EVP renewal** — admin submits renewal on behalf of driver
- Driver notified in-app when EVP is approved or renewed
- Admin can manually override EVP status if needed (Super Admin only)

### 4.5 Driver Account Actions
All account actions are logged with timestamp, admin user, and reason.

| Action | Who Can Perform | Notes |
|--------|----------------|-------|
| Approve documents | Operations, Super Admin | Triggers EVP submission |
| Reject documents | Operations, Super Admin | Requires reason |
| Activate account | Operations, Super Admin | After EVP approved |
| Suspend account (temporary) | Operations, Support, Super Admin | Requires reason; driver notified in-app |
| Deactivate account (permanent) | Super Admin | Requires reason; driver notified in-app |
| Override EVP status | Super Admin only | For manual corrections |
| Adjust commission rate | Finance, Super Admin | Per-driver override of standard rate |

### 4.6 Suspension & Appeal Handling

| Trigger | Default Action |
|---------|---------------|
| Low acceptance rate (within radius) | Warning → Temporary suspension |
| Repeated trip cancellations after acceptance | Temporary or permanent suspension |
| Fraudulent offline trip detected | Temporary or permanent suspension |
| Criminal record found in background check | Permanent deactivation |
| Serious rider complaint | Review → Permanent deactivation |
| Consistently low rating (below 4.5 stars) | Review → Suspension or deactivation |

- Suspended drivers can submit an appeal via in-app support form
- Appeal appears in admin **Appeals Queue**
- Admin reviews appeal → approves (lifts suspension) or rejects (maintains suspension)
- Outcome communicated to driver in-app

---

## 5. Rider Management

### 5.1 Rider List
- View all registered rider accounts
- Filter by: status (active, banned), city, registration date
- Search by name, phone number

### 5.2 Rider Profile View
- Personal details (name, phone, email, photo)
- Account status (active / temporarily banned / permanently banned)
- Ride history (total trips, cancellations, no-shows)
- Rating (average rating given by drivers)
- Payment methods on file
- Dispute and refund history
- Reports filed against this rider by drivers

### 5.3 Rider Account Actions

| Action | Who Can Perform | Notes |
|--------|----------------|-------|
| Issue warning | Support, Super Admin | Logged; rider notified in-app |
| Temporary ban | Support, Super Admin | Duration set by admin; rider notified in-app |
| Permanent ban | Super Admin | Requires reason; rider notified in-app |
| Lift ban | Support, Super Admin | With reason |
| Issue refund | Support, Finance, Super Admin | Linked to a specific trip |

### 5.4 Rider Progressive Escalation (Driver Reports)

| Step | Action |
|------|--------|
| 1st report | Warning issued |
| 2nd report | Temporary ban |
| 3rd report | Permanent deactivation |

Admin can override escalation step at their discretion.

---

## 6. Trip Management

### 6.1 Live Trip Monitor
- Real-time map showing all active trips
- Each trip shows: driver location, pickup point, destination, ride category, elapsed time
- Click a trip pin to view full trip details
- Filter by city, ride category, trip status

### 6.2 Trip History
- Search and filter all completed, cancelled, and ongoing trips
- Filter by: date range, city, driver, rider, ride category, status, payment method
- Export trip data (CSV) — PDPA-compliant

### 6.3 Trip Detail View
| Field | Details |
|-------|---------|
| Trip ID | Unique identifier |
| Rider | Name, phone, link to rider profile |
| Driver | Name, phone, vehicle, link to driver profile |
| Ride category | Go / Comfort / XL / Premium / Bike |
| Status | Completed / Cancelled / In Progress |
| Pickup address | — |
| Destination address | — |
| Trip start time | — |
| Trip end time | — |
| Distance | km |
| Duration | minutes |
| Fare | Total fare (RM) |
| Surge multiplier | If surge was active |
| Commission deducted | RM amount |
| Payment method | Card / TNG / GrabPay / Google Pay |
| Cancellation reason | If cancelled |
| SOS triggered | Yes / No |

### 6.4 Dispute Resolution
- Disputes raised by riders or drivers appear in **Disputes Queue**
- Each dispute shows: trip details, issue description, supporting evidence (if any)
- Admin can: approve refund, reject dispute, escalate for review
- Resolution communicated to both parties via in-app notification

### 6.5 Refund Management
- Refunds are linked to a specific trip
- Admin selects refund amount (partial or full)
- Refund is processed back to the original payment method
- Refund history is logged per rider and per trip

---

## 7. Surge Pricing Control

### 7.1 Surge Overview
- Live map showing current surge zones with active multipliers
- Surge history log (when zones were active, multiplier applied, triggered by rule or manually)

### 7.2 Automated Surge Rules
Admin can configure rules that automatically trigger surge:

| Parameter | Description |
|-----------|-------------|
| Demand threshold | Trigger surge when demand exceeds X requests per zone per minute |
| Supply threshold | Trigger surge when fewer than X drivers are online in a zone |
| Time-based rules | Pre-schedule surge for known peak periods (e.g. rush hour, public holidays) |
| Multiplier | Set the surge multiplier (e.g. 1.2x, 1.5x) |
| Cap | Maximum multiplier enforced platform-wide (e.g. 1.5x) |

### 7.3 Manual Surge Override
- Admin can manually activate or deactivate surge for any zone at any time
- Manual override takes precedence over automated rules
- Override is logged with timestamp and admin user

---

## 8. Commission & Earnings Management

### 8.1 Commission Configuration
- Set platform-wide standard commission rate (default: 15%)
- Set promotional commission rate for new drivers / launch period (default: 10%)
- Override commission rate for individual drivers (e.g. loyalty, dispute resolution)
- All changes are logged with timestamp and admin user

### 8.2 Commission Rules
| Rule | Setting |
|------|---------|
| Commission on base fare | Applied (configurable %) |
| Commission on surged fare | Applied to full surged amount |
| Commission on tolls | Not applied |
| Commission on airport fees (KLIA/KLIA2) | Not applied |
| Commission on tips | Not applied |

### 8.3 Payout Management
- View all pending and processed payouts
- Weekly payout cycle: Monday–Sunday, paid out first half of following week
- Early cashout requests: flag for processing (once per driver per day; minimum 25 trips)
- Manual payout trigger (Super Admin / Finance only) for edge cases
- Payout status: pending / processed / failed
- Failed payouts are flagged for manual resolution

### 8.4 Incentives & Bonus Management
| Programme | Admin Controls |
|-----------|---------------|
| Activation Bonus | Configure trip target (default: 30 trips) and bonus amount (default: RM 200) and eligibility window (default: 60 days) |
| Referral Programme | Configure referral bonus amounts and qualifying trip thresholds |
| Daily / Weekly Campaigns | Create, edit, and deactivate campaigns; set trip targets, time windows, and payout amounts |

---

## 9. Revenue & Reporting

### 9.1 Revenue Summary
- Total revenue (commission collected) by day / week / month
- Breakdown by city, ride category, payment method
- Surge revenue contribution
- Refunds issued (total RM)
- Net revenue after refunds

### 9.2 Driver Payouts Report
- Total payouts disbursed by period
- Per-driver payout history
- Early cashout volume

### 9.3 Trip Report
- Total trips by period, city, ride category
- Completion rate, cancellation rate
- Average fare, average trip distance

### 9.4 Export
- All reports exportable as CSV
- PDPA-compliant: no unnecessary personal data in bulk exports

> **Note:** Advanced analytics dashboard (cohort analysis, funnel reporting, etc.) is deferred to Phase 2. See teeko-deferred.md.

---

## 10. Compliance & PDPA Tools

| Tool | Description |
|------|-------------|
| **Right to Erasure** | Process rider or driver data deletion requests; removes personal data from all records; trip records anonymised |
| **Data Export (Subject Access Request)** | Export all personal data held for a specific user in a machine-readable format |
| **Consent Log** | View consent records for each user (PDPA consent timestamp, version accepted) |
| **Audit Log** | Full log of all admin actions (who did what, when) — immutable |
| **Data Retention Policy** | Configurable retention periods per data type; auto-purge after retention period |

---

## 11. Support Management

### 11.1 Support Ticket Queue
- All in-app support submissions (from both riders and drivers) appear here
- Filter by: type (dispute, appeal, EVP change, account issue), status (open, in progress, resolved), assigned admin

### 11.2 Ticket Actions
- Assign to admin team member
- Add internal notes
- Respond to user (response sent as in-app notification)
- Resolve and close ticket
- Escalate to Super Admin

### 11.3 Vehicle Change Requests (Driver)
- Drivers cannot self-serve vehicle changes in-app — they submit via support
- Admin reviews request, disables current EVP, initiates new EVP application for replacement vehicle
- Driver notified at each step

---

## 12. Notifications & Communication

- Admin can send **broadcast notifications** to all riders, all drivers, or a specific city segment
- Triggered notifications (document expiry, EVP renewal, suspension) are automated — admin configures the templates
- All notifications logged with recipient, timestamp, and content

---

## 13. Admin Panel — Screen Inventory

| Screen | Description |
|--------|-------------|
| Dashboard | Live platform overview — active trips, online drivers, alerts |
| Driver List | Searchable, filterable list of all driver accounts |
| Driver Profile | Full driver detail, documents, vehicles, history, actions |
| Document Review Queue | Pending driver document submissions awaiting approval |
| EVP Tracker | Status of all EVP applications and renewals |
| Appeals Queue | Pending driver suspension appeals |
| Rider List | Searchable, filterable list of all rider accounts |
| Rider Profile | Full rider detail, ride history, reports, actions |
| Live Trip Map | Real-time map of all active trips |
| Trip History | Searchable log of all trips with filters |
| Trip Detail | Full trip breakdown with dispute/refund actions |
| Disputes Queue | Open disputes from riders and drivers |
| Surge Control | Live surge map, rule configuration, manual override |
| Commission Settings | Platform-wide and per-driver commission configuration |
| Incentives & Campaigns | Create and manage driver bonus programmes |
| Payout Management | Weekly payouts, early cashout requests, failed payouts |
| Revenue Reports | Commission, payout, and trip reporting with CSV export |
| PDPA Tools | Erasure requests, data export, consent logs |
| Audit Log | Immutable log of all admin actions |
| Support Tickets | Rider and driver support queue with assignment and resolution |
| Broadcast Notifications | Send platform-wide or segment-specific messages |
| Admin User Management | Create, edit, and deactivate admin accounts and roles (Super Admin only) |

---

## 14. Open Questions

1. Is there a dedicated support team at launch, or do ops handle support tickets too?
2. Should finance have read-only access to driver profiles, or only to financial data?
3. Is there a defined SLA for dispute resolution (e.g. resolve within 48 hours)?
4. Will the admin panel require 2FA for all admin accounts?
5. Should broadcast notifications support scheduling (send at a future time)?

---

*This PRD was drafted based on teeko-prd.md, teeko-driver-prd.md, and teeko-rider-prd.md on 2026-04-04.*
