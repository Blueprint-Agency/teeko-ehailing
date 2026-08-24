// PDPA (Malaysia, Act 709 + 2024 amendments) admin tooling.
//
// Implements the data-subject-request lifecycle behind the admin PDPA page:
//   • access     — Subject Access Request export (s.30 + 2024 portability)
//   • correction — s.34 (fulfilment is a manual data edit; we track the request)
//   • erasure    — NOT a hard delete. PDPA has no blanket GDPR erasure right and
//                  we carry legal retention duties (tax ~7y, APAD trip/safety,
//                  insurance, dispute records). "Erasure" = anonymise the person
//                  while retaining the legally-required transactional rows.
// Plus consent withdrawal (s.38) / direct-marketing opt-out (s.43).
//
// Every mutating action is audited by the route layer (modules/admin/audit).

import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  consentLog,
  dataSubjectRequests,
  deviceTokens,
  disputes,
  emergencyContacts,
  externalIdentities,
  otpCodes,
  paymentMethods,
  payments,
  ratings,
  recentPlaces,
  savedPlaces,
  supportTickets,
  trips,
  userRoles,
  users,
} from '../../db/schema';
import { DomainError } from '../../shared/errors';

// Statutory data-access/correction response window (PDPA s.29 / s.36): 21 days.
export const DSR_SLA_DAYS = 21;

// Retention windows that survive an erasure. ILLUSTRATIVE — confirm each with
// counsel before relying on them. Financial records are the long pole (tax law).
const RETENTION_YEARS = { financial: 7, tripSafety: 3 } as const;

type DsrKind = (typeof dataSubjectRequests.kind.enumValues)[number];
type DsrStatus = (typeof dataSubjectRequests.status.enumValues)[number];
type ConsentType = (typeof consentLog.consentType.enumValues)[number];

function addYears(d: Date, years: number): Date {
  const c = new Date(d);
  c.setFullYear(c.getFullYear() + years);
  return c;
}

// ── Data Subject Requests ─────────────────────────────────────────────────────

async function rolesByUser(userIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (userIds.length === 0) return map;
  const rows = await db
    .select({ userId: userRoles.userId, role: userRoles.role })
    .from(userRoles)
    .where(inArray(userRoles.userId, userIds));
  for (const r of rows) {
    const list = map.get(r.userId) ?? [];
    list.push(r.role);
    map.set(r.userId, list);
  }
  return map;
}

function subjectType(roles: string[]): 'driver' | 'rider' {
  return roles.includes('driver') ? 'driver' : 'rider';
}

function toDsrDto(
  row: typeof dataSubjectRequests.$inferSelect,
  name: string | null,
  roles: string[],
) {
  const due = new Date(row.createdAt);
  due.setDate(due.getDate() + DSR_SLA_DAYS);
  return {
    id: row.id,
    userId: row.userId,
    name: name ?? '—',
    type: subjectType(roles),
    kind: row.kind,
    status: row.status,
    exportPath: row.exportGcsPath,
    createdAt: row.createdAt.toISOString(),
    dueAt: due.toISOString(),
    fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
  };
}

