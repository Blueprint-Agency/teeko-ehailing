// client/notifications.ts
// Rider notification inbox. Mirrors apps/backend/src/api/rider/notifications.routes.ts.

import { api } from './_fetch';

export interface NotificationItem {
  id: string;
  category: 'trip' | 'promo' | 'account' | 'payment' | 'system' | 'broadcast' | 'evp' | 'doc_expiry' | 'payout' | 'suspension' | 'incentive' | string;
  title: string;
  body: string;
  deeplink?: string | null;
  refId?: string | null;
  createdAt: string;
  readAt?: string | null;
}

/** Fetch all inbox notifications for the signed-in rider. */
export async function listInbox(): Promise<NotificationItem[]> {
  return api<NotificationItem[]>('/api/v1/rider/notifications');
}

/** Mark a single notification as read. */
export async function markRead(id: string): Promise<void> {
  return api<void>(`/api/v1/rider/notifications/${id}/read`, { method: 'PATCH' });
}

/** Mark all notifications as read. */
export async function markAllRead(): Promise<void> {
  return api<void>('/api/v1/rider/notifications/read-all', { method: 'PATCH' });
}
