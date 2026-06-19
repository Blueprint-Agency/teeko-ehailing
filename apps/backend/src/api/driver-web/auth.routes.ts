import type { FastifyInstance } from 'fastify';
import { db } from '../../config/db';
import { users, userRoles } from '../../db/schema/identity';
import { driverApplications } from '../../db/schema/onboarding';
import { hashPassword, verifyPassword } from '../../lib/password';

// ---------------------------------------------------------------------------
// Email + password auth for the driver web portal.
// (Replaced the previous phone + OTP flow.)
// ---------------------------------------------------------------------------

const MIN_PASSWORD_LEN = 8;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function routes(app: FastifyInstance) {
  // --- Login: email + password → user ---
  app.post<{ Body: { email?: string; password?: string } }>('/login', async (req, reply) => {
    const email = req.body.email ? normalizeEmail(req.body.email) : '';
    const { password } = req.body;
    if (!email || !password) {
      return reply.code(400).send({ error: 'Missing required fields: email and password' });
    }

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });

    // Same generic message whether the email is unknown or the password is
    // wrong, so we don't leak which emails are registered.
    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const driverRole = await db.query.userRoles.findFirst({
      where: (r, { and, eq }) => and(eq(r.userId, user.id), eq(r.role, 'driver')),
    });
    if (!driverRole) return reply.code(403).send({ error: 'Access denied: not a driver account' });
    if (user.status !== 'active') return reply.code(403).send({ error: `Account is ${user.status}` });

    return {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      email: user.email,
      locale: user.locale,
    };
  });

  // --- Register: email + password + fullName → create user ---
  app.post<{ Body: { email?: string; password?: string; fullName?: string } }>(
    '/register',
    async (req, reply) => {
      const email = req.body.email ? normalizeEmail(req.body.email) : '';
      const { password, fullName } = req.body;
      if (!email || !password || !fullName) {
        return reply
          .code(400)
          .send({ error: 'Missing required fields: email, password and fullName' });
      }
      if (password.length < MIN_PASSWORD_LEN) {
        return reply
          .code(400)
          .send({ error: `Password must be at least ${MIN_PASSWORD_LEN} characters` });
      }

      const existing = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.email, email),
      });
      if (existing) return reply.code(400).send({ error: 'Email already registered' });

      const passwordHash = await hashPassword(password);

      const result = await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({ email, passwordHash, fullName, locale: 'en', status: 'active' })
          .returning();

        if (!user) throw new Error('Failed to create user');

        await tx.insert(userRoles).values({ userId: user.id, role: 'driver' });
        await tx.insert(driverApplications).values({ driverId: user.id, state: 'phone_entered' });

        return user;
      });

      return { id: result.id, phone: result.phone, fullName: result.fullName, email: result.email };
    },
  );
}
