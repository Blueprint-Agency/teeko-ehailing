import type { Place } from '@teeko/shared';
import { create } from 'zustand';

import * as placesApi from '../client/places';

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
  ) => Promise<void>;
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

  async saveHomeOrWork(category, place) {
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

  clearResults() {
    set({ results: [] });
  },
}));
