// stores/notification-store.ts
// Rider notification inbox store.

import { create } from 'zustand';

import * as notificationsApi from '../client/notifications';
import type { NotificationItem } from '../client/notifications';

export type NotificationState = {
  items: NotificationItem[];
  loading: boolean;
  error: string | null;
  /** IDs of notifications the user has tapped (optimistic local read state). */
  localRead: Set<string>;
  load: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  localRead: new Set(),

  async load() {
    set({ loading: true, error: null });
    try {
      const items = await notificationsApi.listInbox();
      set({ items, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  async markRead(id) {
    // Optimistic update first
    set((s) => ({ localRead: new Set([...s.localRead, id]) }));
    try {
      await notificationsApi.markRead(id);
      // Persist server state into items
      set((s) => ({
        items: s.items.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      }));
    } catch {
      // ignore — optimistic read stays; will reconcile on next load
    }
  },

  async markAllRead() {
    const now = new Date().toISOString();
    set((s) => ({
      localRead: new Set(s.items.map((n) => n.id)),
      items: s.items.map((n) => ({ ...n, readAt: n.readAt ?? now })),
    }));
    try {
      await notificationsApi.markAllRead();
    } catch {
      // ignore
    }
  },
}));
