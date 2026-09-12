// Unit tests for the shared phone primitives (`@teeko/shared/utils/phone`).
//
// They live in the backend's vitest project rather than in `packages/shared`
// because that package ships no test runner of its own, and the backend is the
// surface that must not get these rules wrong.

import { describe, expect, it } from 'vitest';

import {
  COUNTRY_BY_ISO2,
  MY_ONLY,
  formatPhoneDisplay,
  isValidPhone,
  parseE164,
  phoneCooldownEnd,
  resolveDriverPhone,
  resolveRiderPhone,
  revalidateE164,
  toE164,
  PHONE_CHANGE_COOLDOWN_MS,
} from '@teeko/shared';

describe('countries dataset', () => {
  it('covers the markets the product names', () => {
    for (const iso2 of ['MY', 'SG', 'ID', 'TH', 'GB', 'US', 'IN']) {
      expect(COUNTRY_BY_ISO2[iso2], iso2).toBeDefined();
      expect(COUNTRY_BY_ISO2[iso2]!.lengths.length, iso2).toBeGreaterThan(0);
    }
    expect(COUNTRY_BY_ISO2.MY!.dialCode).toBe('60');
    expect(COUNTRY_BY_ISO2.SG!.dialCode).toBe('65');
  });
});

describe('toE164 — MY shorthand', () => {
  // The three shapes a Malaysian actually types, all one number.
  it.each(['0123456789', '123456789', '+60123456789', '60123456789', '012-345 6789'])(
    '%s → +60123456789',
    (input) => {
      expect(toE164('MY', input)).toBe('+60123456789');
    },
  );

  it('keeps 10-digit mobiles intact', () => {
    expect(toE164('MY', '0193456789')).toBe('+60193456789');
    expect(toE164('MY', '01123456789')).toBe('+601123456789');
  });

  it('composes other countries', () => {
    expect(toE164('SG', '81234567')).toBe('+6581234567');
    expect(toE164('SG', '+65 8123 4567')).toBe('+6581234567');
    expect(toE164('US', '(415) 555-0132')).toBe('+14155550132');
  });

  it('rejects wrong lengths and unknown countries', () => {
    expect(toE164('MY', '123')).toBeNull();
    expect(toE164('SG', '8123456789012')).toBeNull();
    expect(toE164('ZZ', '123456789')).toBeNull();
  });
});

describe('parseE164 round-trip', () => {
  it('round-trips what the picker stored', () => {
    expect(parseE164('+60123456789', 'MY')).toEqual({
      iso2: 'MY',
      dialCode: '60',
      nationalNumber: '123456789',
    });
    expect(parseE164('+6581234567', 'SG')).toEqual({
      iso2: 'SG',
      dialCode: '65',
      nationalNumber: '81234567',
    });
  });

  it('uses the stored ISO-2 to disambiguate a shared dial code', () => {
    // +1 is the US *and* Canada — the column is what breaks the tie.
    expect(parseE164('+14165550132', 'CA').iso2).toBe('CA');
    expect(parseE164('+14155550132', 'US').iso2).toBe('US');
  });

  it('falls back to a best-effort match when phone_country is NULL (legacy rows)', () => {
    const parsed = parseE164('+60123456789', null);
    expect(parsed.iso2).toBe('MY');
    expect(parsed.nationalNumber).toBe('123456789');
  });
});

describe('rider rules — any country', () => {
  it('accepts a foreign number', () => {
    expect(resolveRiderPhone({ countryCode: 'SG', nationalNumber: '81234567' })).toEqual({
      ok: true,
      e164: '+6581234567',
      iso2: 'SG',
    });
  });

  it('accepts a Malaysian landline — riders are not call targets', () => {
    const res = resolveRiderPhone({ countryCode: 'MY', nationalNumber: '0321234567' });
    expect(res.ok).toBe(true);
  });

  it('reports a blank number as phone_required, not phone_invalid', () => {
    expect(resolveRiderPhone({ countryCode: 'MY', nationalNumber: '  ' })).toEqual({
      ok: false,
      error: 'phone_required',
    });
    expect(resolveRiderPhone({ countryCode: '', nationalNumber: '123456789' })).toEqual({
      ok: false,
      error: 'phone_required',
    });
  });

  it('rejects an unknown country and a bad length distinctly', () => {
    expect(resolveRiderPhone({ countryCode: 'ZZ', nationalNumber: '123456789' })).toEqual({
      ok: false,
      error: 'phone_country_not_allowed',
    });
    expect(resolveRiderPhone({ countryCode: 'MY', nationalNumber: '12' })).toEqual({
      ok: false,
      error: 'phone_invalid',
    });
  });
});

