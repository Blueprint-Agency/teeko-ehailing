import type { FastifyReply, FastifyRequest } from 'fastify';

import { verifyClerkToken, type ClerkClaims } from '../../external/clerk';
import { findUserByExternalId } from '../../modules/identity/repo';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      role: 'rider' | 'driver' | 'admin_super' | 'admin_ops' | 'admin_finance';
      clerkUserId: string;
    };
    clerkAuth?: ClerkClaims;
  }
}

export async function clerkAuthVerify(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return reply.code(401).send({ error: 'unauthorized', message: 'missing bearer token' });
  }
  const token = header.slice(7).trim();
  let claims: ClerkClaims;
  try {
    claims = await verifyClerkToken(token);
  } catch (err) {
    req.log.warn({ err }, 'clerk token verification failed');
    return reply.code(401).send({ error: 'unauthorized', message: 'invalid token' });
  }
  req.clerkAuth = claims;
  const row = await findUserByExternalId('clerk', claims.sub);
  if (row) {
    req.user = { id: row.id, role: row.role, clerkUserId: claims.sub };
  }
}

// Backwards-compat re-export for any module that still imports `auth0Verify`.
// Will be removed in the cleanup task once all imports are migrated.
export { clerkAuthVerify as auth0Verify };
