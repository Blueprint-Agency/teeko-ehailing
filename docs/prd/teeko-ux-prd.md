# Teeko — User Experience PRD (Rider App)

> **Version:** 1.0
> **Date:** 2026-04-03
> **Status:** Draft
> **Scope:** Rider app only (iOS & Android)

---

## 1. Overview

This document defines the user experience for the Teeko rider app. It covers every screen, flow, and interaction a rider encounters — from sign-up to trip completion. The design direction is **clean, trustworthy, and affordable**, using Bolt as the primary UX reference with Teeko-specific adaptations.

### Design Principles

| Principle | Description |
|-----------|-------------|
| **Clean** | Minimal UI, generous whitespace, no visual clutter |
| **Trustworthy** | Clear information hierarchy, predictable interactions, transparent pricing |
| **Affordable** | Friendly tone, approachable typography, no premium/luxury aesthetic |

---

## 2. Brand & Visual Direction

| Element | Specification |
|---------|---------------|
| **Primary color** | Red (exact hex TBD) |
| **Typography** | Rounded, friendly typeface (e.g., Nunito, Poppins, or equivalent) |
| **Mode** | Light mode only — no dark mode |
| **Logo** | Not yet finalized |
| **Iconography** | Rounded, line-style icons consistent with friendly brand tone |
| **Illustrations** | Flat, minimal vehicle illustrations for ride type cards |

---

## 3. App Structure

### 3.1 Navigation

Bottom navigation bar with 3 tabs:

| Tab | Icon | Label | Default |
|-----|------|-------|---------|
| 1 | Home icon | Home | — |
| 2 | Clock/car icon | Rides | Default landing tab |
| 3 | Person icon | Account | — |

> **Note:** The Rides tab is the default screen when the app opens.

---

## 4. Screen-by-Screen Specifications

### 4.1 Sign-Up / Login

**Entry point:** First app launch

**Flow:**
```
App opens → Location permission prompt (immediately) → Enter phone number
→ Enter OTP → Account created → Home screen
```

| Element | Details |
|---------|---------|
| **Auth method** | Phone number + OTP |
| **Location permission** | Requested immediately on first open, before sign-up |
| **Language** | Auto-detected from phone system settings; changeable in Account |
| **Post sign-up** | User lands on the default Rides tab (Home screen) |

**Screen layout:**
- Teeko logo/wordmark (centered, top)
- "Travel Easily with Teeko." tagline
- Phone number input field + "Continue" button (prominent, full-width)
- OTP verification screen follows
- Terms & Privacy links at the bottom

---

### 4.2 Home Tab

**Purpose:** Primary entry point for booking a ride.

**Layout (top to bottom):**

1. **Headline** — "Travel Easily with Teeko." (large, bold, left-aligned)
2. **Rides card** — Single action card with vehicle illustration
   - Label: "Rides"
   - Subtitle: "Let's get moving"
   - Tapping opens the "Where to?" search flow
3. **"Where to?" search bar**
   - Search icon + placeholder text: "Where to?"
   - Tapping opens the destination search screen
4. **Recent places** — List of recently visited destinations
   - Clock icon + address name + street address
   - Tapping a recent place pre-fills the destination

**No hamburger menu.** All navigation via bottom tabs.

---

### 4.3 Destination Search

**Entry point:** Tapping "Where to?" on Home, or tapping the Rides card.

**Layout:**
- **Pickup field** — Auto-filled with current GPS location; editable
- **Destination field** — Text input with search-as-you-type (Google Places API)
- **Saved places** — Home and Work shortcuts (if set)
- **Recent places** — Previously visited destinations
- **Search results** — Google Places suggestions as user types

**Interaction:**
```
Tap "Where to?" → Full-screen search → Type destination
→ Select from results → Destination confirmation screen
```

---

### 4.4 Destination Confirmation

**Entry point:** After selecting a destination from search.

**Layout:**
- **Top half** — Map with destination pin (draggable for adjustment)
- **Bottom sheet** — Location name (large, bold), sub-location details if applicable (e.g., terminal number)
- **"Confirm destination" button** — Full-width, red, bottom of screen
- **Current location button** — Floating circular button on map (bottom-right)
- **Back arrow** — Top-left to return to search

**Interaction:**
```
Review pin on map → Adjust if needed → Tap "Confirm destination"
→ Ride type selection screen
```

---

### 4.5 Ride Type Selection

**Entry point:** After confirming destination.

**Layout (top to bottom):**

