import type { FastifyInstance } from 'fastify';
import { db } from '../../config/db';
import { users, userRoles } from '../../db/schema/identity';
import { driverApplications } from '../../db/schema/onboarding';

// ---------------------------------------------------------------------------
// OTP helpers
// ---------------------------------------------------------------------------

const OTP_TTL_MS = 5 * 60 * 1000;

interface OtpEntry {
  code: string;
  expiresAt: number;
}

// In-memory store — replace with Redis in v1.0
const otpStore = new Map<string, OtpEntry>();

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sendOtp(phone: string, log: FastifyInstance['log']): string {
  const code = generateOtp();
  otpStore.set(phone, { code, expiresAt: Date.now() + OTP_TTL_MS });
  // TODO v1.0: send via SMS (Twilio / AWS SNS)
  log.info({ phone, code }, 'OTP generated');
  return code;
}

const isDev = process.env.NODE_ENV !== 'production';

/** Returns the phone if valid, throws with an error message otherwise. */
function consumeOtp(phone: string, code: string): void {
  const entry = otpStore.get(phone);
  if (!entry || Date.now() > entry.expiresAt) {
    otpStore.delete(phone);
    throw Object.assign(new Error('OTP expired or not found'), { statusCode: 401 });
  }
  if (entry.code !== code) {
    throw Object.assign(new Error('Invalid OTP'), { statusCode: 401 });
  }
  otpStore.delete(phone);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function routes(app: FastifyInstance) {
  // --- Login ---

  // Step 1: submit phone → send OTP
  app.post<{ Body: { phone: string } }>('/login', async (req, reply) => {
    const { phone } = req.body;
    if (!phone) return reply.code(400).send({ error: 'Missing required field: phone' });

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.phone, phone),
    });

    if (!user) return reply.code(401).send({ error: 'Invalid credentials' });

    const driverRole = await db.query.userRoles.findFirst({
      where: (r, { and, eq }) => and(eq(r.userId, user.id), eq(r.role, 'driver')),
    });

    if (!driverRole) return reply.code(403).send({ error: 'Access denied: not a driver account' });
    if (user.status !== 'active') return reply.code(403).send({ error: `Account is ${user.status}` });

    const code = sendOtp(phone, app.log);
    return { message: 'OTP sent', ...(isDev && { devOtp: code }) };
  });

  // Step 2: submit phone + OTP → return user
  app.post<{ Body: { phone: string; code: string } }>('/verify', async (req, reply) => {
    const { phone, code } = req.body;
    if (!phone || !code) return reply.code(400).send({ error: 'Missing required fields: phone and code' });

    try {
      consumeOtp(phone, code);
    } catch (err: any) {
      return reply.code(err.statusCode ?? 401).send({ error: err.message });
    }

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.phone, phone),
    });

    if (!user) return reply.code(401).send({ error: 'User not found' });

    return { id: user.id, phone: user.phone, fullName: user.fullName, locale: user.locale };
  });

  // --- Register ---

  // Step 1: submit phone → send OTP (phone must not already exist)
  app.post<{ Body: { phone: string } }>('/register', async (req, reply) => {
    const { phone } = req.body;
    if (!phone) return reply.code(400).send({ error: 'Missing required field: phone' });

    const existing = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.phone, phone),
    });

    if (existing) return reply.code(400).send({ error: 'Phone number already registered' });

    const code = sendOtp(phone, app.log);
    return { message: 'OTP sent', ...(isDev && { devOtp: code }) };
  });

  // Step 2: submit phone + OTP + fullName → verify then create user
  app.post<{ Body: { phone: string; code: string; fullName: string } }>(
    '/register/verify',
    async (req, reply) => {
      const { phone, code, fullName } = req.body;
      if (!phone || !code || !fullName) {
        return reply.code(400).send({ error: 'Missing required fields: phone, code and fullName' });
      }

      try {
        consumeOtp(phone, code);
      } catch (err: any) {
        return reply.code(err.statusCode ?? 401).send({ error: err.message });
      }

      // Guard against race-condition double-submit after OTP passes
      const existing = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.phone, phone),
      });

      if (existing) return reply.code(400).send({ error: 'Phone number already registered' });

      const result = await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({ phone, fullName, locale: 'en', status: 'active' })
          .returning();

        if (!user) throw new Error('Failed to create user');

        await tx.insert(userRoles).values({ userId: user.id, role: 'driver' });
        await tx.insert(driverApplications).values({ driverId: user.id, state: 'phone_entered' });

        return user;
      });

      return { id: result.id, phone: result.phone, fullName: result.fullName };
    },
  );
}
