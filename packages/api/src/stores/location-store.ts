import type { LatLng } from '@teeko/shared';
import { create } from 'zustand';

// KL Sentral as default fallback while permissions load.
const DEFAULT_CENTER: LatLng = { lat: 3.1339, lng: 101.6869 };

export type LocationState = {
  current: LatLng;
  heading: number;
  permission: 'undetermined' | 'granted' | 'denied';
  setCurrent: (pos: LatLng, heading?: number) => void;
  setPermission: (p: LocationState['permission']) => void;
};

export const useLocationStore = create<LocationState>((set) => ({
  current: DEFAULT_CENTER,
  heading: 0,
  permission: 'undetermined',
  setCurrent: (pos, heading = 0) => set({ current: pos, heading }),
  setPermission: (permission) => set({ permission }),
}));
