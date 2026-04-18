import type { Place } from '@teeko/shared';
import { create } from 'zustand';

import * as placesApi from '../mock/handlers/places';

export type PlacesState = {
  recent: Place[];
  saved: Place[];
  results: Place[];
  searching: boolean;
  loadRecent: () => Promise<void>;
  loadSaved: () => Promise<void>;
  search: (q: string) => Promise<void>;
  pushRecent: (p: Place) => void;
  saveHomeOrWork: (category: 'home' | 'work', place: Place) => void;
  clearResults: () => void;
};

export const usePlacesStore = create<PlacesState>((set, get) => ({
  recent: [],
  saved: [],
  results: [],
  searching: false,
  async loadRecent() {
    set({ recent: await placesApi.recentPlaces() });
  },
  async loadSaved() {
    set({ saved: await placesApi.savedPlaces() });
  },
  async search(q) {
    set({ searching: true });
    const results = await placesApi.searchPlaces(q);
    set({ results, searching: false });
  },
  pushRecent(p) {
    const next = [p, ...get().recent.filter((r) => r.id !== p.id)].slice(0, 10);
    set({ recent: next });
  },
  saveHomeOrWork(category, place) {
    const marked: Place = { ...place, category };
    const others = get().saved.filter((p) => p.category !== category);
    set({ saved: [...others, marked] });
  },
  clearResults() {
    set({ results: [] });
  },
}));