describe('driver rules — MY mobile only', () => {
  it.each(['0123456789', '123456789', '+60123456789'])('accepts %s', (input) => {
    expect(resolveDriverPhone({ nationalNumber: input })).toEqual({
      ok: true,
      e164: '+60123456789',
      iso2: 'MY',
    });
  });

  it('rejects a Malaysian landline with phone_invalid', () => {
    // +603… cannot take the call a rider places mid-trip.
    expect(resolveDriverPhone({ nationalNumber: '0321234567' })).toEqual({
      ok: false,
      error: 'phone_invalid',
    });
    expect(resolveDriverPhone({ countryCode: 'MY', nationalNumber: '+60321234567' })).toEqual({
      ok: false,
      error: 'phone_invalid',
    });
  });

  it('rejects a foreign number with phone_country_not_allowed', () => {
    expect(resolveDriverPhone({ countryCode: 'SG', nationalNumber: '81234567' })).toEqual({
      ok: false,
      error: 'phone_country_not_allowed',
    });
    // Full international form pasted into the Expo app's fixed-+60 field.
    expect(resolveDriverPhone({ nationalNumber: '+6581234567' })).toEqual({
      ok: false,
      error: 'phone_country_not_allowed',
    });
  });

  it('MY_ONLY.isMobile matches the spec pattern exactly', () => {
    expect(MY_ONLY.isMobile('+60123456789')).toBe(true); // 1 + 8 digits
    expect(MY_ONLY.isMobile('+601234567890')).toBe(true); // 1 + 9 digits
    expect(MY_ONLY.isMobile('+6012345678')).toBe(false); // too short
    expect(MY_ONLY.isMobile('+60321234567')).toBe(false); // landline
  });
});

describe('revalidateE164 — admin approval re-check', () => {
  it('passes a stored driver mobile', () => {
    expect(revalidateE164('driver', '+60123456789', 'MY').ok).toBe(true);
  });

  it('catches a stored value the rule no longer allows', () => {
    expect(revalidateE164('driver', '+6581234567', 'SG')).toEqual({
      ok: false,
      error: 'phone_country_not_allowed',
    });
    expect(revalidateE164('driver', '+60321234567', 'MY')).toEqual({
      ok: false,
      error: 'phone_invalid',
    });
  });
});

describe('display helpers', () => {
  it('groups a Malaysian mobile the way the UI shows it', () => {
    expect(formatPhoneDisplay('+60123456789', 'MY')).toBe('+60 12-345 6789');
    expect(formatPhoneDisplay('+601234567890', 'MY')).toBe('+60 12-3456 7890');
  });

  it('returns unparseable legacy values unchanged rather than mangling them', () => {
    expect(formatPhoneDisplay('+999999')).toBe('+999999');
    expect(formatPhoneDisplay(null)).toBe('');
  });
});

describe('cooldown clock', () => {
  it('is 30 days', () => {
    expect(PHONE_CHANGE_COOLDOWN_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('NULL means never changed, so always allowed', () => {
    expect(phoneCooldownEnd(null)).toBeNull();
  });

  it('blocks at day 29 and releases at day 31', () => {
    const day = 24 * 60 * 60 * 1000;
    expect(phoneCooldownEnd(new Date(Date.now() - 29 * day))).not.toBeNull();
    expect(phoneCooldownEnd(new Date(Date.now() - 31 * day))).toBeNull();
  });
});

describe('isValidPhone', () => {
  it('accepts the trunk-prefixed form', () => {
    expect(isValidPhone('MY', '0123456789')).toBe(true);
    expect(isValidPhone('MY', '123456789')).toBe(true);
    expect(isValidPhone('MY', '1234')).toBe(false);
  });
});
