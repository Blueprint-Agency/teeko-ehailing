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

  // Email — Gmail SMTP (active provider). Resend kept optional for future flip-back.
  GMAIL_USER: z.string().email(),
  GMAIL_APP_PASSWORD: z.string().min(16),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default('onboarding@resend.dev'),

  // Auth0 — unused this phase, kept for forward compatibility
  AUTH0_DOMAIN: z.string().optional(),
  AUTH0_AUDIENCE: z.string().optional(),
  AUTH0_ISSUER: z.string().optional(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Google Maps (server-side proxy — never exposed to mobile clients)
  GOOGLE_MAPS_API_KEY: z.string().min(20),

  // Commission & fees
  COMMISSION_RATE: z.coerce.number().default(0.10),
  CANCELLATION_FEE_CENTS: z.coerce.number().int().default(300),

  // Storage adapter: 'r2' | 'gcs' | unset (local)
  STORAGE: z.enum(['r2', 'gcs', 'local']).optional(),

  // Cloudflare R2 (active storage for driver-web documents)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
