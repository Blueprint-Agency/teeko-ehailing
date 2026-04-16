# Teeko — Driver-Partner Web Portal: Product Requirements Document

> **Version:** 1.0
> **Date:** 2026-04-15
> **Status:** Draft

---

## 1. Overview

This document defines the product requirements for the **Teeko Driver-Partner Web Portal** — a browser-based onboarding gateway that allows prospective driver-partners to register, submit required documents, and track their application status before downloading the Teeko Driver mobile app.

The web portal is a **pre-mobile gateway**, not a replacement for the mobile app. Drivers complete onboarding here; all active driving functions (going online, receiving trips, navigation) remain in the iOS/Android app.

For mobile app requirements, refer to `teeko-driver-prd.md`.
For rider-side requirements, refer to `teeko-ux-prd.md`.

---

## 2. Driver Persona

| Attribute | Description |
|-----------|-------------|
| **Who** | Malaysian citizens seeking supplemental or full-time income through e-hailing driving |
| **Motivation** | Lower platform commission vs. Grab; flexible working hours |
| **Operating region** | West Malaysia (regulated by APAD) and East Malaysia (regulated by LPKP) |
| **Device usage** | May complete onboarding from a desktop browser, laptop, or mobile browser before downloading the driver app |

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

## 4. Onboarding Flow

### 4.1 Registration Funnel

```
Landing Page
→ Enter Phone Number → Verify OTP
→ Create Account (name, email, password)
→ Accept Driver Agreement (T&C)
→ Upload Personal Documents (NRIC, CDL, PSV-D, insurance, selfie)
→ Upload Vehicle Documents (Car Grant/VOC, Road Tax, Insurance, PUSPAKOM)
→ Submission Confirmation → App Download Prompt (iOS / Android)
```

Drivers can exit and return at any point. Progress is saved per step so the driver resumes where they left off on re-login.

### 4.2 Account Creation

- Phone number is the primary identifier (consistent with mobile app).
- Driver also provides: full name, email address, and a password for web portal access.
- Phone OTP verifies the number before account creation proceeds.

### 4.3 Driver Agreement

- Driver must scroll through the full Terms & Conditions and Driver Agreement before a confirmation checkbox becomes enabled.
- Acceptance is timestamped and stored server-side.
- Driver cannot proceed to document upload without accepting the agreement.

### 4.4 Personal Document Upload

Documents are uploaded in a guided step-by-step flow. Each step shows:
- What the document is and why it is required
- An example image of an acceptable document
- Upload area (drag-and-drop or file picker; camera capture on mobile browser)
- Confirmation thumbnail before proceeding

| Step | Document |
|------|----------|
| 1 | NRIC / MyKad (front and back) |
| 2 | Competent Driving Licence (CDL) |
| 3 | PSV-D Licence (E-hailing Licence) |
| 4 | E-hailing Insurance Cover Note |
| 5 | Liveness selfie / profile photo |

### 4.5 Vehicle Document Upload

After personal documents, the driver registers their first vehicle and uploads its documents.

| Step | Document |
|------|----------|
| 1 | Vehicle details (make, model, year, plate number, colour) |
| 2 | Car Grant / VOC |
| 3 | Valid Road Tax |
| 4 | E-hailing Insurance Cover Note |
| 5 | PUSPAKOM Inspection Certificate |

### 4.6 Submission Confirmation

- After all documents are submitted, driver sees a success confirmation screen.
- The screen explains the next steps:
  1. Admin document review (1–3 working days)
  2. EVP application submitted by Teeko to APAD/LPKP (5–7 working days)
  3. Account activated — driver notified to download the mobile app
- **App download prompt** is displayed: buttons linking to the App Store (iOS) and Google Play (Android).
- Driver is encouraged to check back for status updates.

---

## 5. Application Status Dashboard

Drivers can log back into the web portal at any time after submission to view their application status.

### 5.1 Status Stages

| Stage | States |
|-------|--------|
| **Document Review** | Pending / Under Review / Approved / Rejected |
| **EVP Application** | Not Started / Submitted to APAD/LPKP / Approved / Rejected |
| **Account Status** | Pending Activation / Active / Suspended |

### 5.2 Status Display

- Each stage is shown as a progress step with its current state.
- **Rejected documents** display the rejection reason and a **Resubmit** CTA.
- **Approved stage** shows a green checkmark and approval date.
- When both Document Review and EVP are approved, a prominent **"Download the Teeko Driver App"** banner is shown with App Store and Google Play links.

### 5.3 EVP Application Detail

- Shows which regulatory body the EVP was submitted to (APAD for West Malaysia / LPKP for East Malaysia).
- Shows submission date and expected approval window (5–7 working days).

---

## 6. Document Management

### 6.1 File Upload Specifications

| Attribute | Requirement |
|-----------|-------------|
| Accepted formats | JPG, PNG, PDF |
| Max file size | TBD — see Open Questions |
| Upload method | Drag-and-drop, file picker, or camera capture (mobile browser) |
| Image quality check | Client-side check for blur/low resolution before upload |

