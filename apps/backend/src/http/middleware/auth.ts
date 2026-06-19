import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';

import { verifyRiderClerkToken, verifyDriverClerkToken, type ClerkClaims } from '../../external/clerk';
import { findUserByExternalId } from '../../modules/identity/repo';
import { env } from '../../config/env';
import { db } from '../../config/db';
import { userRoles } from '../../db/schema/identity';

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

const DEV_TOKEN = 'dev-bypass-token';
const DEV_USER_ID = process.env.DEV_USER_ID ?? 'dev-driver-001';
const DEV_ROLE = (process.env.DEV_ROLE ?? 'driver') as 'rider' | 'driver' | 'admin_super' | 'admin_ops' | 'admin_finance';

export async function clerkAuthVerify(req: FastifyRequest, reply: FastifyReply) {
  // Development mode bypass: allow authenticating via X-Teeko-User / X-Teeko-Role headers
  if (env.NODE_ENV === 'development') {
    const devUserId = req.headers['x-teeko-user'];
    if (devUserId && typeof devUserId === 'string') {
      const roleRow = await db.query.userRoles.findFirst({
        where: eq(userRoles.userId, devUserId),
      });
      if (roleRow) {
        req.user = {
          id: devUserId,
          role: roleRow.role,
          clerkUserId: '',
        };
        return;
      } else {
        req.log.warn({ devUserId }, 'X-Teeko-User dev bypass user has no registered roles');
      }
    }
  }

  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return reply.code(401).send({ error: 'unauthorized', message: 'missing bearer token' });
  }
  const token = header.slice(7).trim();

  // Dev bypass — only active in development
  if (process.env.NODE_ENV !== 'production' && token === DEV_TOKEN) {
    req.user = { id: DEV_USER_ID, role: DEV_ROLE, clerkUserId: 'dev' };
    return;
  }

  let claims: ClerkClaims;
  try {
    claims = await verifyRiderClerkToken(token);
  } catch (err) {
    req.log.warn({ err }, 'rider clerk token verification failed');
    const riderDetail = err instanceof Error ? err.message : String(err);
    return reply.code(401).send({ error: 'unauthorized', message: riderDetail });
  }
  req.clerkAuth = claims;
  const row = await findUserByExternalId('clerk', claims.sub);
  if (row) {
    req.user = { id: row.id, role: row.role, clerkUserId: claims.sub };
  }
}

export async function driverClerkAuthVerify(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return reply.code(401).send({ error: 'unauthorized', message: 'missing bearer token' });
  }
  const token = header.slice(7).trim();

  if (process.env.NODE_ENV !== 'production' && token === DEV_TOKEN) {
    req.user = { id: DEV_USER_ID, role: DEV_ROLE, clerkUserId: 'dev' };
    return;
  }

  let claims: ClerkClaims;
  try {
    claims = await verifyDriverClerkToken(token);
  } catch (err) {
    req.log.warn({ err }, 'driver clerk token verification failed');
    const detail = err instanceof Error ? err.message : String(err);
    return reply.code(401).send({ error: 'unauthorized', message: detail });
  }
  req.clerkAuth = claims;
  const row = await findUserByExternalId('clerk', claims.sub);
  if (row) {
    req.user = { id: row.id, role: row.role, clerkUserId: claims.sub };
  }
}

// Backwards-compat alias — driver/index.ts has been updated to use driverClerkAuthVerify directly.
export { clerkAuthVerify as auth0Verify };
