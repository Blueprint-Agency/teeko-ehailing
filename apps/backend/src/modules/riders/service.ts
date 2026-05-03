// modules/riders/service.ts
// Saved + recent places orchestration. Routes call into this; the repo stays
// private to the module. Maps stored rows to the wire Place shape.

// Wire shape for places — mirrors @teeko/shared Place but defined locally so
// the backend has no monorepo package dependency.
export type PlaceCategory = 'home' | 'work' | 'saved' | 'recent' | 'search';

export type Place = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
};

import {
  deleteSavedPlaceForUser,
  listRecentPlacesForUser,
  listSavedPlacesForUser,
  pushRecentPlaceForUser,
  upsertSavedPlace as repoUpsertSavedPlace,
  type SavedLabel,
  type StoredPlace,
} from './repo';

function savedToPlace(row: StoredPlace): Place {
  const category: PlaceCategory =
    row.label === 'home' ? 'home' : row.label === 'work' ? 'work' : 'saved';
  return {
    id: row.id,
    name: row.address, // saved rows store only address; reuse as display name
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    category,
  };
}

function recentToPlace(row: StoredPlace): Place {
  return {
    id: row.id,
    name: row.label,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    category: 'recent',
  };
}

export type SavedPlaceInput = {
  label: SavedLabel;
  address: string;
  lat: number;
  lng: number;
};

export type RecentPlaceInput = {
  label: string;
  address: string;
  lat: number;
  lng: number;
};

export const ridersService = {
  async listSavedPlaces(userId: string): Promise<Place[]> {
    const rows = await listSavedPlacesForUser(userId);
    return rows.map(savedToPlace);
  },

  async upsertSavedPlace(userId: string, input: SavedPlaceInput): Promise<Place> {
    const row = await repoUpsertSavedPlace({ userId, ...input });
    return savedToPlace(row);
  },

  async deleteSavedPlace(userId: string, id: string): Promise<void> {
    await deleteSavedPlaceForUser(userId, id);
  },

  async listRecentPlaces(userId: string, limit = 10): Promise<Place[]> {
    const rows = await listRecentPlacesForUser(userId, limit);
    return rows.map(recentToPlace);
  },

  async pushRecentPlace(userId: string, input: RecentPlaceInput): Promise<Place> {
    const row = await pushRecentPlaceForUser({ userId, ...input });
    return recentToPlace(row);
  },
};