### 6.2 Per-Document States

| State | Description |
|-------|-------------|
| Uploaded | File received, awaiting review |
| Under Review | Admin is reviewing the document |
| Approved | Document accepted |
| Rejected | Document rejected; reason displayed; resubmit enabled |

### 6.3 Document Resubmission

- Rejected documents show the admin's rejection reason inline.
- Driver uploads a replacement file on the same screen.
- Resubmission restarts the review timer for that document only.

---

## 7. Authentication

| Feature | Details |
|---------|---------|
| Primary login | Phone number + OTP |
| Fallback | Email + password (for drivers unable to receive OTP) — see Open Questions |
| Session | Persistent login with "Remember me" option (30-day session token) |
| Password reset | Via phone OTP |
| Logout | Available in profile/account menu |

---

## 8. Notifications

### 8.1 In-Portal Notifications

- A notification banner appears on the status dashboard when a document state changes (e.g. "Your NRIC has been approved").
- Unread notification count shown in the header.

### 8.2 Email Notifications

| Trigger | Email sent |
|---------|------------|
| Document approved | "Your [document name] has been approved" |
| Document rejected | "Your [document name] requires attention" + reason |
| EVP approved | "Your EVP has been approved — download the app now" |
| Account activated | "Welcome to Teeko — you're ready to drive" |

### 8.3 SMS Notifications

| Trigger | SMS sent |
|---------|----------|
| OTP request | One-time verification code |
| Account activated | Short link to app download page |

---

## 9. UI / UX Requirements

| Requirement | Details |
|-------------|---------|
| **Responsive** | Fully functional on mobile browser (≥ 375 px) and desktop (≥ 1024 px) |
| **Language support** | English, Bahasa Malaysia, Mandarin (Simplified), Tamil — language picker in header |
| **Accessibility** | WCAG 2.1 AA compliance |
| **Dark mode** | Not required for v1.0 (web portal used on desktop/laptop in normal lighting) |
| **Progress indicator** | Step-by-step progress bar visible throughout the onboarding funnel |
| **Save & continue** | Each completed step is saved; driver can close the browser and resume later |

---

## 10. Screen Inventory

| Screen | Description |
|--------|-------------|
| **Landing page** | Value proposition, "Register as a Driver" CTA, login link |
| **Phone verification** | Enter Malaysian phone number → receive and enter OTP |
| **Account creation** | Full name, email address, password |
| **Driver Agreement** | Scrollable T&C; accept checkbox unlocked after scrolling to end |
| **Personal documents** | 5-step guided upload: NRIC, CDL, PSV-D, insurance, selfie |
| **Vehicle details** | Enter vehicle make, model, year, plate number, colour |
| **Vehicle documents** | 4-step guided upload: Car Grant, Road Tax, Insurance, PUSPAKOM |
| **Submission confirmation** | Success state; next-steps explanation; App Store + Google Play buttons |
| **Login** | Phone number + OTP (returning drivers) |
| **Application status** | Progress tracker for document review and EVP stages |
| **Document resubmission** | View rejection reason; upload replacement document |
| **Profile** | View and edit name, email, phone; language preference; logout |

---

## 11. Compliance

| Requirement | Implementation |
|-------------|---------------|
| PDPA 2010 — Consent | Consent checkbox during account creation; data collected only for onboarding and regulatory purposes |
| PDPA 2010 — Right to Erasure | Link to support form on profile page for account deletion requests |
| EVP mandatory | Web portal does not allow driving; EVP is tracked for informational purposes only |
| Document retention | Documents stored securely; access restricted to admin reviewers |
| Minor restriction | Date of birth derived from NRIC; applicants under 21 are rejected during document review |

---

## 12. Out of Scope (Web Portal v1.0)

The following features are **not** included in the web portal and remain mobile-app-only:

- Going online / offline toggle
- Receiving and accepting ride requests
- In-trip navigation
- Earnings dashboard and payouts
- Incentives and bonus tracking
- In-app support chat
- Ratings and feedback
- Vehicle management beyond initial registration

---

## 13. Open Questions

1. What is the maximum file size permitted per document upload (e.g. 5 MB, 10 MB)?
2. Should the web app support email + password as a login fallback for drivers who cannot receive OTP?
3. Will the web portal and mobile app share the same backend API and authentication token system?
4. What is the domain/URL for the driver web portal (e.g. `driver.teeko.my` or `register.teeko.my`)?
5. Should drivers be able to register additional vehicles during web onboarding, or is only one vehicle permitted before mobile activation?
6. *(Carried over from mobile PRD)* What is the exact no-show fee amount charged to riders (and credited to drivers)?
7. *(Carried over from mobile PRD)* Is early cashout free or does it carry a transaction fee?
8. *(Carried over from mobile PRD)* What is the maximum number of vehicles a driver can register under one account?

---

*This PRD was drafted based on the Teeko Driver-Partner App PRD (v1.0, 2026-04-03) and a product interview session on 2026-04-15.*
