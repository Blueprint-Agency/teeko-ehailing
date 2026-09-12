import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  changePasswordWithOtp,
  sendVerificationOtp,
  verifyOtp,
} from '../../modules/auth_otp/service';
import { clearAvatar, readAvatarFile, setAvatar } from '../../modules/identity/avatar';
import { changePhoneSelfService, setInitialPhone } from '../../modules/identity/phone';
import {
  cancelProfileChange,
  getFieldStates,
  submitProfileChange,
} from '../../modules/profile-changes';
import {
  getOrProvisionRiderMe,
  patchRiderMe,
  type RiderMePatch,
} from '../../modules/identity/service';

// `phone` is deliberately NOT in here. A number change needs an email OTP and
// is capped at one per 30 days, neither of which belongs in a generic profile
// PATCH — POST /auth/me/phone owns it. A client that still sends `phone` gets
// `400 use_phone_endpoint` rather than a silent no-op.
const PatchBody = z.object({
  fullName: z.string().min(1).max(100).optional(),
  locale: z.enum(['en', 'ms', 'zh', 'ta']).optional(),
});

/** The picker's two halves: the ISO-3166 alpha-2 and the typed national number. */
const PhoneBody = z.object({
  countryCode: z.string().length(2),
  nationalNumber: z.string().min(1).max(24),
});

const ChangePhoneBody = PhoneBody.extend({
  otpCode: z.string().regex(/^\d{6}$/, 'must be 6 digits'),
});

const PhoneChangeRequestBody = ChangePhoneBody.extend({
  // Required: the reviewer is being asked to override a cooldown and needs to
  // know why.
  reason: z.string().min(1).max(300),
});

const VerifyBody = z.object({
  code: z.string().regex(/^\d{6}$/, 'must be 6 digits'),
});

