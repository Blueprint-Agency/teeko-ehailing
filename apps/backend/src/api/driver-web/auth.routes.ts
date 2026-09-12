import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { driverClerk } from '../../external/clerk';
import { sendVerificationOtp, verifyOtp } from '../../modules/auth_otp/service';
import { setInitialPhone } from '../../modules/identity/phone';
import { getFieldStates } from '../../modules/profile-changes';
import { acceptPdpaConsent, getOrProvisionDriverMe } from '../../modules/identity/service';

// The portal's register form shows a static '+60' chip, so `countryCode` is
// optional and defaults to 'MY' — but it is still validated, because the Expo
// app and a hand-rolled request reach the same service.
const PhoneBody = z.object({
  countryCode: z.string().length(2).optional(),
  nationalNumber: z.string().min(1).max(24),
});

// ---------------------------------------------------------------------------
// Driver web portal auth. Clerk (driver instance) owns the credential — this
// module only mirrors the Clerk user into our tables and records PDPA consent.
//
// Replaced the previous email + password flow (which itself replaced phone +
// OTP). There is no login/register endpoint any more: the browser authenticates
// against Clerk directly and calls GET /auth/me with the resulting bearer token.
//
// Clerk authenticating a driver never means the driver may drive — that is
// gated by driver_applications.state and the admin EVP approval.
// ---------------------------------------------------------------------------

const VerifyBody = z.object({
  code: z.string().regex(/^\d{6}$/, 'must be 6 digits'),
});

// Same purpose flag as the apps: a `password_change` code is refused while the
// account is inside its one-change-per-week cooldown.
const SendOtpBody = z
  .object({ purpose: z.enum(['email_verification', 'password_change', 'phone_change']).optional() })
  .optional();

export async function routes(app: FastifyInstance) {
  // GET /api/v1/driver-web/auth/me
  // JIT-provisions users + user_roles(driver) + external_identities +
  // driver_profiles(pending) + driver_applications(phone_entered) on the first
  // call after Clerk sign-up. Idempotent.
  app.get('/me', async (req, reply) => {
    if (!req.clerkAuth) {
      // Dev-header bypass authenticates without Clerk claims; there is nothing
      // to provision from in that case, so just resolve the existing row.
      if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
      return reply.code(400).send({ error: 'no_clerk_claims' });
    }
    return await getOrProvisionDriverMe(req.clerkAuth);
  });

  // POST /api/v1/driver-web/auth/consent
  // PDPA 2010 consent, captured by our own checkbox on the sign-up form and
  // stored in our DB (not Clerk metadata) so the trail survives for APAD/JPJ.
  // Called immediately after Clerk sign-up completes. First consent wins.
  app.post('/consent', async (req, reply) => {
    if (!req.clerkAuth && !req.user) return reply.code(401).send({ error: 'unauthorized' });
    const me = req.clerkAuth ? await getOrProvisionDriverMe(req.clerkAuth) : null;
    const userId = me?.user.id ?? req.user?.id;
    if (!userId) return reply.code(404).send({ error: 'profile_not_provisioned' });
    await acceptPdpaConsent(userId);
    return { ok: true };
  });

  // POST /api/v1/driver-web/auth/phone-initial
  // Registration capture and the legacy-NULL completion gate. Called straight
  // after Clerk sign-up (the portal collects the number on the register form)
  // and again by the blocking add-phone screen for an account that predates it.
  //
  // No OTP: there is no existing number to protect. The write refuses to
  // overwrite an existing number, so this is not a route around the review
  // queue — a driver who already has a number must go through it.
  app.post('/phone-initial', async (req, reply) => {
    if (!req.clerkAuth && !req.user) return reply.code(401).send({ error: 'unauthorized' });
    const me = req.clerkAuth ? await getOrProvisionDriverMe(req.clerkAuth) : null;
    const userId = me?.user.id ?? req.user?.id;
    if (!userId) return reply.code(404).send({ error: 'profile_not_provisioned' });

    const body = PhoneBody.parse(req.body);
    const result = await setInitialPhone({
      userId,
      // Pins the number to a Malaysian mobile: a rider dials it mid-trip, and
      // it sits on the APAD/JPJ operator record.
      role: 'driver',
      countryCode: body.countryCode ?? 'MY',
      nationalNumber: body.nationalNumber,
    });
    if (result.status === 'invalid') return reply.code(400).send({ error: result.error });
    if (result.status === 'already_set') {
      return reply.code(409).send({ error: 'phone_already_set', phone: result.phone });
    }
    return { ok: true, phone: result.phone, phoneCountry: result.phoneCountry };
  });

  // GET /api/v1/driver-web/auth/phone-change-state
  // Read-only. The portal does not change numbers — that happens in the app,
  // where the OTP step lives — but it has to show the same pending / early /
  // cooldown state, or the two surfaces disagree about what is in review.
  app.get('/phone-change-state', async (req, reply) => {
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });
    const states = await getFieldStates(req.user.id);
    const phone = states.find((s) => s.field === 'phone');
    return {
      pending: phone?.pending ?? null,
      nextAllowedAt: phone?.nextAllowedAt ?? null,
      canRequestEarly: phone?.canRequestEarly ?? false,
      lastDecision: phone?.lastDecision ?? null,
    };
  });

  app.post('/send-otp', async (req, reply) => {
    if (!req.clerkAuth) return reply.code(401).send({ error: 'unauthorized' });

    const me = await getOrProvisionDriverMe(req.clerkAuth);
    const body = SendOtpBody.parse(req.body ?? {});
    const result = await sendVerificationOtp({
      userId: me.user.id,
      email: me.user.email,
      fullName: me.user.fullName,
      purpose: body?.purpose,
    });
    if (result.status === 'password_cooldown') {
      return reply.code(429).send({
        error: 'password_change_cooldown',
        nextAllowedAt: result.nextAllowedAt,
        retryInSeconds: result.retryInSeconds,
      });
    }
    if (result.status === 'rate_limited') {
      return reply.code(429).send({ error: 'rate_limited', retryInSeconds: result.retryInSeconds });
    }
    if (result.status === 'no_email') {
      return reply.code(400).send({ error: 'no_email_on_account' });
    }
    if (result.status === 'delivery_failed') {
      return reply.code(503).send({
        error: 'email_delivery_failed',
        providerStatusCode: result.providerStatusCode,
        providerMessage: result.providerMessage,
      });
    }
    return { ok: true };
  });

  app.post('/verify-otp', async (req, reply) => {
    if (!req.clerkAuth) return reply.code(401).send({ error: 'unauthorized' });
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });

    const { code } = VerifyBody.parse(req.body);
    const result = await verifyOtp({
      userId: req.user.id,
      clerkUserId: req.user.clerkUserId,
      code,
      // Drivers live in the driver Clerk instance, not the rider default.
      clerkClient: driverClerk,
    });
    switch (result.status) {
      case 'verified':
        return { ok: true };
      case 'no_active_code':
        return reply.code(400).send({ error: 'no_active_code' });
      case 'expired':
        return reply.code(400).send({ error: 'expired' });
      case 'too_many_attempts':
        return reply.code(429).send({ error: 'too_many_attempts' });
      case 'incorrect':
        return reply.code(400).send({ error: 'incorrect' });
    }
  });
}
