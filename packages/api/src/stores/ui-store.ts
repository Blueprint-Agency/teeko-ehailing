import { create } from 'zustand';

export type Toast = { id: string; kind: 'info' | 'success' | 'error'; message: string };

export type UIState = {
  toasts: Toast[];
  debugChaos: boolean;
  /** Demo knob (plan §5): when true, finding-driver immediately shows the "No drivers" fallback. */
  forceNoDrivers: boolean;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  setDebugChaos: (on: boolean) => void;
  setForceNoDrivers: (on: boolean) => void;
  resetDemo: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  debugChaos: false,
  forceNoDrivers: false,
  pushToast: (t) =>
    set((s) => ({ toasts: [...s.toasts, { ...t, id: `toast_${Date.now()}` }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  setDebugChaos: (on) => set({ debugChaos: on }),
  setForceNoDrivers: (on) => set({ forceNoDrivers: on }),
  resetDemo: () => {
    set({ toasts: [], debugChaos: false, forceNoDrivers: false });
  },
}));
