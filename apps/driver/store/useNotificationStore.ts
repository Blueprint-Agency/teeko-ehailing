import { create } from 'zustand';

import { api, type DriverNotification } from '../lib/api';

interface NotificationStore {
  items: DriverNotification[];
  loading: boolean;
  error: string | null;
  /**
   * IDs tapped this session. Read state is written server-side, but the loaded
   * rows keep their stale `readAt` until the next load — this covers the gap.
   */
  localRead: string[];
  load: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
  isRead: (n: DriverNotification) => boolean;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  items: [],
  loading: true,
  error: null,
  localRead: [],

  async load() {
    try {
      set({ error: null });
      set({ items: await api.notifications.list() });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  // Both mutations are optimistic: the dot stays cleared even if the PATCH
  // fails, and the next load reconciles.
  markRead(id) {
    set((s) => (s.localRead.includes(id) ? s : { ...s, localRead: [...s.localRead, id] }));
    void api.notifications.markRead(id).catch(() => null);
  },

  markAllRead() {
    set((s) => ({ localRead: s.items.map((n) => n.id) }));
    void api.notifications.markAllRead().catch(() => null);
  },

  isRead(n) {
    return !!n.readAt || get().localRead.includes(n.id);
  },

  unreadCount() {
    const { items, localRead } = get();
    return items.filter((n) => !n.readAt && !localRead.includes(n.id)).length;
  },
}));
