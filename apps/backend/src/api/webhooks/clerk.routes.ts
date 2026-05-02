import type { FastifyInstance } from 'fastify';
import { Webhook } from 'svix';

import { env } from '../../config/env';
import { applyClerkWebhook } from '../../modules/identity/service';

type ClerkUserEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: {
    id: string;
    email_addresses?: Array<{ id: string; email_address: string }>;
    primary_email_address_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
};

export async function routes(app: FastifyInstance) {
  // Svix verification needs the raw body. Register a content-type parser
  // scoped to this plugin instance that hands us both the raw string and the
  // parsed JSON.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        done(null, { raw: body, parsed: JSON.parse(body as string) });
      } catch (err) {
        done(err as Error);
      }
    },
  );

  app.post('/clerk', async (req, reply) => {
    const svixId = req.headers['svix-id'];
    const svixTs = req.headers['svix-timestamp'];
    const svixSig = req.headers['svix-signature'];
    if (
      typeof svixId !== 'string' ||
      typeof svixTs !== 'string' ||
      typeof svixSig !== 'string'
    ) {
      return reply.code(400).send({ error: 'missing_svix_headers' });
    }

    const payload = req.body as { raw: string; parsed: ClerkUserEvent };
    let evt: ClerkUserEvent;
    try {
      // Webhook constructor base64-decodes the secret and throws on a
      // malformed secret; verify() throws on a bad signature. Both paths
      // collapse to a 400 invalid_signature response.
      const wh = new Webhook(env.CLERK_WEBHOOK_SIGNING_SECRET);
      evt = wh.verify(payload.raw, {
        'svix-id': svixId,
        'svix-timestamp': svixTs,
        'svix-signature': svixSig,
      }) as ClerkUserEvent;
    } catch (err) {
      req.log.warn({ err }, 'clerk webhook signature verification failed');
      return reply.code(400).send({ error: 'invalid_signature' });
    }

    if (evt.type === 'user.created') {
      // No-op: JIT handles creation on first /me call.
      return { ok: true, ignored: 'user.created (handled by JIT)' };
    }

    const primary = evt.data.email_addresses?.find(
      (e) => e.id === evt.data.primary_email_address_id,
    );
    const email = primary?.email_address ?? null;

    // Webhook semantics: Clerk sends `null` for cleared name fields. Map to
    // `null` through to updateRiderFields so a user clearing their name in
    // Clerk is mirrored in our DB. (This is the webhook path; the PATCH /me
    // path keeps `undefined`-means-don't-touch semantics.)
    const fullNameRaw = [evt.data.first_name, evt.data.last_name]
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .join(' ')
      .trim();
    const fullName: string | null = fullNameRaw || null;

    await applyClerkWebhook({
      type: evt.type,
      clerkUserId: evt.data.id,
      email,
      fullName,
    });
    return { ok: true };
  });
}
