import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { sendVerificationOtp, verifyOtp } from '../../modules/auth_otp/service';
import {
  getOrProvisionRiderMe,
  patchRiderMe,
  type RiderMePatch,
} from '../../modules/identity/service';

const PatchBody = z.object({
  fullName: z.string().min(1).max(100).optional(),
  locale: z.enum(['en', 'ms', 'zh', 'ta']).optional(),
});

const VerifyBody = z.object({
  code: z.string().regex(/^\d{6}$/, 'must be 6 digits'),
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
    await patchRiderMe(req.user.id, patch);
    return { ok: true };
  });

  app.post('/auth/send-otp', async (req, reply) => {
    if (!req.clerkAuth) return reply.code(401).send({ error: 'unauthorized' });
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });

    // Re-read profile to get the current email + name.
    const me = await getOrProvisionRiderMe(req.clerkAuth);
    const result = await sendVerificationOtp({
      userId: req.user.id,
      email: me.user.email,
      fullName: me.user.fullName,
    });
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
}