1. **Top bar** — Pickup address → Destination address (truncated), X to close, + to add stop
2. **Map** — Shows route line from pickup to destination, ETA bubble on route (e.g., "8 min"), estimated arrival time (e.g., "Arrive by 23:40")
3. **Ride type list** — Vertical scrollable list:

| Ride Type | Description | Info Shown |
|-----------|-------------|------------|
| **Teeko Go** | Standard economy car | Car illustration, ETA, seat count (4), price in RM |
| **Teeko Comfort** | Newer or higher-comfort vehicle | Car illustration, ETA, seat count (4), price in RM |
| **Teeko XL** | Larger vehicle (MPV/SUV) for groups | Car illustration, ETA, seat count (6), price in RM |
| **Teeko Premium** | Premium/luxury sedan | Car illustration, ETA, seat count (4), price in RM |
| **Teeko Bike** | Motorbike taxi (short, fast trips) | Bike illustration, ETA, seat count (1), price in RM |

- Selected ride type highlighted with a border (red outline)
- Price shown as a single fixed amount (e.g., "RM 25") — no range

4. **Payment selector** — Bottom of list, shows current payment method with dropdown arrow
   - Options: Credit/Debit Card, Touch 'n Go eWallet, GrabPay, Google Pay
   - Tapping opens payment method picker

5. **CTA button** — Full-width, red: "Select Teeko Go" (dynamically updates with selected type)

---

### 4.6 Finding Your Driver

**Entry point:** After tapping the "Select [ride type]" button.

**Layout:**
- Map visible in background (dimmed)
- **Centered loading animation** — Searching indicator
- **Text:** "Finding your driver..."
- **Cancel button** — Below the loading animation, text-style: "Cancel"

**Behavior:**
- Search runs for **60 seconds** maximum
- If no driver found within 60 seconds → show "No drivers available. Please try again." with a "Try again" button
- If rider taps "Cancel" → return to ride type selection screen

---

### 4.7 Driver Matched

**Entry point:** Driver accepts the ride request.

**Layout:**
- **Map** — Shows driver's real-time location moving toward pickup, pickup pin visible
- **Bottom card** — Driver information:

| Field | Details |
|-------|---------|
| **Driver photo** | Circular profile picture |
| **Driver name** | Full name |
| **Rating** | Star icon + numeric rating (e.g., 4.85) |
| **Vehicle** | Car model + color (e.g., "Silver Perodua Myvi") |
| **Plate number** | License plate (e.g., "WA 1234 X") |
| **ETA** | "Arriving in X min" |

- **Action buttons:**
  - Phone icon — Call driver (opens dialer)
  - Chat icon — In-app message to driver
- **Trip status indicator** — "Driver is on the way"

---

### 4.8 Driver Arrived

**Entry point:** Driver arrives at pickup location.

**Push notification:** "Your driver has arrived."

**Layout:**
- Same as Driver Matched screen
- **Trip status changes to:** "Your driver has arrived"
- **ETA replaced with:** "Meet your driver at [pickup address]"

---

### 4.9 In-Trip

**Entry point:** Driver starts the trip.

**Push notification:** "Your trip has started."

**Layout:**
- **Full-screen map** with:
  - Live route line (pickup → destination)
  - Driver location marker (real-time, animated movement)
  - Destination pin
  - ETA to destination (updating in real-time)
- **Bottom card:**
  - Trip status: "Heading to [destination]"
  - Estimated arrival time
  - Driver info (compact: name + plate)
- **Action buttons:**
  - Phone icon — Call driver
  - Chat icon — Message driver

---

### 4.10 Trip Completed

**Entry point:** Driver ends the trip.

**Push notification:** "You've arrived! Your fare is RM XX."

**Layout:**
- **Header:** "Trip completed"
- **Fare display:** Total amount, large and prominent (e.g., "RM 25.00")
- **Rating section:**
  - "How was your ride with [Driver Name]?"
  - 5 empty stars — tap to rate (1–5)
  - Optional comment text field: "Leave a comment (optional)"
- **Done button** — Full-width, red: "Done"

**Behavior:**
- Rating is required (must select at least 1 star to proceed)
- Comment is optional
- Tapping "Done" → returns to Home screen

---

### 4.11 Receipt

**Entry point:** Accessible from Rides tab → tap on a past ride.

**Layout:**
- **Trip summary:**
  - Date and time
  - Pickup address
  - Destination address
  - Ride type (Teeko M / L / Premium)
- **Total fare** — Single amount, bold (e.g., "RM 25.00")
- **Payment method** — Method used (e.g., "Touch 'n Go eWallet")
- **Driver info** — Name, plate number

> **Note:** No fare breakdown (no base fare / distance / time split). Total only.

---

