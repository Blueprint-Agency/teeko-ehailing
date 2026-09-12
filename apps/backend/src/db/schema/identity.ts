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
  // E.164 ('+' then 8-15 digits). Deliberately NOT unique: a phone number is
  // contact data, not an identity key. One person may hold a rider account and
  // a driver account on the same number, exactly as they already may on the
  // same email (users.email carries no unique constraint either).
  //
  // Nullable because legacy rows exist — a NOT NULL migration would fail. The
  // API enforces requiredness at registration, and a NULL here routes the user
  // to a blocking "add your phone number" screen at next login.
  phone: text(),
  // ISO-3166 alpha-2 the user picked in the country sheet ('MY', 'SG', 'GB').
  // E.164 alone is ambiguous — '+1' is the US *and* Canada — so the picker
  // needs this to round-trip. Drivers are always 'MY'.
  phoneCountry: text(),
  // The 30-day one-change-per-month clock, stamped on *every* successful write
  // to `phone`: rider self-service and admin-approved alike. NULL means the
  // number has never been changed since registration, so the first real change
  // is never blocked by a cooldown the user never used.
  phoneChangedAt: timestamp({ withTimezone: true }),
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
    // What the code may be spent on: 'email_verification' | 'password_change'
    // | 'phone_change'. Plain text rather than a pg enum so adding a purpose is
    // a code change, not a migration.
    //
    // This column is now *written* and *matched on* — it used to be defaulted
    // and ignored, which meant an email-verification code was spendable on a
    // password change. Codes are scoped to their purpose so a phone-change code
    // proves intent to change a phone and nothing else.
    purpose: text().notNull().default('email_verification'),
    attempts: integer().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('otp_codes_user_id_idx').on(t.userId),
    // Every lookup is "the latest live code for this user *and* purpose".
    index('otp_codes_user_purpose_idx').on(t.userId, t.purpose),
  ],
);
