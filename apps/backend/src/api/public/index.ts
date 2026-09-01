import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  getPasswordCooldownByEmail,
  recordPasswordChangedByEmail,
} from '../../modules/auth_otp/password-policy';

const EmailBody = z.object({ email: z.string().email().max(254) });

// Public, unauthenticated routes — trip-share recipient view, content fetch, cancel reasons.
export async function publicRoutes(app: FastifyInstance) {
  app.get('/trip-share/:token', async () => ({ stub: 'trip-share viewer (no app required)' }));
  app.get('/content/:key', async () => ({ stub: 'content version fetch (T&C, agreement, …)' }));
  app.get('/cancel-reasons', async () => ({ stub: 'localized cancel reasons by audience' }));

  // ── Signed-out password reset ────────────────────────────────────────────
  // "Forgot password" runs against Clerk from the client, so the one-change-
  // per-week rule has to be asked for and reported back explicitly: the app
  // checks eligibility before asking Clerk to email a reset code, then records
  // the change once Clerk accepts the new password. The Clerk `user.updated`
  // webhook back-stops both calls, so a client that skips them still gets
  // stamped — these endpoints only exist to fail *early* and legibly.
  //
  // An unknown address always answers "allowed" so this cannot be used to test
  // whether someone holds a Teeko account.
  app.post('/password-reset/eligibility', async (req) => {
    const { email } = EmailBody.parse(req.body);
    const cooldown = await getPasswordCooldownByEmail(email);
    if (!cooldown) return { allowed: true, nextAllowedAt: null, retryInSeconds: 0 };
    return {
      allowed: !cooldown.blocked,
      nextAllowedAt: cooldown.nextAllowedAt,
      retryInSeconds: cooldown.retryInSeconds,
    };
  });

  app.post('/password-reset/record', async (req) => {
    const { email } = EmailBody.parse(req.body);
    await recordPasswordChangedByEmail(email);
    return { ok: true };
  });
}
