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
  'admin_ops',
  'admin_finance',
]);

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  phone: text().unique(),
  email: text(),
  emailVerified: boolean().notNull().default(false),
  fullName: text(),
  locale: localeEnum().notNull().default('en'),
  status: userStatus().notNull().default('active'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
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