### 4.12 Rides Tab

**Purpose:** View past ride history.

**Default tab** when the app opens.

**Layout:**
- **Header:** "Rides" (large, bold, left-aligned)
- **Tab filter:** "Past" (single tab — no "Upcoming" since scheduling is deferred)
- **Ride list** — Grouped by month (e.g., "April 2026"):

| Element | Details |
|---------|---------|
| **Ride icon** | Car icon (normal ride) or crossed-out car (cancelled) |
| **Date & time** | e.g., "3 Apr · 14:16" |
| **Status** | Shown only if cancelled: "Cancelled" |
| **Pickup address** | Truncated if long |
| **Destination address** | Truncated if long |
| **Fare** | e.g., "RM 25" (or "RM 0" if cancelled) |

- Tapping a ride → opens the Receipt screen for that trip

---

### 4.13 Account Tab

**Purpose:** User profile, settings, and saved places.

**Layout (top to bottom):**

1. **User info:**
   - User name (large, bold, centered)
   - Star icon + rating (e.g., "5.00 Rating")

2. **Menu items:**

| Item | Icon | Action |
|------|------|--------|
| Personal info | Person icon | Edit name, phone, email |
| Login & security | Shield/check icon | Change password, manage Google connection |

3. **Saved places section:**
   - Header: "Saved places"
   - Home — "Enter home location" (or saved address if set)
   - Work — "Enter work location" (or saved address if set)
   - Tapping opens address search to save location

> **Not included:** Family profile, Safety section, Connect calendar, Add a place (custom favourites).

---

## 5. Cancellation Flow (Draft)

> **Note:** Cancellation policy details are pending business confirmation. This is a placeholder flow.

### Rider-Initiated Cancellation

**Entry point:** Cancel button available on Finding Driver and Driver Matched screens.

**Flow:**
```
Tap "Cancel" → "Are you sure you want to cancel?" confirmation dialog
→ Select reason (optional) → Confirm cancel → Return to Home screen
```

**Cancellation reasons (optional, single-select):**
- Driver is too far away
- Changed my plans
- Waiting too long
- Booked by mistake
- Other

**Cancellation policy (placeholder — pending confirmation):**
- Free cancellation within 1 minute of driver match
- After 1 minute or if driver has arrived: cancellation fee may apply (amount TBD)

---

## 6. Push Notifications

| Trigger | Message |
|---------|---------|
| Driver matched | "Your driver [Name] is on the way. ETA: X minutes." |
| Driver arrived | "Your driver has arrived at [pickup location]." |
| Trip started | "Your trip has started. Heading to [destination]." |
| Trip completed | "You've arrived! Your fare is RM XX." |
| Ride cancelled (by driver) | "Your ride was cancelled. Please try booking again." |

---

## 7. Payment Method Management

**Entry point:** Payment dropdown on Ride Type Selection screen, or Account > Payment methods.

**Supported methods:**

| Method | Setup |
|--------|-------|
| Credit / Debit Card (Visa, Mastercard) | Add card number, expiry, CVV |
| Touch 'n Go eWallet | Link via TNG SDK |
| GrabPay | Link via GrabPay SDK |
| Google Pay | Link via Google Pay SDK |

**Default payment:** Last used method is pre-selected on next booking.

---

## 8. User Flow Summary

### Complete Rider Booking Flow
```
Open App → Home Tab → Tap "Where to?" → Search destination
→ Select destination → Confirm destination on map
→ Select ride type (Teeko M / L / Premium) → Choose payment method
→ Tap "Select [ride type]" → Finding driver (up to 60s)
→ Driver matched → Driver en route → Driver arrived
→ Trip in progress (live map) → Trip completed
→ Rate driver (1–5 stars) + optional comment → Done → Home
```

### View Past Rides
```
Rides Tab → Scroll past rides → Tap ride → View receipt
```

### Manage Account
```
Account Tab → Edit personal info / Login & security / Saved places
```

---

## 9. Screens Not in MVP Scope

The following are explicitly excluded from this UX PRD:

| Feature | Reason |
|---------|--------|
| Rebook from ride history | Not needed |
| Dark mode | Not planned |
| Account extras (calendar connect, promos) | Not needed |
| Driver app UX | Separate PRD |
| Admin dashboard UX | Separate PRD |
| Toll/surcharge banner | Deferred |
| Fare breakdown in receipt | Deferred — total only |
| Custom saved places (beyond Home/Work) | Not planned |
| Tipping | Deferred — see teeko-deferred.md |

---

*This UX PRD was drafted based on interview sessions on 2026-04-03, using Bolt as the primary UX reference.*
