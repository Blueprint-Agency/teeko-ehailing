'use client';
import { create } from 'zustand';
import { adminApi, type AdminUser, type NewAdmin } from '@/lib/api';

export type { AdminUser, NewAdmin };

interface AdminUsersState {
  admins: AdminUser[];
  loading: boolean;
  loaded: boolean;
  error: string;
  loadAdmins: (force?: boolean) => Promise<void>;
  createAdmin: (input: NewAdmin) => Promise<void>;
  deactivateAdmin: (id: string) => Promise<void>;
}

export const useAdminUsersStore = create<AdminUsersState>()((set, get) => ({
  admins: [],
  loading: false,
  loaded: false,
  error: '',
  loadAdmins: async (force = false) => {
    if (get().loading) return;
    if (get().loaded && !force) return;
    set({ loading: true, error: '' });
    try {
      const admins = await adminApi.getAdmins();
      set({ admins, loaded: true });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to load admin users' });
    } finally {
      set({ loading: false });
    }
  },
  createAdmin: async (input) => {
    const admin = await adminApi.createAdmin(input);
    set((s) => ({ admins: [admin, ...s.admins] }));
  },
  deactivateAdmin: async (id) => {
    await adminApi.deactivateAdmin(id);
    set((s) => ({
      admins: s.admins.map((a) => (a.id === id ? { ...a, status: 'inactive' } : a)),
    }));
  },
}));
