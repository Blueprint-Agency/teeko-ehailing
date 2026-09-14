import type { Place } from '@teeko/shared';
import { create } from 'zustand';

import * as placesApi from '../client/places';

// Max custom ("saved") places a rider may keep, on top of the one-each home and
// work. Home/work are naturally single by category; custom places are not, so
// this cap is enforced here in the store — the single source of truth — rather
// than only in the screens that add them.
export const MAX_CUSTOM_PLACES = 3;

// Thrown by saveHomeOrWork when adding another custom place would exceed
// MAX_CUSTOM_PLACES. Callers can catch this to show a friendly message.
export class PlacesLimitError extends Error {
  constructor(public readonly limit: number = MAX_CUSTOM_PLACES) {
    super(`Custom saved places limit reached (${limit})`);
    this.name = 'PlacesLimitError';
  }
}

export type PlacesState = {
  recent: Place[];
  saved: Place[];
  results: Place[];
  searching: boolean;
  loadRecent: () => Promise<void>;
  loadSaved: () => Promise<void>;
  search: (q: string, near?: { lat: number; lng: number }) => Promise<void>;
  selectPrediction: (placeId: string) => Promise<Place>;
  pushRecent: (p: Place) => Promise<void>;
  saveHomeOrWork: (
    category: 'home' | 'work' | 'custom',
    place: Place,
    // When editing an existing custom place, its id — excluded from the cap
    // count so a replace at the limit isn't wrongly blocked.
    replaceId?: string,
  ) => Promise<void>;
  removeSaved: (id: string) => Promise<void>;
  clearResults: () => void;
};

export const usePlacesStore = create<PlacesState>((set, get) => ({
  recent: [],
  saved: [],
  results: [],
  searching: false,

  async loadRecent() {
    try {
      set({ recent: await placesApi.recentPlaces() });
    } catch (err) {
      console.warn('[places] loadRecent failed', err);
      set({ recent: [] });
    }
  },

  async loadSaved() {
    try {
      set({ saved: await placesApi.savedPlaces() });
    } catch (err) {
      console.warn('[places] loadSaved failed', err);
      set({ saved: [] });
    }
  },

  async search(q, near) {
    set({ searching: true });
    try {
      const results = await placesApi.searchPlaces(q, near);
      set({ results, searching: false });
    } catch (err) {
      console.warn('[places] search failed', err);
      set({ results: [], searching: false });
    }
  },

  async selectPrediction(placeId) {
    return placesApi.placeDetails(placeId);
  },

  async pushRecent(p) {
    // Optimistic local update.
    const next = [p, ...get().recent.filter((r) => r.id !== p.id)].slice(0, 10);
    set({ recent: next });
    // Server update — fire and log; don't throw.
    placesApi
      .pushRecentPlace({ label: p.name, address: p.address, lat: p.lat, lng: p.lng })
      .catch((err) => console.warn('[places] pushRecent server failed', err));
  },

  async saveHomeOrWork(category, place, replaceId) {
    // Enforce the custom-place cap before hitting the server. Custom places come
    // back with category 'saved'; exclude the row being replaced during an edit.
    if (category === 'custom') {
      const existingCustom = get().saved.filter(
        (p) => p.category === 'saved' && p.id !== replaceId,
      );
      if (existingCustom.length >= MAX_CUSTOM_PLACES) {
        throw new PlacesLimitError();
      }
    }
    const saved = await placesApi.upsertSavedPlace({
      label: category,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    });
    // Replace any existing row of the same category (home/work) and prepend.
    const others =
      category === 'custom'
        ? get().saved
        : get().saved.filter((p) => p.category !== category);
    set({ saved: [saved, ...others] });
  },

  async removeSaved(id) {
    // Optimistic local removal, then persist. Restore on failure.
    const prev = get().saved;
    set({ saved: prev.filter((p) => p.id !== id) });
    try {
      await placesApi.deleteSavedPlace(id);
    } catch (err) {
      console.warn('[places] removeSaved failed', err);
      set({ saved: prev });
      throw err;
    }
  },

  clearResults() {
    set({ results: [] });
  },
}));
