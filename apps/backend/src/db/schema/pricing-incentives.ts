import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';
import { trips } from './trips';
import { payouts } from './payments';
import { geographyPolygon } from './_types';

export const referralStatus = pgEnum('referral_status', ['pending', 'earned', 'expired']);
export const bonusStatus = pgEnum('bonus_status', ['active', 'completed', 'expired', 'paid']);
export const campaignRuleKind = pgEnum('campaign_rule_kind', [
  'trips_window',
  'streak',
  'peak_hours',
  'rating_streak',
]);

export const pricingConfig = pgTable('pricing_config', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const surgeConfig = pgTable('surge_config', {
  id: smallint().primaryKey().default(1),
  multiplier: numeric({ precision: 4, scale: 2 }).notNull().default('1.00'),
  windowStart: time(),
  windowEnd: time(),
  zoneLabel: text(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const surgeZones = pgTable('surge_zones', {
  id: uuid().primaryKey().defaultRandom(),
  label: text().notNull(),
  polygon: geographyPolygon().notNull(),
  multiplier: numeric({ precision: 4, scale: 2 }).notNull(),
  /** Admin master switch — whether the zone's surge is currently applied. */
  active: boolean().notNull().default(true),
  /** Hex colour used to render the zone on the admin surge map. */
  color: text(),
  activeFrom: timestamp({ withTimezone: true }).notNull(),
  activeUntil: timestamp({ withTimezone: true }).notNull(),
});

export const referralCodes = pgTable('referral_codes', {
  code: text().primaryKey(),
  ownerId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  rewardCents: integer().notNull(),
  uses: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const referrals = pgTable('referrals', {
  id: uuid().primaryKey().defaultRandom(),
  referrerId: uuid().notNull().references(() => users.id),
  refereeId: uuid().notNull().references(() => users.id),
  code: text().notNull().references(() => referralCodes.code),
  status: referralStatus().notNull().default('pending'),
  earnedAt: timestamp({ withTimezone: true }),
});

export const activationBonuses = pgTable('activation_bonuses', {
  id: uuid().primaryKey().defaultRandom(),
  driverId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  tripsTarget: integer().notNull(),
  tripsDone: integer().notNull().default(0),
  amountCents: integer().notNull(),
  status: bonusStatus().notNull().default('active'),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
});

export const incentiveCampaigns = pgTable('incentive_campaigns', {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  description: text().notNull(),
  ruleKind: campaignRuleKind().notNull(),
  rulePayload: jsonb().notNull(),
  bonusCents: integer().notNull(),
  badgeColor: text(),
  startsAt: timestamp({ withTimezone: true }).notNull(),
  endsAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const driverIncentiveProgress = pgTable(
  'driver_incentive_progress',
  {
    campaignId: uuid().notNull().references(() => incentiveCampaigns.id, { onDelete: 'cascade' }),
    driverId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    progressCount: integer().notNull().default(0),
    completedAt: timestamp({ withTimezone: true }),
    paidPayoutId: uuid().references(() => payouts.id),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.driverId] })],
);

export const ratings = pgTable('ratings', {
  id: uuid().primaryKey().defaultRandom(),
  tripId: uuid().notNull().references(() => trips.id, { onDelete: 'cascade' }),
  raterId: uuid().notNull().references(() => users.id),
  rateeId: uuid().notNull().references(() => users.id),
  score: smallint().notNull(),
  comment: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Tiered commission configuration.
 *
 * Scope resolution order (highest wins): driver › category › platform
 *
 * scopeKey values:
 *   - scope='platform'  → scopeKey='__platform__'
 *   - scope='category'  → scopeKey = rideCategory value (e.g. 'premium')
 *   - scope='driver'    → scopeKey = driver user UUID
 */
export const commissionScope = pgEnum('commission_scope', ['platform', 'category', 'driver']);

export const commissionConfigs = pgTable(
  'commission_configs',
  {
    id: uuid().primaryKey().defaultRandom(),
    scope: commissionScope().notNull(),
    scopeKey: text().notNull(),
    /** Commission rate in basis points (e.g. 2000 = 20%). */
    rateBps: integer().notNull(),
    note: text(),
    updatedBy: uuid().references(() => users.id),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('uq_commission_scope_key').on(t.scope, t.scopeKey)],
);
