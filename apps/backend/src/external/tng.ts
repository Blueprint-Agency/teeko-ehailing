// External provider client — Touch 'n Go eWallet (the sole e-wallet in v1.0).
//
// TNG charges are made *to Teeko's account* (not a Connect destination charge);
// the driver's net is moved afterwards with a separate Stripe Transfer (spec §6
// fallback). v0.1 ships a mock so the TNG branch of chargeRider() runs locally.
//
// v1.0: replace the mock with the TNG eWallet SDK using TNG_MERCHANT_ID /
// TNG_API_KEY. `chargeAgreement` maps to a TNG "deduct via agreement" call.

import { randomBytes } from 'node:crypto';
import { env } from '../config/env';

const rid = (prefix: string) => `${prefix}_${randomBytes(12).toString('hex')}`;

export type TngChargeResult = {
  id: string;
  status: 'succeeded' | 'failed';
};

export interface TngGateway {
  /**
   * Deduct `amountCents` from a rider's reusable payment agreement.
   * `idempotencyKey` makes a retried deduction safe (spec §14).
   */
  chargeAgreement(
    agreementId: string,
    amountCents: number,
    idempotencyKey: string,
  ): Promise<TngChargeResult>;
}

class MockTngGateway implements TngGateway {
  async chargeAgreement(
    agreementId: string,
    _amountCents: number,
    _idempotencyKey: string,
  ): Promise<TngChargeResult> {
    if (agreementId.includes('decline')) return { id: rid('tng'), status: 'failed' };
    return { id: rid('tng'), status: 'succeeded' };
  }
}

export const isMockTng = !env.TNG_MERCHANT_ID || !env.TNG_API_KEY;

// v0.1 always uses the mock (no TNG SDK dependency yet).
export const tng: TngGateway = new MockTngGateway();
