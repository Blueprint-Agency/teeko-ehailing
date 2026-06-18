import type { LatLng } from '@teeko/shared';
import { create } from 'zustand';

export type LocationState = {
  current: LatLng | null;
  heading: number;
  permission: 'undetermined' | 'granted' | 'denied';
  setCurrent: (pos: LatLng, heading?: number) => void;
  setPermission: (p: LocationState['permission']) => void;
};

export const useLocationStore = create<LocationState>((set) => ({
  current: null,
  heading: 0,
  permission: 'undetermined',
  setCurrent: (pos, heading = 0) => set({ current: pos, heading }),
  setPermission: (permission) => set({ permission }),
}));
