import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { isUniqueViolation } from '../../db/errors';
import {
  changePasswordWithOtp,
  sendVerificationOtp,
  verifyOtp,
} from '../../modules/auth_otp/service';
import {
  getOrProvisionRiderMe,
  patchRiderMe,
  type RiderMePatch,
} from '../../modules/identity/service';

// Phone stays deliberately loose — riders type Malaysian numbers in half a
// dozen shapes; the service normalises before it reaches the unique index.
const PhoneField = z
  .string()
  .max(20)
  .regex(/^[+0-9\s\-()]*$/, 'invalid phone number');

const PatchBody = z.object({
  fullName: z.string().min(1).max(100).optional(),
  phone: PhoneField.optional(),
  locale: z.enum(['en', 'ms', 'zh', 'ta']).optional(),
});

const VerifyBody = z.object({
  code: z.string().regex(/^\d{6}$/, 'must be 6 digits'),
});

// The change-password screen asks for a code with `purpose: 'password_change'`,
// which brings the one-change-per-week cooldown into play. Plain email
// verification sends no purpose and is never gated.
const SendOtpBody = z
  .object({ purpose: z.enum(['email_verification', 'password_change']).optional() })
  .optional();

const ChangePasswordBody = VerifyBody.extend({
  newPassword: z.string().min(8, 'must be at least 8 characters').max(200),
});

export async function routes(app: FastifyInstance) {
  app.get('/auth/me', async (req, reply) => {
    if (!req.clerkAuth) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const me = await getOrProvisionRiderMe(req.clerkAuth);
    return me;
  });

  app.patch('/auth/me', async (req, reply) => {
    if (!req.user) {
      // No row exists yet — caller must hit GET /me first to JIT-provision.
      return reply.code(404).send({ error: 'profile_not_provisioned' });
    }
    const patch = PatchBody.parse(req.body) satisfies RiderMePatch;
    try {
      await patchRiderMe(req.user.id, patch);
    } catch (err) {
      // users.phone is UNIQUE — someone else already has this number.
      if (isUniqueViolation(err)) return reply.code(409).send({ error: 'phone_taken' });
      throw err;
    }
    return { ok: true };
  });

  app.post('/auth/send-otp', async (req, reply) => {
    if (!req.clerkAuth) return reply.code(401).send({ error: 'unauthorized' });
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });

    // Re-read profile to get the current email + name.
    const me = await getOrProvisionRiderMe(req.clerkAuth);
    const body = SendOtpBody.parse(req.body ?? {});
    const result = await sendVerificationOtp({
      userId: req.user.id,
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
      return reply
        .code(429)
        .send({ error: 'rate_limited', retryInSeconds: result.retryInSeconds });
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

  app.post('/auth/verify-otp', async (req, reply) => {
    if (!req.clerkAuth) return reply.code(401).send({ error: 'unauthorized' });
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });

    const { code } = VerifyBody.parse(req.body);
    const result = await verifyOtp({
      userId: req.user.id,
      clerkUserId: req.user.clerkUserId,
      code,
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

  // Change password. The OTP proves identity here — Clerk's client-side
  // user.updatePassword() demands the current password, which this screen
  // deliberately does not collect, so the write goes through the admin API.
  app.post('/auth/change-password', async (req, reply) => {
    if (!req.clerkAuth) return reply.code(401).send({ error: 'unauthorized' });
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });

    const { code, newPassword } = ChangePasswordBody.parse(req.body);
    const result = await changePasswordWithOtp({
      userId: req.user.id,
      clerkUserId: req.user.clerkUserId,
      code,
      newPassword,
    });
    switch (result.status) {
      case 'ok':
        return { ok: true };
      case 'cooldown':
        return reply.code(429).send({
          error: 'password_change_cooldown',
          nextAllowedAt: result.nextAllowedAt,
          retryInSeconds: result.retryInSeconds,
        });
      case 'password_rejected':
        return reply
          .code(422)
          .send({ error: 'password_rejected', code: result.code, message: result.message });
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
