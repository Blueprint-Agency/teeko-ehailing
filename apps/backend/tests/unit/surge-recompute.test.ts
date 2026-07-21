import { describe, expect, it } from 'vitest';

import { easeToward, targetMultiplier } from '../../src/jobs/surge-recompute.worker';

describe('targetMultiplier', () => {
  it('stays at 1.0x when there is no demand', () => {
    expect(targetMultiplier(0, 0)).toBe(1.0);
    expect(targetMultiplier(0, 10)).toBe(1.0);
  });

  it('does not surge while supply comfortably exceeds demand', () => {
    expect(targetMultiplier(2, 10)).toBe(1.0);
  });

  it('climbs as demand outpaces supply', () => {
    expect(targetMultiplier(5, 10)).toBe(1.1);
    expect(targetMultiplier(10, 10)).toBe(1.2);
    expect(targetMultiplier(15, 10)).toBe(1.3);
    expect(targetMultiplier(20, 10)).toBe(1.5);
    expect(targetMultiplier(40, 10)).toBe(2.0);
  });

  it('treats demand with zero available drivers as the top of the ladder', () => {
    expect(targetMultiplier(3, 0)).toBe(2.0);
  });

  it('never exceeds the automatic ceiling — higher rates stay a human decision', () => {
    expect(targetMultiplier(1000, 1)).toBeLessThanOrEqual(2.0);
  });
});

describe('easeToward', () => {
  it('moves straight to the target when the gap is small', () => {
    expect(easeToward(1.2, 1.3)).toBe(1.3);
  });

  it('caps a single pass so pricing cannot whipsaw', () => {
    expect(easeToward(1.0, 2.0)).toBe(1.3);
    expect(easeToward(2.0, 1.0)).toBe(1.7);
  });

  it('eases back down to the floor over successive passes', () => {
    let rate = 2.0;
    for (let i = 0; i < 10; i += 1) rate = easeToward(rate, 1.0);
    expect(rate).toBe(1.0);
  });

  it('clamps to the allowed band', () => {
    expect(easeToward(3.0, 9.9)).toBeLessThanOrEqual(3.0);
    expect(easeToward(1.0, 0.1)).toBeGreaterThanOrEqual(1.0);
  });

  it('rounds to one decimal so riders see a clean rate', () => {
    const value = easeToward(1.0, 1.77);
    expect(value).toBe(Math.round(value * 10) / 10);
  });
});
