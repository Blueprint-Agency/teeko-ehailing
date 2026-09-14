// Service-level tests for the phone-change guards.
//
// The repo has no live Postgres in CI, so `db` is stubbed with a chainable
// recorder rather than run against a real table. That is enough to pin the
// part that actually matters here: the *order* of the guards, and which of
// them can consume an OTP or write a row.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const DAY = 24 * 60 * 60 * 1000;

/** What the next `select … limit(1)` should resolve to. */
let selectRows: unknown[] = [];
/** What the next `update … returning()` should resolve to. */
let returningRows: unknown[] = [];
/** Every `.set()` payload the code wrote, in order. */
let writes: Record<string, unknown>[] = [];

function chain(final: () => Promise<unknown>) {
  const node: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'orderBy', 'innerJoin', 'leftJoin']) {
    node[m] = () => node;
  }
  node.limit = () => final();
  node.returning = () => Promise.resolve(returningRows);
  node.then = (res: (v: unknown) => unknown) => final().then(res);
  return node;
}

vi.mock('../../src/config/db', () => ({
  db: {
    select: () => chain(() => Promise.resolve(selectRows)),
    update: () => ({
      set: (payload: Record<string, unknown>) => {
        writes.push(payload);
        return chain(() => Promise.resolve(returningRows));
      },
    }),
  },
}));

vi.mock('../../src/modules/auth_otp/service', () => ({
  verifyOtp: vi.fn(),
}));

import { verifyOtp } from '../../src/modules/auth_otp/service';
import { changePhoneSelfService, setInitialPhone } from '../../src/modules/identity/phone';

const BASE = {
  userId: 'user-1',
  clerkUserId: 'clerk-1',
  role: 'rider' as const,
  countryCode: 'MY',
  nationalNumber: '0123456789',
  otpCode: '123456',
};

/** A rider whose number last changed `daysAgo` days ago. */
function riderChangedDaysAgo(daysAgo: number | null) {
  selectRows = [
    {
      phone: '+60111111111',
      phoneCountry: 'MY',
      phoneChangedAt: daysAgo === null ? null : new Date(Date.now() - daysAgo * DAY),
    },
  ];
}

beforeEach(() => {
  selectRows = [];
  returningRows = [];
  writes = [];
  vi.mocked(verifyOtp).mockReset();
  vi.mocked(verifyOtp).mockResolvedValue({ status: 'verified' });
});

describe('changePhoneSelfService — cooldown boundary', () => {
  it('blocks on day 29 and does not spend the OTP', async () => {
    riderChangedDaysAgo(29);
    const res = await changePhoneSelfService(BASE);
    expect(res.status).toBe('cooldown');
    // The whole point of checking the cooldown first: a user inside the window
    // must not burn a code to find that out.
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it('allows on day 31 and stamps the clock', async () => {
    riderChangedDaysAgo(31);
    const res = await changePhoneSelfService(BASE);
    expect(res.status).toBe('ok');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.phone).toBe('+60123456789');
    expect(writes[0]!.phoneCountry).toBe('MY');
    expect(writes[0]!.phoneChangedAt).toBeInstanceOf(Date);
  });

  it('treats a never-changed number as always allowed', async () => {
    riderChangedDaysAgo(null);
    const res = await changePhoneSelfService(BASE);
    expect(res.status).toBe('ok');
  });

  it('reports the exact unlock date the UI has to print', async () => {
    riderChangedDaysAgo(10);
    const res = await changePhoneSelfService(BASE);
    if (res.status !== 'cooldown') throw new Error('expected cooldown');
    const unlock = new Date(res.nextAllowedAt).getTime();
    // 30 days after the change = 20 days from now.
    expect(Math.round((unlock - Date.now()) / DAY)).toBe(20);
  });
});

describe('changePhoneSelfService — OTP', () => {
  it('spends a phone_change code, not a code minted for anything else', async () => {
    riderChangedDaysAgo(null);
    await changePhoneSelfService(BASE);
    expect(verifyOtp).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'phone_change', code: '123456' }),
    );
  });

  it('writes nothing when the code is wrong', async () => {
    riderChangedDaysAgo(null);
    vi.mocked(verifyOtp).mockResolvedValue({ status: 'incorrect' });
    const res = await changePhoneSelfService(BASE);
    expect(res).toEqual({ status: 'otp_invalid', reason: 'incorrect' });
    expect(writes).toHaveLength(0);
  });

  it('a consumed code cannot be replayed — the second call has no active code', async () => {
    riderChangedDaysAgo(null);
    await changePhoneSelfService(BASE);
    // verifyOtp consumes on success, so the replay finds nothing live.
    vi.mocked(verifyOtp).mockResolvedValue({ status: 'no_active_code' });
    riderChangedDaysAgo(null);
    const replay = await changePhoneSelfService({ ...BASE, nationalNumber: '0199999999' });
    expect(replay).toEqual({ status: 'otp_invalid', reason: 'no_active_code' });
    expect(writes).toHaveLength(1); // only the first call wrote
  });
});

describe('changePhoneSelfService — format is checked before anything is spent', () => {
  it('rejects a non-MY number for a driver', async () => {
    riderChangedDaysAgo(null);
    const res = await changePhoneSelfService({
      ...BASE,
      role: 'driver',
      countryCode: 'SG',
      nationalNumber: '81234567',
    });
    expect(res).toEqual({ status: 'invalid', error: 'phone_country_not_allowed' });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('rejects a MY landline for a driver', async () => {
    riderChangedDaysAgo(null);
    const res = await changePhoneSelfService({
      ...BASE,
      role: 'driver',
      nationalNumber: '0321234567',
    });
    expect(res).toEqual({ status: 'invalid', error: 'phone_invalid' });
  });

  it('accepts that same landline for a rider', async () => {
    riderChangedDaysAgo(null);
    const res = await changePhoneSelfService({ ...BASE, nationalNumber: '0321234567' });
    expect(res.status).toBe('ok');
  });

  it('is a no-op when the number and country are unchanged', async () => {
    selectRows = [{ phone: '+60123456789', phoneCountry: 'MY', phoneChangedAt: null }];
    const res = await changePhoneSelfService(BASE);
    expect(res).toEqual({ status: 'unchanged' });
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
});

describe('setInitialPhone', () => {
  it('fills a NULL number without an OTP and leaves the clock NULL', async () => {
    returningRows = [{ phone: '+60123456789' }];
    const res = await setInitialPhone({
      userId: 'user-1',
      role: 'rider',
      countryCode: 'MY',
      nationalNumber: '0123456789',
    });
    expect(res).toEqual({ status: 'ok', phone: '+60123456789', phoneCountry: 'MY' });
    expect(verifyOtp).not.toHaveBeenCalled();
    // A first change must never be blocked by a cooldown the user never used.
    expect(writes[0]).not.toHaveProperty('phoneChangedAt');
  });

  it('refuses to overwrite an existing number, so it is no back door', async () => {
    // The conditional UPDATE matched nothing: the row already had a phone.
    returningRows = [];
    selectRows = [{ phone: '+60111111111' }];
    const res = await setInitialPhone({
      userId: 'user-1',
      role: 'rider',
      countryCode: 'MY',
      nationalNumber: '0123456789',
    });
    expect(res).toEqual({ status: 'already_set', phone: '+60111111111' });
  });

  it('applies the driver country rule', async () => {
    const res = await setInitialPhone({
      userId: 'user-1',
      role: 'driver',
      countryCode: 'SG',
      nationalNumber: '81234567',
    });
    expect(res).toEqual({ status: 'invalid', error: 'phone_country_not_allowed' });
  });
});
