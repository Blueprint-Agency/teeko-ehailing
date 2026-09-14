// utils/phone.ts
// One phone-number vocabulary for the backend, both Expo apps and the driver
// web portal. Every surface that accepts a number routes through
// `resolveRiderPhone` / `resolveDriverPhone` so the rules cannot drift apart.
//
// Canonical storage is E.164: '+' then 8-15 digits, nothing else. The ISO-3166
// alpha-2 the user picked is stored alongside it (`users.phone_country`)
// because E.164 alone is ambiguous — '+1' is the US *and* Canada — and the
// picker has to round-trip.
//
// Numbers are deliberately NOT unique. Contact data, not an identity key: one
// person may hold a rider account and a driver account on the same number,
// exactly as they already may on the same email.

import { COUNTRIES, COUNTRY_BY_ISO2, type Country } from '../data/countries';

export { COUNTRIES, COUNTRY_BY_ISO2 };
export type { Country };

/** Error vocabulary shared by the API and the two apps' inline messages. */
export type PhoneError = 'phone_required' | 'phone_invalid' | 'phone_country_not_allowed';

export type PhoneResult =
  | { ok: true; e164: string; iso2: string }
  | { ok: false; error: PhoneError };

/** E.164 shape check. Length bounds per country come from the dataset. */
export const E164_RE = /^\+[1-9]\d{7,14}$/;

function digitsOf(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Drop the trunk prefix a user types out of habit — Malaysians write `012…`
 * for what E.164 calls `12…`. Only stripped when doing so lands on a length
 * the country actually accepts, so a country whose numbers legitimately start
 * with 0 is left alone.
 */
function withoutTrunkPrefix(digits: string, country: Country): string {
  if (!digits.startsWith('0')) return digits;
  const stripped = digits.replace(/^0+/, '');
  return country.lengths.includes(stripped.length) ? stripped : digits;
}

/** Does this national number have a length the country accepts? */
export function isValidPhone(iso2: string, nationalNumber: string): boolean {
  const country = COUNTRY_BY_ISO2[iso2];
  if (!country) return false;
  const digits = withoutTrunkPrefix(digitsOf(nationalNumber), country);
  return country.lengths.includes(digits.length);
}

/**
 * Compose E.164 from a picked country and a typed national number.
 * Returns null when the country is unknown or the length is wrong — callers
 * that need to tell those two apart use `resolveRiderPhone`.
 */
export function toE164(iso2: string, nationalNumber: string): string | null {
  const country = COUNTRY_BY_ISO2[iso2];
  if (!country) return null;
  let digits = digitsOf(nationalNumber);
  // A user who types the full international form into the national field —
  // '+6012…' or '6012…' — means the same number, not a 60-prefixed one.
  if (digits.startsWith(country.dialCode)) {
    const rest = digits.slice(country.dialCode.length);
    if (country.lengths.includes(withoutTrunkPrefix(rest, country).length)) digits = rest;
  }
  digits = withoutTrunkPrefix(digits, country);
  if (!country.lengths.includes(digits.length)) return null;
  const e164 = `+${country.dialCode}${digits}`;
  return E164_RE.test(e164) ? e164 : null;
}

export type ParsedPhone = {
  iso2: string | null;
  dialCode: string;
  nationalNumber: string;
};

/**
 * Split a stored E.164 back into picker state.
 *
 * `storedIso2` is `users.phone_country` and wins whenever it is consistent
 * with the number — that is the whole reason the column exists, since dial
 * codes are shared (+1 is US and CA, +7 is RU and KZ). Without it we fall back
 * to the longest matching dial code, which is a best-effort guess.
 */
export function parseE164(e164: string, storedIso2?: string | null): ParsedPhone {
  const digits = digitsOf(e164);

  const stored = storedIso2 ? COUNTRY_BY_ISO2[storedIso2] : undefined;
  if (stored && digits.startsWith(stored.dialCode)) {
    return {
      iso2: stored.iso2,
      dialCode: stored.dialCode,
      nationalNumber: digits.slice(stored.dialCode.length),
    };
  }

  let best: Country | undefined;
  for (const c of COUNTRIES) {
    if (!digits.startsWith(c.dialCode)) continue;
    if (best && c.dialCode.length <= best.dialCode.length) continue;
    // Prefer a country the remaining digits actually fit; a bare prefix match
    // would hand '+1…' to whichever NANP territory sorted first.
    if (!c.lengths.includes(digits.length - c.dialCode.length)) continue;
    best = c;
  }
  if (best) {
    return {
      iso2: best.iso2,
      dialCode: best.dialCode,
      nationalNumber: digits.slice(best.dialCode.length),
    };
  }

  return { iso2: null, dialCode: '', nationalNumber: digits };
}

/**
 * Grouped for display: '+60 12-345 6789', '+65 8123 4567'.
 * Unparseable input is returned unchanged rather than mangled — a legacy row
 * still has to render as something.
 */
export function formatPhoneDisplay(e164: string | null | undefined, storedIso2?: string | null): string {
  if (!e164) return '';
  const { iso2, dialCode, nationalNumber } = parseE164(e164, storedIso2);
  if (!dialCode) return e164;

  if (iso2 === 'MY' && nationalNumber.startsWith('1')) {
    // Malaysian mobile, the number riders see most: 12-345 6789 / 12-3456 7890.
    const head = nationalNumber.slice(0, 2);
    const rest = nationalNumber.slice(2);
    const split = rest.length > 7 ? 4 : 3;
    return `+${dialCode} ${head}-${rest.slice(0, split)} ${rest.slice(split)}`.trim();
  }

  const groups = nationalNumber.match(/.{1,4}/g) ?? [nationalNumber];
  return `+${dialCode} ${groups.join(' ')}`.trim();
}

/** Mask for "we sent a code to …" copy: '+60 12-345 6789' → '+6012•••6789'. */
export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  if (e164.length <= 8) return e164;
  return `${e164.slice(0, 5)}•••${e164.slice(-4)}`;
}

