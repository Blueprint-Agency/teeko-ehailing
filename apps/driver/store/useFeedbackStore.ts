import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';
export type Toast = { id: string; kind: ToastKind; message: string };

export type DialogAction = {
  label: string;
  /** `cancel` renders as the muted button at the bottom; `destructive` and `default` render as accent. */
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

interface FeedbackStore {
  toasts: Toast[];
  dialog: DialogOptions | null;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  showDialog: (d: DialogOptions) => void;
  dismissDialog: () => void;
}

let seq = 0;

export const useFeedbackStore = create<FeedbackStore>((set) => ({
  toasts: [],
  dialog: null,
  pushToast: (t) =>
    set((s) => ({ toasts: [...s.toasts, { ...t, id: `toast_${Date.now()}_${seq++}` }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  showDialog: (d) => set({ dialog: d }),
  dismissDialog: () => set({ dialog: null }),
}));

/**
 * Imperative feedback helpers — the in-app replacement for `Alert.alert`.
 * Rendered by `<FeedbackHost />` in the root layout.
 *
 *   toast.error('Could not save your number.');
 *   showDialog({ title: 'Cancel trip?', actions: [{ label: 'No', style: 'cancel' }, { label: 'Yes, cancel', style: 'destructive', onPress }] });
 */
export const toast = {
  info: (message: string) => useFeedbackStore.getState().pushToast({ kind: 'info', message }),
  success: (message: string) => useFeedbackStore.getState().pushToast({ kind: 'success', message }),
  error: (message: string) => useFeedbackStore.getState().pushToast({ kind: 'error', message }),
};

export const showDialog = (d: DialogOptions) => useFeedbackStore.getState().showDialog(d);
