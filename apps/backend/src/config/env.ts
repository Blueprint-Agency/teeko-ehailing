import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url(),

  // Clerk (Phase 1 rider auth)
  CLERK_SECRET_KEY: z.string(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string(),

  // Resend (transactional email)
  RESEND_API_KEY: z.string(),
  RESEND_FROM_EMAIL: z.string().email().default('onboarding@resend.dev'),

  // Auth0 — unused this phase, kept for forward compatibility
  AUTH0_DOMAIN: z.string().optional(),
  AUTH0_AUDIENCE: z.string().optional(),
  AUTH0_ISSUER: z.string().optional(),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
