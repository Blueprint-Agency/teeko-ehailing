import { create } from 'zustand';

export type Toast = { id: string; kind: 'info' | 'success' | 'error'; message: string };

export type DialogAction = {
  label: string;
  /** `cancel` renders as a ghost button at the bottom; `destructive` and `default` render as primary. */
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
};

export type DialogOptions = {
  title: string;
  message?: string;
  /** Empty/omitted → a single "OK" button. */
  actions?: DialogAction[];
  /** Tap-outside / back-button dismiss. Default true. */
  dismissable?: boolean;
};

export type UIState = {
  toasts: Toast[];
  dialog: DialogOptions | null;
  debugChaos: boolean;
  /** Demo knob (plan §5): when true, finding-driver immediately shows the "No drivers" fallback. */
  forceNoDrivers: boolean;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  showDialog: (d: DialogOptions) => void;
  dismissDialog: () => void;
  setDebugChaos: (on: boolean) => void;
  setForceNoDrivers: (on: boolean) => void;
  resetDemo: () => void;
};

let toastSeq = 0;

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  dialog: null,
  debugChaos: false,
  forceNoDrivers: false,
  pushToast: (t) =>
    set((s) => ({ toasts: [...s.toasts, { ...t, id: `toast_${Date.now()}_${toastSeq++}` }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  showDialog: (d) => set({ dialog: d }),
  dismissDialog: () => set({ dialog: null }),
  setDebugChaos: (on) => set({ debugChaos: on }),
  setForceNoDrivers: (on) => set({ forceNoDrivers: on }),
  resetDemo: () => {
    set({ toasts: [], dialog: null, debugChaos: false, forceNoDrivers: false });
  },
}));

/**
 * Imperative feedback helpers — usable outside React (stores, API handlers).
 * Replaces `Alert.alert` so both apps render in-app UI instead of the OS dialog.
 *
 *   toast.error('Could not save');
 *   showDialog({ title: 'Log out?', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Log out', style: 'destructive', onPress }] });
 */
export const toast = {
  info: (message: string) => useUIStore.getState().pushToast({ kind: 'info', message }),
  success: (message: string) => useUIStore.getState().pushToast({ kind: 'success', message }),
  error: (message: string) => useUIStore.getState().pushToast({ kind: 'error', message }),
};

export const showDialog = (d: DialogOptions) => useUIStore.getState().showDialog(d);
