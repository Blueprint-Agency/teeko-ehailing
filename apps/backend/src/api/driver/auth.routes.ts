import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sendVerificationOtp, verifyOtp } from '../../modules/auth_otp/service';
import { getOrProvisionDriverMe } from '../../modules/identity/service';

const VerifyBody = z.object({
  code: z.string().regex(/^\d{6}$/, 'must be 6 digits'),
});

export async function routes(app: FastifyInstance) {
  // GET /api/v1/driver/auth/me
  // JIT-provisions the driver row on first call after Clerk signup.
  app.get('/auth/me', async (req, reply) => {
    if (!req.clerkAuth) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const me = await getOrProvisionDriverMe(req.clerkAuth);
    return me;
  });

  app.post('/auth/send-otp', async (req, reply) => {
    if (!req.clerkAuth) return reply.code(401).send({ error: 'unauthorized' });
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });

    const me = await getOrProvisionDriverMe(req.clerkAuth);
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
