import type { FastifyReply, FastifyRequest } from 'fastify';
// v1.0: verify Auth0 JWT against JWKS, attach { userId, role } to request.
// v0.1: short-circuit — accept an X-Teeko-User header for local testing.
declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; role: 'rider' | 'driver' | 'admin_super' | 'admin_ops' | 'admin_finance' };
  }
}

export async function auth0Verify(req: FastifyRequest, _reply: FastifyReply) {
  const id = req.headers['x-teeko-user'];
  const role = req.headers['x-teeko-role'];
  if (typeof id === 'string' && typeof role === 'string') {
    req.user = { id, role: role as never };
  }
}