// ── Per-role rules ──────────────────────────────────────────────────────────

/**
 * Drivers are Malaysia-only, mobile-only.
 *
 * Mobile-only is not fussiness: a rider taps the driver's number mid-trip from
 * `CallChatButtons`, and a landline cannot take that call. A MY landline
 * ('+603…') is therefore rejected as `phone_invalid`, distinct from a foreign
 * number's `phone_country_not_allowed`, so the apps can say which is wrong.
 */
export const MY_ONLY = {
  iso2: 'MY',
  dialCode: '60',
  /** '+60' then a mobile national number: 1 followed by 8 or 9 digits. */
  mobilePattern: /^\+601\d{8,9}$/,
  isMobile(e164: string): boolean {
    return MY_ONLY.mobilePattern.test(e164);
  },
} as const;

/**
 * Rider: any country in the dataset. The client sends the picked ISO-3166
 * alpha-2 and the typed national number; the server composes and validates.
 */
export function resolveRiderPhone(input: {
  countryCode?: string | null;
  nationalNumber?: string | null;
}): PhoneResult {
  const iso2 = (input.countryCode ?? '').trim().toUpperCase();
  const national = (input.nationalNumber ?? '').trim();
  if (!iso2 || !national || !digitsOf(national)) return { ok: false, error: 'phone_required' };
  if (!COUNTRY_BY_ISO2[iso2]) return { ok: false, error: 'phone_country_not_allowed' };
  const e164 = toE164(iso2, national);
  if (!e164) return { ok: false, error: 'phone_invalid' };
  return { ok: true, e164, iso2 };
}

/**
 * Driver: '+60' is fixed in the UI, but the server still re-checks — the Expo
 * app is not a trust boundary. Accepts '012…', '12…', '6012…' and '+6012…',
 * all of which mean the same number.
 */
export function resolveDriverPhone(input: {
  countryCode?: string | null;
  nationalNumber?: string | null;
}): PhoneResult {
  const national = (input.nationalNumber ?? '').trim();
  if (!digitsOf(national)) return { ok: false, error: 'phone_required' };

  // A country was sent explicitly (web portal, or a hand-rolled request): it
  // must be MY. An omitted country is the Expo app's fixed '+60' chip.
  const iso2 = (input.countryCode ?? MY_ONLY.iso2).trim().toUpperCase();
  if (iso2 !== MY_ONLY.iso2) return { ok: false, error: 'phone_country_not_allowed' };

  const digits = digitsOf(national);
  // '+60…' typed in full, or an international-format paste: reject any other
  // country code outright rather than silently re-homing it to Malaysia.
  if (national.startsWith('+') && !digits.startsWith(MY_ONLY.dialCode)) {
    return { ok: false, error: 'phone_country_not_allowed' };
  }

  const e164 = toE164(MY_ONLY.iso2, national);
  if (!e164) return { ok: false, error: 'phone_invalid' };
  if (!MY_ONLY.isMobile(e164)) return { ok: false, error: 'phone_invalid' };
  return { ok: true, e164, iso2: MY_ONLY.iso2 };
}

/** Role-agnostic entry point for code that already knows which side it is on. */
export function resolvePhoneForRole(
  role: 'rider' | 'driver',
  input: { countryCode?: string | null; nationalNumber?: string | null },
): PhoneResult {
  return role === 'driver' ? resolveDriverPhone(input) : resolveRiderPhone(input);
}

/**
 * Re-validate a number that is already in E.164 — used at admin approval time,
 * where the per-role country rule may have tightened since submission.
 */
export function revalidateE164(
  role: 'rider' | 'driver',
  e164: string,
  iso2?: string | null,
): PhoneResult {
  const parsed = parseE164(e164, iso2);
  if (!parsed.iso2) return { ok: false, error: 'phone_invalid' };
  return resolvePhoneForRole(role, {
    countryCode: parsed.iso2,
    nationalNumber: parsed.nationalNumber,
  });
}

/** 30 days, one clock, both roles. The clock is `users.phone_changed_at`. */
export const PHONE_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

/** Null when the user may change their number right now. */
export function phoneCooldownEnd(phoneChangedAt: Date | string | null | undefined): Date | null {
  if (!phoneChangedAt) return null;
  const at = phoneChangedAt instanceof Date ? phoneChangedAt : new Date(phoneChangedAt);
  if (Number.isNaN(at.getTime())) return null;
  const end = new Date(at.getTime() + PHONE_CHANGE_COOLDOWN_MS);
  return end.getTime() > Date.now() ? end : null;
}