// The change-password screen asks for a code with `purpose: 'password_change'`,
// which brings the one-change-per-week cooldown into play. Plain email
// verification sends no purpose and is never gated.
const SendOtpBody = z
  .object({
    purpose: z.enum(['email_verification', 'password_change', 'phone_change']).optional(),
  })
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
    // An old client still sending `phone` here would otherwise have its number
    // silently dropped. Fail loudly instead, and point it at the endpoint that
    // enforces the OTP and the cooldown.
    if (req.body && typeof req.body === 'object' && 'phone' in req.body) {
      return reply.code(400).send({ error: 'use_phone_endpoint' });
    }
    const patch = PatchBody.parse(req.body) satisfies RiderMePatch;
    await patchRiderMe(req.user.id, patch);
    return { ok: true };
  });

  // POST /auth/me/avatar — multipart/form-data, field name "file".
  // Self-service: a rider's picture is display-only and carries no compliance
  // weight, so it applies immediately rather than queueing for review.
  app.post('/auth/me/avatar', async (req, reply) => {
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });
    const file = await readAvatarFile(req);
    const avatarUrl = await setAvatar(req.user.id, file);
    return { avatarUrl };
  });

  app.delete('/auth/me/avatar', async (req, reply) => {
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });
    await clearAvatar(req.user.id);
    return { avatarUrl: null };
  });

  // ── Phone ────────────────────────────────────────────────────────────────
  // Three endpoints rather than one PATCH field, because a phone change is
  // three different things depending on where the rider is in the 30-day
  // window: an immediate OTP-guarded write, a request for an early exception,
  // or — on a legacy NULL row — simply filling in a missing number.

  // POST /auth/me/phone-initial — registration capture and the legacy-NULL
  // completion gate. No OTP: there is no existing number to protect, and the
  // write refuses to overwrite one, so this cannot be used to skip the OTP.
  app.post('/auth/me/phone-initial', async (req, reply) => {
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });
    const body = PhoneBody.parse(req.body);
    const result = await setInitialPhone({
      userId: req.user.id,
      role: 'rider',
      countryCode: body.countryCode,
      nationalNumber: body.nationalNumber,
    });
    if (result.status === 'invalid') return reply.code(400).send({ error: result.error });
    if (result.status === 'already_set') {
      return reply.code(409).send({ error: 'phone_already_set', phone: result.phone });
    }
    return { ok: true, phone: result.phone, phoneCountry: result.phoneCountry };
  });

  // POST /auth/me/phone — self-service change. OTP + cooldown; the code is
  // consumed by this call, so it cannot be verified once and reused.
  app.post('/auth/me/phone', async (req, reply) => {
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });
    const body = ChangePhoneBody.parse(req.body);
    const result = await changePhoneSelfService({
      userId: req.user.id,
      clerkUserId: req.user.clerkUserId,
      role: 'rider',
      countryCode: body.countryCode,
      nationalNumber: body.nationalNumber,
      otpCode: body.otpCode,
    });
    switch (result.status) {
      case 'ok':
        return {
          ok: true,
          phone: result.phone,
          phoneCountry: result.phoneCountry,
          nextAllowedAt: result.nextAllowedAt,
        };
      case 'unchanged':
        return { ok: true, unchanged: true };
      case 'invalid':
        return reply.code(400).send({ error: result.error });
      case 'cooldown':
        // The app turns this into "You can change it again on 12 Oct" plus the
        // "Request an earlier change" affordance.
        return reply.code(409).send({ error: 'phone_cooldown', nextAllowedAt: result.nextAllowedAt });
      case 'otp_invalid':
        return reply
          .code(result.reason === 'too_many_attempts' ? 429 : 400)
          .send({ error: 'otp_invalid', reason: result.reason });
    }
  });

  // POST /auth/me/phone-change-request — the early-change request raised from
  // inside the window. Still OTP-guarded: it is a request to change a number,
  // and proving the email is what makes it attributable.
  app.post('/auth/me/phone-change-request', async (req, reply) => {
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });
    const body = PhoneChangeRequestBody.parse(req.body);

    const verified = await verifyOtp({
      userId: req.user.id,
      clerkUserId: req.user.clerkUserId,
      code: body.otpCode,
      purpose: 'phone_change',
    });
    if (verified.status !== 'verified') {
      return reply
        .code(verified.status === 'too_many_attempts' ? 429 : 400)
        .send({ error: 'otp_invalid', reason: verified.status });
    }

    const result = await submitProfileChange({
      userId: req.user.id,
      role: 'rider',
      field: 'phone',
      value: body.nationalNumber,
      countryCode: body.countryCode,
      reason: body.reason,
    });
    switch (result.status) {
      case 'submitted':
        return { ok: true, request: result.request };
      case 'already_pending':
        // One open request at a time — to amend, withdraw and re-submit.
        return reply.code(409).send({ error: 'already_pending', request: result.request });
      case 'invalid':
        return reply.code(400).send({ error: result.error });
      case 'unchanged':
        return reply.code(400).send({ error: 'phone_unchanged' });
      case 'reason_required':
        return reply.code(400).send({ error: 'reason_required' });
      case 'cooldown':
        return reply.code(409).send({ error: 'phone_cooldown', nextAllowedAt: result.nextAllowedAt });
    }
  });

  // GET /auth/me/phone-change-request — what the field should render: the open
  // request, the unlock date, and whether an early request is still on offer.
  app.get('/auth/me/phone-change-request', async (req, reply) => {
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

  // DELETE /auth/me/phone-change-request — withdraw. Costs nothing: the clock
  // only ever starts when a change is actually applied.
  app.delete('/auth/me/phone-change-request', async (req, reply) => {
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });
    const states = await getFieldStates(req.user.id);
    const pending = states.find((s) => s.field === 'phone')?.pending;
    if (!pending) return reply.code(404).send({ error: 'no_pending_request' });
    await cancelProfileChange(req.user.id, pending.id);
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
