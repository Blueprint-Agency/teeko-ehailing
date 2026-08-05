// modules/safety/service.ts
// SOS, emergency contacts, trip-share, incident reports, strikes.
// Single source of truth for the safety domain.
// Routes call into this service; repos stay private to the module.
//
// Implemented so far: SOS alerts, emergency contacts and incident reports.
// Rider and driver share this code — an SOS is raised by a user and optionally
// attached to a trip. Trip-share and strikes are still to come.

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '../../db';
import { bus } from '../../events/bus';
import { emergencyContacts, incidentReports, sosEvents, trips } from '../../db/schema';
import { DomainError } from '../../shared/errors';

export type EmergencyContactDto = {
  id: string;
  name: string;
  phone: string;
  relation: string | null;
};

export type SosAlertDto = {
  id: string;
  tripId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  /** Snapshot of who we alerted, so the record survives later contact edits. */
  notifiedContacts: EmergencyContactDto[];
};

function toContactDto(row: typeof emergencyContacts.$inferSelect): EmergencyContactDto {
  return { id: row.id, name: row.name, phone: row.phone, relation: row.relation ?? null };
}

export const safetyService = {
  // ---- emergency contacts ----
  async listContacts(userId: string): Promise<EmergencyContactDto[]> {
    const rows = await db
      .select()
      .from(emergencyContacts)
      .where(eq(emergencyContacts.userId, userId));
    return rows.map(toContactDto);
  },

  /**
   * Raise an SOS. Records the alert with the user's location and a snapshot of
   * their emergency contacts, then emits `sos.raised` for the ops console.
   *
   * Deliberately never throws on an unknown trip or an empty contact list: an
   * SOS must always be recorded. Dialling 999 stays on the device.
   */
  async raiseSos(
    userId: string,
    input: { tripId?: string | null; lat: number; lng: number },
  ): Promise<SosAlertDto> {
    let tripId: string | null = input.tripId ?? null;
    if (tripId) {
      const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
      // Only attach a trip the user is actually on — a bad id must not lose the alert.
      if (!trip || (trip.riderId !== userId && trip.driverId !== userId)) tripId = null;
    }

    const contacts = await this.listContacts(userId);
    const point = sql`ST_GeogFromText(${`SRID=4326;POINT(${input.lng} ${input.lat})`})`;

    const [inserted] = await db
      .insert(sosEvents)
      .values({
        userId,
        tripId,
        location: point as unknown as string,
        notifiedContacts: contacts,
      })
      .returning();
    const row = inserted!;

    bus.emit('sos.raised', { sosId: row.id, userId, tripId });

    return {
      id: row.id,
      tripId: row.tripId,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      notifiedContacts: contacts,
    };
  },

  /** The caller's most recent unresolved alert, used to keep the UI in sync. */
  async activeSos(userId: string): Promise<SosAlertDto | null> {
    const [row] = await db
      .select()
      .from(sosEvents)
      .where(and(eq(sosEvents.userId, userId), isNull(sosEvents.resolvedAt)))
      .orderBy(desc(sosEvents.createdAt))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      tripId: row.tripId,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: null,
      notifiedContacts: (row.notifiedContacts as EmergencyContactDto[] | null) ?? [],
    };
  },

  /** Marks a false alarm resolved. Only the user who raised it may do so. */
  async resolveSos(userId: string, sosId: string): Promise<SosAlertDto> {
    const row = await db.query.sosEvents.findFirst({ where: eq(sosEvents.id, sosId) });
    if (!row) throw new DomainError('SOS_NOT_FOUND', 'Alert not found.', 404);
    if (row.userId !== userId) {
      throw new DomainError('FORBIDDEN', 'You did not raise this alert.', 403);
    }
    const [row2] = await db
      .update(sosEvents)
      .set({ resolvedAt: new Date() })
      .where(eq(sosEvents.id, sosId))
      .returning();
    const updated = row2!;
    bus.emit('sos.resolved', { sosId, userId });
    return {
      id: updated.id,
      tripId: updated.tripId,
      createdAt: updated.createdAt.toISOString(),
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      notifiedContacts: (updated.notifiedContacts as EmergencyContactDto[] | null) ?? [],
    };
  },

  /** Non-emergency report (unsafe passenger, damage, harassment) filed after the fact. */
  async reportIncident(
    reporterId: string,
    input: { tripId?: string | null; reason: string },
  ): Promise<{ id: string; status: string; createdAt: string }> {
    const tripId: string | null = input.tripId ?? null;
    let targetId: string | null = null;
    if (tripId) {
      const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
      if (!trip || (trip.riderId !== reporterId && trip.driverId !== reporterId)) {
        throw new DomainError('TRIP_NOT_FOUND', 'Trip not found.', 404);
      }
      // The other party on the trip is who the report is about.
      targetId = trip.riderId === reporterId ? trip.driverId : trip.riderId;
    }

    const [inserted] = await db
      .insert(incidentReports)
      .values({ reporterId, targetId, tripId, reason: input.reason })
      .returning();
    const row = inserted!;
    return { id: row.id, status: row.status, createdAt: row.createdAt.toISOString() };
  },
};
