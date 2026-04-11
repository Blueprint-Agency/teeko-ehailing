# React Native + EAS Build — Getting Started Guide

> **Audience:** Web developers (Next.js / Node.js) with no prior mobile app experience.
> **Purpose:** Understand what changes, what stays the same, and how to organise the team.

---

## Contents

1. [Key Terms — One-Liner Glossary](#key-terms--one-liner-glossary)
2. [At a Glance — What Transfers vs What's New](#at-a-glance--what-transfers-vs-whats-new)
3. [What Is Different](#what-is-different)
4. [Seeing Your App During Development — Free Workflow](#seeing-your-app-during-development--free-workflow)
5. [Seeing Your Changes During Development](#seeing-your-changes-during-development)
6. [Can Android and iOS Be Developed at the Same Time?](#can-android-and-ios-be-developed-at-the-same-time)
7. [How to Structure the Team](#how-to-structure-the-team)
8. [Accounts and Access Required Before Day One](#accounts-and-access-required-before-day-one)
9. [What Each Role Needs to Set Up Locally](#what-each-role-needs-to-set-up-locally)
10. [The Build You Install Is Not the Same as the One You Ship](#the-build-you-install-is-not-the-same-as-the-one-you-ship)
11. [Free Tier Limits to Be Aware Of](#free-tier-limits-to-be-aware-of)
12. [Summary](#summary)

---

## Key Terms — One-Liner Glossary

Read this first. Every new tool below has a direct equivalent you already know.

| Term | What it is | Web equivalent |
|---|---|---|
| **React Native** | A React framework that renders to native iOS/Android UI instead of the browser DOM | Next.js / React (but for phones) |
| **Expo** | A platform and toolset built around React Native that handles config, builds, and updates so you don't touch Xcode or Android Studio directly | Create React App / Vercel — scaffolding + managed infrastructure |
| **Expo Go** | A free app you install on your phone that runs your project instantly via QR code — no build step needed | `localhost:3000` in your browser |
| **Metro** | The dev server that bundles your JavaScript and serves it to your phone | webpack / Vite dev server |
| **EAS Build** | A cloud service that compiles your app into installable binaries (`.apk` / `.ipa`) — critical because iOS builds require macOS, which this removes | `npm run build` + CI/CD pipeline |
| **EAS Update** | Pushes JavaScript-only changes directly to devices without a new build | Hot deploy / Vercel preview deployment |
| **TestFlight** | Apple's official way to distribute test builds to iPhones before App Store release | Staging / preview URL |
| **Fast Refresh** | Save a file → change appears on your phone in 1–2 seconds | Hot Module Replacement (HMR) |

---

## At a Glance — What Transfers vs What's New

| Category | What you already know (web) | Mobile equivalent | Change for you |
|---|---|---|---|
| **Language** | JavaScript / TypeScript | Identical | ✅ None |
| **UI framework** | React (components, hooks, props, state) | React Native — same API, different primitives (`<View>` not `<div>`) | 🟡 Learn new components |
| **Packages** | npm, `package.json` | Identical | ✅ None |
| **API calls** | `fetch` / `axios` | Identical | ✅ None |
| **State management** | Zustand, Redux, Context | Identical | ✅ None |
| **Env variables** | `.env` + `process.env` | `app.config.js` + `expo-constants` | 🟡 Different config file |
| **Dev server** | `npm run dev` → browser at `localhost:3000` | `npx expo start` → phone via QR code (Expo Go) | 🟡 Phone replaces browser |
| **Hot reload** | HMR in Next.js | Fast Refresh — identical behaviour | ✅ None |
| **Debugging** | Chrome DevTools | React Native DevTools — same Chrome frontend | ✅ Nearly identical |
| **Building** | `npm run build` or CI | EAS Build (cloud) — needed because iOS can't compile on Windows | 🔴 New concept |
| **Deploying** | Push to Vercel / server | JS changes: EAS Update (instant). Native changes: App Store review (1–3 days) | 🔴 New concept |
| **Backend** | Node.js, PostgreSQL, Redis, Socket.io | **Completely unchanged** | ✅ None |
| **Git workflow** | Git + GitHub | Identical | ✅ None |

> **Read the table above first.** If a row is ✅, skip it — you already know it. Focus your learning on the 🟡 and 🔴 rows.

---

## What Is Different

### 1. There is no browser

Forget the DOM. There are no HTML elements, no CSS files, no `window` or `document`. React Native renders directly to native UI components on the device. The visual output looks like a native app because it *is* one.

This affects frontend developers only. Backend developers are unaffected.

### 2. Deployment is not instant

On the web, you push code and it is live in seconds. On mobile:

| Type of change | How it ships | How long it takes |
|---|---|---|
| UI, logic, API changes (JavaScript only) | OTA update — pushed directly to users | Minutes, no review |
| Adding a new SDK, changing permissions | Full app build → App Store / Play Store submission | iOS: 1–3 days review. Android: hours |

This means native-level changes (adding a payment SDK, changing location permissions) need to be planned ahead. You cannot hotfix them the same day.

### 3. iOS requires Apple hardware to build — but not to develop

You cannot compile an iOS app on Windows. However, you can **write all the code on Windows** and use **EAS Build** (a cloud service) to compile the iOS app on Expo's Mac servers. You push your code, wait ~15 minutes, and get an installable iOS app back.

Day-to-day coding on Windows is fine. You only trigger a cloud build when something changes at the native level.

### 4. Android and iOS sometimes behave differently

The same JavaScript code runs on both platforms, but the two operating systems handle certain things differently — particularly:

- How aggressively they suspend background processes (critical for the driver GPS tracking)
- How they handle permissions (camera, location, notifications)
- How payment apps return to your app after a transaction (deep links)

These differences are manageable but require testing on both platforms, not just one.

### 5. Permissions must be explicitly declared and requested

On web, the browser handles permission prompts. On mobile, you must:
- Declare every permission your app needs in platform config files
- Write code to ask the user at the right moment (e.g. ask for location when they first open the map, not on app launch)

Forgetting a permission declaration is a common reason for App Store rejection.

---

## Seeing Your App During Development — Free Workflow

### Expo Go: the fastest (and free) way to preview on iOS from Windows

For day-to-day development, you do not need EAS Build, TestFlight, or an Apple Developer account. **Expo Go** is a free app you install from the App Store onto any physical iPhone. It connects to your local development server over WiFi and renders your app with full hot reload — exactly like opening `localhost:3000` in a browser, except on your phone.

**How it works:**

1. Install **Expo Go** from the App Store (iOS) or Play Store (Android) — free
2. Run `npx expo start` on your Windows machine
3. A QR code appears in your terminal
4. Scan the QR code with your iPhone camera — the app opens in Expo Go
5. Edit a file, save → the change appears on your phone in 1–2 seconds

**What works in Expo Go:**
- All UI components, navigation, state management
- API calls (`fetch`, `axios`)
- Google Maps (`react-native-maps` is included in the Expo SDK)
- Firebase Auth (OTP login)
- Socket.io (real-time driver location updates)
- Push notifications (via `expo-notifications`)

**What does NOT work in Expo Go:**
- Third-party native SDKs that are not part of the Expo SDK (TNG eWallet SDK, GrabPay SDK)
- Custom native modules you write yourself
- Any library that requires linking custom native code

When you hit these limits — typically when integrating payment SDKs — you transition to a **development build** via EAS Build. This is a custom version of Expo Go that includes your specific native dependencies. See "Build Types" below.

**Requirements:**
- At least one physical iPhone on the team (can be a personal device)
- The phone and your Windows machine must be on the same WiFi network
- No Apple Developer account needed
- No EAS Build credits consumed

This is the recommended primary workflow for the first 2–3 weeks of development.

### Previewing on your Windows screen (before touching a phone)

You do not have to pick up a phone every time you change a line of code. Two options let you see changes directly on your Windows desktop:

#### Option A: Browser preview (fastest — feels like web dev)

```bash
npx expo start --web
# or press 'w' in the Metro terminal after running npx expo start
```

Your app opens at `localhost:8081` in your browser. This uses **react-native-web** under the hood, which translates `<View>`, `<Text>`, etc. into HTML/CSS.

- **Pros:** Instant feedback, Chrome DevTools work natively, feels identical to Next.js development
- **Cons:** Not pixel-perfect native rendering — some components (maps, native animations, platform-specific styles) will look or behave slightly differently than on a real device
- **Best for:** Layout iteration, form flows, API integration, business logic — covers ~70–80% of your development

#### Option B: Android Emulator (true native rendering on your screen)

Run an Android Virtual Device (AVD) through Android Studio. It appears as a phone window on your desktop.

```bash
npx expo start
# then press 'a' in the terminal to open on the Android emulator
```

- **Pros:** True native Android rendering, tests actual touch interactions, animations, and navigation
- **Cons:** Requires Android Studio installed (~3 GB), emulator uses RAM (~2–4 GB), slower startup than browser
- **Best for:** Verifying native look and feel, testing gestures, final visual QA before phone testing

#### Recommended development loop

```
Code change → Browser preview (instant) → Android emulator (spot-check) → Phone via Expo Go (final test)
```

Most iteration happens in the browser. You only move to the emulator or phone for visual accuracy and device-specific features (GPS, camera, payments).

---

## Seeing Your Changes During Development

### It is not a browser tab — it is your phone or emulator

On web, you run `npm run dev` and open `localhost:3000` in a browser. React Native works similarly in concept but differently in practice:

- You still run a dev server (called **Metro**, the equivalent of webpack/Next.js dev server)
- Instead of opening a browser tab, you look at your **phone or Android emulator**
- Metro runs on a port (default `8081`) but opening it in a browser does nothing useful — it just serves the JS bundle to the device

### Hot reload works the same way

Save a file → the change appears on your device in 1–2 seconds, without restarting the app. This is called **Fast Refresh** and behaves identically to Next.js hot module replacement. You do not need to rebuild or reinstall the app for JavaScript changes.

### What you look at

| On web | On mobile |
|---|---|
| Browser tab at `localhost:3000` | Android emulator window, or physical phone screen |
| Browser DevTools console | Terminal where Metro is running (logs appear here) |
| Browser DevTools inspector | Shake the device to open the dev menu → React Native DevTools |

### Android vs iOS during development

| Platform | How you see it on Windows |
|---|---|
| Android | Android emulator (runs locally on your machine via Android Studio) or a physical Android phone connected via USB |
| iOS | **Expo Go (free, no build needed):** Install Expo Go from App Store, scan QR code — connects to your local Metro server over WiFi. **Development build (when native SDKs needed):** Build once via EAS Build (cloud), install via TestFlight, then it connects to your local Metro server for all future JS changes |

The key point for iOS: you only need a new cloud build when native code changes. For all day-to-day JavaScript work, your iPhone talks to your local Metro server over WiFi — the feedback loop is just as fast as Android.

### Console logs and debugging

Logs from `console.log()` appear in the terminal where Metro is running, just like Node.js. There is no browser console, but the output is identical. For deeper debugging (inspecting component trees, breakpoints, network requests), use **React Native DevTools** — the built-in debugger since React Native 0.76. It uses the same Chrome DevTools frontend you already know. Launch it by pressing `j` in the Metro terminal, or shake your device and select "Open DevTools" from the dev menu.

---

## Can Android and iOS Be Developed at the Same Time?

**Yes — and this is the main reason React Native was chosen.**

Because both apps share one JavaScript codebase, a developer building the ride booking screen is building it for both iOS and Android simultaneously. There is no separate iOS version and Android version of the same feature.

The only times platforms diverge are:

| Situation | What happens |
|---|---|
| Adding a new native SDK (e.g. TNG, GrabPay) | Requires separate config steps for Android and iOS — usually a few hours of setup per platform |
| Fixing a platform-specific bug | One developer fixes it in a platform config file; the other platform is unaffected |
| Submitting to app stores | Android and iOS submissions are independent processes running in parallel |

In practice, a developer builds a feature once and tests it on both an Android device and an iPhone. Most issues are caught quickly.

---

## How to Structure the Team

### Recommended: Work by Feature

Assign developers to features, not platforms. Each developer owns a feature end-to-end on both platforms.

**Example split for Teeko:**

| Developer | Owns |
|---|---|
| Dev A | Ride booking flow (map, fare estimate, driver matching) |
| Dev B | Driver app (job requests, GPS tracking, trip management) |
| Dev C | Payments, receipts, transaction history |
| Dev D | Auth (OTP), user profiles, ratings |

Every developer tests their own feature on both Android and iOS. Platform-specific bugs are fixed by the developer who owns that feature.

### Why not split by platform?

Splitting into an "iOS developer" and an "Android developer" defeats the purpose of React Native. You would end up building the same feature twice, doubling the work and creating two codebases that diverge over time. Only do this if you have dedicated native module work (e.g. writing a bridge for a SDK that has no React Native support).

### Designate one person as the Native Config owner

Even in a feature-based team, someone needs to own the shared native setup:

- Managing `android/` and `ios/` config files
- Setting up signing certificates and provisioning profiles
- Maintaining the EAS Build pipeline
- Handling App Store and Play Store submissions
- Resolving native dependency conflicts when new SDKs are added

This does not need to be a full-time role — it is a responsibility, not a job title. Pick the most technically confident frontend developer. They handle all native plumbing so the rest of the team can focus on features.

---

## Accounts and Access Required Before Day One

These must be set up before development starts. They take time to approve.

| Account | Who needs it | Cost | When needed | Notes |
|---|---|---|---|---|
| Expo Go app | All frontend developers | Free | Day 1 | Install from App Store / Play Store. Primary development tool — no account required. |
| Expo account | Native Config owner | Free | Day 1 | Required for EAS Build. Free plan: 30 builds/month (max 15 iOS), low-priority queue (60–90 min wait). |
| Firebase project | Any developer | Free | Day 1 | Needed for Auth (OTP) and push notifications. Free tier covers MVP volume. |
| Apple Developer Program | Native Config owner | USD 99/year | Before native SDK integration (~week 3) | Takes 1–2 days to approve. Required for TestFlight and App Store. **Not needed for Expo Go development.** |
| Google Play Developer | Native Config owner | USD 25 one-time | Before Play Store submission | Approved within hours. |
| TNG Developer Portal | Native Config owner | Free | Before payment integration | Required to integrate TNG eWallet SDK. |
| GrabPay Developer Portal | Native Config owner | Free | Before payment integration | Required to integrate GrabPay SDK. |

---

## What Each Role Needs to Set Up Locally

### All frontend developers

- Node.js (v18+)
- Android Studio + Android SDK (to run an Android emulator)
- **Expo Go** installed on a physical iPhone and/or Android phone (free, from App Store / Play Store)
- A physical Android phone (for testing GPS and payments — emulators are unreliable for these)
- **Expo Orbit** (optional, free) — Windows app for one-click Android emulator management and EAS build installs. Note: iOS simulator features are macOS-only.
- Expo account login (`eas login`)

### Native Config owner (in addition to above)

- Apple Developer account access
- EAS Build configured with Apple and Google signing credentials
- A physical iPhone registered for TestFlight testing

### Backend developers

- No mobile-specific setup. Work exactly as for a web project.

---

## The Build You Install Is Not the Same as the One You Ship

This confuses most web developers the first time.

There are three types of builds:

| Build type | Purpose | Who uses it |
|---|---|---|
| **Development build** | Daily coding and testing. Has debug tools built in. Not for end users. | Developers |
| **Preview build** | Internal QA testing. Looks like the real app but is not on the public store. | QA, stakeholders |
| **Production build** | The real app submitted to App Store / Play Store. | End users |

When a developer says "run the app on your phone," they mean install the development build. This is separate from what eventually ships to users.

---

## Free Tier Limits to Be Aware Of

These limits apply during the development phase. All are sufficient for MVP but should be planned around.

| Service | Free tier | Limit that matters |
|---|---|---|
| **EAS Build** | 30 builds/month (max 15 iOS) | Builds are low-priority — expect 60–90 min queue times. Use EAS Update for JS-only changes to avoid burning build credits. |
| **EAS Update** | 1,000 monthly active users, 100 GiB bandwidth | Sufficient for development and early testing. Upgrade to Starter ($19/mo) if you exceed this. |
| **Firebase Auth** | 10,000 verifications/month (phone OTP) | Covers MVP development and early launch. |
| **Firebase FCM** | Unlimited push notifications | No limits — entirely free. |
| **Google Maps Platform** | $200/month free credit | Covers ~28,000 Dynamic Maps loads or ~40,000 Directions requests. Monitor usage during development. |
| **GitHub Actions** | 2,000 minutes/month (free for public repos) | Sufficient for CI/CD during MVP. |

### What is NOT free

| Item | Cost | When required |
|---|---|---|
| Apple Developer Program | USD 99/year | Before TestFlight / App Store submission (~week 3) |
| Google Play Developer | USD 25 one-time | Before Play Store submission |
| Stripe transaction fees | ~2.9% + USD 0.30 per transaction | At payment go-live |
| Starter plan (if free builds run out) | USD 19/month | Only if 15 iOS builds/month is insufficient |

---

## Summary

- Your JavaScript and React knowledge transfers completely. The learning curve is the tooling, not the language.
- **Expo Go is your primary development tool on Windows.** Install it on a physical iPhone, scan a QR code, and see your app with hot reload — for free, no Apple Developer account needed.
- One codebase covers both iOS and Android. Organise the team by feature, not by platform.
- Appoint one person to own native config, builds, and store submissions.
- Apple Developer account ($99/yr) is only needed when integrating native SDKs or submitting to the App Store — not on day one.
- iOS cloud builds on Windows are solved by EAS Build (free tier: 15 iOS builds/month). Use EAS Update for JS-only changes to conserve build credits.
- Plan native-level changes (new SDKs, permission updates) ahead of deadlines. They cannot be hotfixed on the day.

---

*Last updated: 2026-04-11*