export const pdpaService = {
  async listDsrs() {
    const rows = await db
      .select({ dsr: dataSubjectRequests, name: users.fullName })
      .from(dataSubjectRequests)
      .leftJoin(users, eq(users.id, dataSubjectRequests.userId))
      .orderBy(desc(dataSubjectRequests.createdAt));
    const roles = await rolesByUser(rows.map((r) => r.dsr.userId));
    return rows.map((r) => toDsrDto(r.dsr, r.name, roles.get(r.dsr.userId) ?? []));
  },

  async createDsr(userId: string, kind: DsrKind) {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new DomainError('USER_NOT_FOUND', 'User not found.', 404);
    const [row] = await db.insert(dataSubjectRequests).values({ userId, kind }).returning();
    const roles = await rolesByUser([userId]);
    return toDsrDto(row!, user.fullName, roles.get(userId) ?? []);
  },

  async setDsrStatus(id: string, status: DsrStatus) {
    const [row] = await db
      .update(dataSubjectRequests)
      .set({ status, fulfilledAt: status === 'fulfilled' ? new Date() : null })
      .where(eq(dataSubjectRequests.id, id))
      .returning();
    if (!row) throw new DomainError('DSR_NOT_FOUND', 'Request not found.', 404);
    const roles = await rolesByUser([row.userId]);
    const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
    return toDsrDto(row, user?.fullName ?? null, roles.get(row.userId) ?? []);
  },

  // ── Subject Access Request export (s.30) ─────────────────────────────────────
  // Assembles every category of personal data we hold for one subject. Add a
  // collector here as new PII-bearing tables appear.
  async buildAccessExport(userId: string) {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new DomainError('USER_NOT_FOUND', 'User not found.', 404);

    const [
      roles,
      consents,
      requests,
      places,
      recents,
      methods,
      charges,
      rideRows,
      ratingRows,
      disputeRows,
      tickets,
      devices,
      contacts,
    ] = await Promise.all([
      db.select().from(userRoles).where(eq(userRoles.userId, userId)),
      db.select().from(consentLog).where(eq(consentLog.userId, userId)),
      db.select().from(dataSubjectRequests).where(eq(dataSubjectRequests.userId, userId)),
      db.select().from(savedPlaces).where(eq(savedPlaces.userId, userId)),
      db.select().from(recentPlaces).where(eq(recentPlaces.userId, userId)),
      db.select().from(paymentMethods).where(eq(paymentMethods.userId, userId)),
      db.select().from(payments).where(or(eq(payments.riderId, userId), eq(payments.driverId, userId))),
      db.select().from(trips).where(or(eq(trips.riderId, userId), eq(trips.driverId, userId))),
      db.select().from(ratings).where(or(eq(ratings.raterId, userId), eq(ratings.rateeId, userId))),
      db.select().from(disputes).where(or(eq(disputes.riderId, userId), eq(disputes.driverId, userId))),
      db.select().from(supportTickets).where(eq(supportTickets.userId, userId)),
      db.select().from(deviceTokens).where(eq(deviceTokens.userId, userId)),
      db.select().from(emergencyContacts).where(eq(emergencyContacts.userId, userId)),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      subject: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        locale: user.locale,
        status: user.status,
        pdpaConsentAt: user.pdpaConsentAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        roles: roles.map((r) => r.role),
      },
      consentLog: consents,
      dataSubjectRequests: requests,
      savedPlaces: places,
      recentPlaces: recents,
      // PCI: only masked labels/types are stored — no PANs to export.
      paymentMethods: methods.map((m) => ({
        id: m.id,
        type: m.type,
        label: m.label,
        isDefault: m.isDefault,
        createdAt: m.createdAt,
      })),
      payments: charges,
      trips: rideRows,
      ratings: ratingRows,
      disputes: disputeRows,
      supportTickets: tickets,
      // Raw push tokens are credentials, not exported; list device presence only.
      devices: devices.map((d) => ({ id: d.id, platform: d.platform, registeredAt: d.registeredAt })),
      emergencyContacts: contacts,
    };
  },

  async fulfilAccess(dsrId: string) {
    const dsr = await db.query.dataSubjectRequests.findFirst({ where: eq(dataSubjectRequests.id, dsrId) });
    if (!dsr) throw new DomainError('DSR_NOT_FOUND', 'Request not found.', 404);
    if (dsr.kind !== 'access') throw new DomainError('WRONG_KIND', 'Not an access request.', 422);
    const data = await this.buildAccessExport(dsr.userId);
    // In production this JSON is written to GCS and exposed via a short-lived
    // signed URL; in dev we return it inline and record a logical path.
    const path = `pdpa-export/${dsr.userId}/${dsr.id}.json`;
    await db
      .update(dataSubjectRequests)
      .set({ status: 'fulfilled', fulfilledAt: new Date(), exportGcsPath: path })
      .where(eq(dataSubjectRequests.id, dsrId));
    return { path, data };
  },

  // ── Erasure = anonymise, never DELETE (retention-aware) ───────────────────────
  async executeErasure(userId: string) {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new DomainError('USER_NOT_FOUND', 'User not found.', 404);
    if (user.deletedAt) throw new DomainError('ALREADY_ERASED', 'This account is already erased.', 409);

    // Retention report — how long the *retained* transactional records must live.
    const paymentAgg = await db
      .select({ lastPayment: sql<Date | null>`max(${payments.createdAt})` })
      .from(payments)
      .where(or(eq(payments.riderId, userId), eq(payments.driverId, userId)));
    const tripAgg = await db
      .select({ lastTrip: sql<Date | null>`max(${trips.createdAt})` })
      .from(trips)
      .where(or(eq(trips.riderId, userId), eq(trips.driverId, userId)));
    const lastPayment = paymentAgg[0]?.lastPayment ?? null;
    const lastTrip = tripAgg[0]?.lastTrip ?? null;

    const retainedUntilDates = [
      lastPayment ? addYears(new Date(lastPayment), RETENTION_YEARS.financial) : null,
      lastTrip ? addYears(new Date(lastTrip), RETENTION_YEARS.tripSafety) : null,
    ].filter((d): d is Date => d != null);
    const retainedUntil =
      retainedUntilDates.length > 0
        ? new Date(Math.max(...retainedUntilDates.map((d) => d.getTime())))
        : null;

    const purged: Record<string, number> = {};
    await db.transaction(async (tx) => {
      // Anonymise the person on the retained user row (FKs stay valid).
      await tx
        .update(users)
        .set({
          fullName: 'Deleted user',
          phone: null,
          email: null,
          passwordHash: null,
          stripeCustomerId: null,
          status: 'deactivated',
          deletedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Purge pure-PII satellites with no retention value.
      const del = async (label: string, run: Promise<{ length?: number } | unknown>) => {
        const r = (await run) as { length?: number } | { count?: number };
        purged[label] = (r as { length?: number }).length ?? (r as { count?: number }).count ?? 0;
      };
      await del('externalIdentities', tx.delete(externalIdentities).where(eq(externalIdentities.userId, userId)).returning());
      await del('otpCodes', tx.delete(otpCodes).where(eq(otpCodes.userId, userId)).returning());
      await del('deviceTokens', tx.delete(deviceTokens).where(eq(deviceTokens.userId, userId)).returning());
      await del('emergencyContacts', tx.delete(emergencyContacts).where(eq(emergencyContacts.userId, userId)).returning());
      await del('savedPlaces', tx.delete(savedPlaces).where(eq(savedPlaces.userId, userId)).returning());
      await del('recentPlaces', tx.delete(recentPlaces).where(eq(recentPlaces.userId, userId)).returning());

      // Redact stored payment instruments (keep rows for ledger FK integrity).
      await tx
        .update(paymentMethods)
        .set({ label: 'REDACTED', externalId: null, deletedAt: new Date() })
        .where(eq(paymentMethods.userId, userId));

      // Scrub free-text the subject authored in ratings (aggregate score kept).
      await tx.update(ratings).set({ comment: null }).where(eq(ratings.raterId, userId));
    });

    return {
      userId,
      anonymised: true,
      purged,
      retained: ['trips', 'payments', 'disputes', 'ratings (scores)', 'support_tickets', 'insurance_certificates'],
      retainedUntil: retainedUntil?.toISOString() ?? null,
      note:
        'PII anonymised on the profile; transactional records retained (de-identified) to meet tax/APAD/insurance retention duties.',
    };
  },

  // ── Consent (s.38 withdraw / s.43 marketing opt-out) ──────────────────────────
  async listConsents(userId?: string) {
    const rows = await db
      .select({ c: consentLog, name: users.fullName })
      .from(consentLog)
      .leftJoin(users, eq(users.id, consentLog.userId))
      .where(userId ? eq(consentLog.userId, userId) : undefined)
      .orderBy(desc(consentLog.givenAt))
      .limit(200);
    return rows.map((r) => ({
      id: r.c.id,
      userId: r.c.userId,
      name: r.name ?? '—',
      consentType: r.c.consentType,
      granted: r.c.granted,
      at: r.c.givenAt.toISOString(),
    }));
  },

  async withdrawConsent(userId: string, consentType: ConsentType) {
    // Reuse the notice version the subject last acted on for this consent type.
    const last = await db
      .select()
      .from(consentLog)
      .where(and(eq(consentLog.userId, userId), eq(consentLog.consentType, consentType)))
      .orderBy(desc(consentLog.givenAt))
      .limit(1);
    if (last.length === 0) {
      throw new DomainError('NO_CONSENT', 'No consent on record to withdraw.', 422);
    }
    if (!last[0]!.granted) {
      throw new DomainError('ALREADY_WITHDRAWN', 'Consent is already withdrawn.', 409);
    }
    const [row] = await db
      .insert(consentLog)
      .values({
        userId,
        consentType,
        contentVersionId: last[0]!.contentVersionId,
        granted: false,
      })
      .returning();
    return row!;
  },
};
