import { pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
