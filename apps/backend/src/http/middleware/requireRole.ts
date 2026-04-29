import type { FastifyReply, FastifyRequest } from 'fastify';

type Role = NonNullable<FastifyRequest['user']>['role'];

export function requireRole(role: Role | Role[]) {
  const allowed = Array.isArray(role) ? role : [role];
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return reply.code(403).send({ error: 'forbidden' });
    }
  };
}

export function requireAdminRole() {
  return requireRole(['admin_super', 'admin_ops', 'admin_finance']);
}
