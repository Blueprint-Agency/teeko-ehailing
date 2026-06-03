'use client';
import { create } from 'zustand';
import notifsData from '@/data/mock-notifications.json';

export interface Notification {
  id: string; segment: string; title: string; message: string;
  sentAt: string; sentBy: string; reach: number;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id' | 'sentAt'>) => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: notifsData as Notification[],
  addNotification: (n) =>
    set((s) => ({
      notifications: [
        { ...n, id: `n${Date.now()}`, sentAt: new Date().toISOString() },
        ...s.notifications,
      ],
    })),
}));
