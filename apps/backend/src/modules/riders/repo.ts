// modules/riders/repo.ts
// Drizzle queries for the riders domain (saved/recent places).
// Private to the module; routes must go through the service.
import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '../../config/db';
import { recentPlaces, savedPlaces } from '../../db/schema/riders';

export type SavedLabel = 'home' | 'work' | 'custom';

export type StoredPlace = {
  id: string;
  label: SavedLabel | string;
  address: string;
  lat: number;
  lng: number;
};

const wktPoint = (lat: number, lng: number) =>
  sql`ST_GeogFromText(${`SRID=4326;POINT(${lng} ${lat})`})`;

const lngExpr = (col: typeof savedPlaces.location | typeof recentPlaces.location) =>
  sql<number>`ST_X(${col}::geometry)`;
const latExpr = (col: typeof savedPlaces.location | typeof recentPlaces.location) =>
  sql<number>`ST_Y(${col}::geometry)`;

// ---------- saved ----------

export async function listSavedPlacesForUser(userId: string): Promise<StoredPlace[]> {
  const rows = await db
    .select({
      id: savedPlaces.id,
      label: savedPlaces.label,
      address: savedPlaces.address,
      lat: latExpr(savedPlaces.location),
      lng: lngExpr(savedPlaces.location),
    })
    .from(savedPlaces)
    .where(eq(savedPlaces.userId, userId));
  return rows.map((r) => ({ ...r, lat: Number(r.lat), lng: Number(r.lng) }));
}

export async function upsertSavedPlace(input: {
  userId: string;
  label: SavedLabel;
  address: string;
  lat: number;
  lng: number;
}): Promise<StoredPlace> {
  if (input.label === 'home' || input.label === 'work') {
    // Replace existing row for this label.
    await db
      .delete(savedPlaces)
      .where(
        and(eq(savedPlaces.userId, input.userId), eq(savedPlaces.label, input.label)),
      );
  }
  const [row] = await db
    .insert(savedPlaces)
    .values({
      userId: input.userId,
      label: input.label,
      address: input.address,
      location: wktPoint(input.lat, input.lng) as unknown as string,
    })
    .returning({
      id: savedPlaces.id,
      label: savedPlaces.label,
      address: savedPlaces.address,
    });
  if (!row) throw new Error('insert savedPlaces returned no row');
  return { ...row, lat: input.lat, lng: input.lng };
}

export async function deleteSavedPlaceForUser(
  userId: string,
  id: string,
): Promise<void> {
  await db
    .delete(savedPlaces)
    .where(and(eq(savedPlaces.userId, userId), eq(savedPlaces.id, id)));
}

// ---------- recent ----------

export async function listRecentPlacesForUser(
  userId: string,
  limit = 10,
): Promise<StoredPlace[]> {
  const rows = await db
    .select({
      id: recentPlaces.id,
      label: recentPlaces.label,
      address: recentPlaces.address,
      lat: latExpr(recentPlaces.location),
      lng: lngExpr(recentPlaces.location),
    })
    .from(recentPlaces)
    .where(eq(recentPlaces.userId, userId))
    .orderBy(desc(recentPlaces.lastUsedAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, lat: Number(r.lat), lng: Number(r.lng) }));
}

export async function pushRecentPlaceForUser(input: {
  userId: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}): Promise<StoredPlace> {
  return await db.transaction(async (tx) => {
    // De-dupe by (userId, address): bump lastUsedAt if it exists, else insert.
    const existing = await tx
      .select({ id: recentPlaces.id })
      .from(recentPlaces)
      .where(
        and(
          eq(recentPlaces.userId, input.userId),
          eq(recentPlaces.address, input.address),
        ),
      )
      .limit(1);

    let row: { id: string; label: string; address: string };
    if (existing[0]) {
      const [updated] = await tx
        .update(recentPlaces)
        .set({ lastUsedAt: new Date() })
        .where(eq(recentPlaces.id, existing[0].id))
        .returning({
          id: recentPlaces.id,
          label: recentPlaces.label,
          address: recentPlaces.address,
        });
      if (!updated) throw new Error('update recentPlaces returned no row');
      row = updated;
    } else {
      const [inserted] = await tx
        .insert(recentPlaces)
        .values({
          userId: input.userId,
          label: input.label,
          address: input.address,
          location: wktPoint(input.lat, input.lng) as unknown as string,
        })
        .returning({
          id: recentPlaces.id,
          label: recentPlaces.label,
          address: recentPlaces.address,
        });
      if (!inserted) throw new Error('insert recentPlaces returned no row');
      row = inserted;
    }

    // Trim: keep top 10 by lastUsedAt; delete older rows.
    const keep = await tx
      .select({ id: recentPlaces.id })
      .from(recentPlaces)
      .where(eq(recentPlaces.userId, input.userId))
      .orderBy(desc(recentPlaces.lastUsedAt))
      .limit(10);
    if (keep.length === 10) {
      const keepIds = keep.map((r) => r.id);
      await tx
        .delete(recentPlaces)
        .where(
          and(
            eq(recentPlaces.userId, input.userId),
            sql`${recentPlaces.id} NOT IN ${keepIds}`,
          ),
        );
    }

    return { ...row, lat: input.lat, lng: input.lng };
  });
}
