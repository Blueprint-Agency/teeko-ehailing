# 05 — Phase A: Auth

Covers PRD §4.1. Outcome: first-launch location prompt → phone entry → OTP → authenticated session landed on Rides tab.

## 1. Screens

| Route | PRD | Notes |
|-------|-----|-------|
| `(auth)/phone.tsx` | §4.1 | Logo, tagline "Travel Easily with Teeko.", phone input with MY dial code prefix `+60`, "Continue" CTA, T&C / Privacy links |
| `(auth)/otp.tsx`   | §4.1 | 6-digit `OTPInput`, "Resend code in 30s" timer, change number link |

## 2. Location permission (first-launch)

- Request **immediately** on first app open, before `phone.tsx` renders — per PRD §4.1.
- Use `expo-location.requestForegroundPermissionsAsync()`.
- Handled in `app/_layout.tsx` *after* fonts + i18n load; result cached in `location-store`.
- If denied: app still works (Home uses a fallback centre point — KL Sentral). No blocking modal.
- iOS `Info.plist` string (via `app.json`): "Teeko uses your location to set your pickup point and show nearby drivers."

## 3. Auth handler contract

```ts
// packages/api/src/mock/handlers/auth.ts
sendOtp(phone: string): Promise<{ challengeId: string }>
verifyOtp(challengeId: string, code: string): Promise<{ rider: Rider; token: 'mock-token' }>
me(): Promise<Rider | null>
```

- `sendOtp` always succeeds, returns `challengeId = 'mock-' + nanoid()`.
- `verifyOtp`: any code starting with `1` succeeds → returns seed rider. Any other code → throws `OTP_INVALID` error.
- Token is persisted in AsyncStorage (`expo-secure-store` optional v0.1) so relaunch stays authed.

## 4. Auth store

```ts
useAuthStore = {
  rider: Rider | null,
  status: 'unknown' | 'guest' | 'otp_pending' | 'authed',
  challengeId: string | null,
  startLogin(phone),
  confirmOtp(code),
  logout(),
  hydrate(),  // called once at app start
}
```

`_layout.tsx` calls `hydrate()` on mount; splash gate waits on `status !== 'unknown'`.

## 5. Language auto-detection

Done here because this is the first render: read `expo-localization.getLocales()[0].languageCode`. Match to `['ms','en','zh','ta']`; default to `en`. Persist in auth store — user can override from Account later.

## 6. UX details from PRD §4.1

- Phone input: prominent, full-width, with leading `+60` chip.
- "Continue" disabled until phone is 9–10 digits after country code.
- T&C and Privacy links at bottom — open in system browser (`Linking.openURL`). Links can be `#` placeholders in v0.1; wire real URLs when legal drafts land.
- After successful OTP: `router.replace('/(main)/(tabs)/rides')`.

## 7. Empty / error states

| Scenario | UX |
|----------|----|
| Invalid phone | Inline red hint below input; CTA stays disabled |
| OTP wrong | Red shake on the input boxes + "Code didn't match. Try again." |
| Network stub fails | `ui-store` toast: "Something went wrong. Try again." |

## 8. Checkpoint demo

- Fresh install → prompted for location → enter any MY phone → `+60 12 345 6789` → any code starting with `1` → lands on Rides tab with empty state ("No rides yet"). Done.
