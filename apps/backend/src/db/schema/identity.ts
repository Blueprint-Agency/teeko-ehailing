import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const userStatus = pgEnum('user_status', ['active', 'suspended', 'deactivated']);
export const localeEnum = pgEnum('locale', ['en', 'ms', 'zh', 'ta']);
export const userRole = pgEnum('user_role', [
  'rider',
  'driver',
  'admin_super',
  // Generic back-office admin — can do everything a super admin can except
  // deactivate other admins. `admin_super` is the only role allowed to do that.
  'admin',
  'admin_ops',
  'admin_finance',
]);

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  phone: text().unique(),
  email: text(),
  passwordHash: text(),
  // Last time the account password was changed — by the in-app OTP flow, the
  // signed-out Clerk reset, or a Clerk `user.updated` webhook. Drives the
  // one-change-per-week cooldown; NULL means "never changed, always allowed".
  passwordChangedAt: timestamp({ withTimezone: true }),
  emailVerified: boolean().notNull().default(false),
  fullName: text(),
  // Profile picture. Holds whatever `lib/storage` returned on upload — a
  // `/uploads/...` path locally, an absolute URL once GCS/R2 is wired — so
  // clients must resolve a relative value against the API origin.
  avatarUrl: text(),
  locale: localeEnum().notNull().default('en'),
  status: userStatus().notNull().default('active'),
  // PDPA 2010 consent record. Captured by our own checkbox at driver sign-up —
  // deliberately kept here rather than in Clerk metadata so the consent trail
  // stays in our DB for the APAD/JPJ audit.
  pdpaConsentAt: timestamp({ withTimezone: true }),
  // Rider-side Stripe Customer, created lazily on first payment-method add.
  stripeCustomerId: text().unique(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  // Soft-delete marker — non-null means the account was removed by an admin but
  // its rows are retained for audit/trip-history integrity.
  deletedAt: timestamp({ withTimezone: true }),
});

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: userRole().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

export const externalIdentities = pgTable(
  'external_identities',
  {
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: text().notNull(),
    providerSub: text().notNull().unique(),
    linkedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] })],
);

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    email: text().notNull(),
    codeHash: text().notNull(),
    purpose: text().notNull().default('email_verification'),
    attempts: integer().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('otp_codes_user_id_idx').on(t.userId)],
);
