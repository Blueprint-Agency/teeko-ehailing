import type { ApplicationStatus, DocumentState, DriverProfile, Notification } from '@teeko/shared/types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
const PREFIX = `${BASE}/api/v1/driver-web`

function devHeaders(driverId: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Teeko-User': driverId,
    'X-Teeko-Role': 'driver',
  }
}

async function get<T>(path: string, driverId: string): Promise<T> {
  const res = await fetch(`${PREFIX}${path}`, { headers: devHeaders(driverId) })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

async function patch<T>(path: string, driverId: string): Promise<T> {
  const res = await fetch(`${PREFIX}${path}`, {
    method: 'PATCH',
    headers: devHeaders(driverId),
  })
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

export const api = {
  getAccount: (id: string) => get<DriverProfile>('/account', id),

  getStatus: (id: string) => get<ApplicationStatus>('/status', id),

  getDocuments: (id: string) =>
    get<{ personal: DocumentState[]; vehicle: DocumentState[] }>('/documents', id),

  getNotifications: (id: string) => get<Notification[]>('/notifications', id),

  markNotificationRead: (id: string, notifId: string) =>
    patch<{ ok: boolean }>(`/notifications/${notifId}/read`, id),

  markAllNotificationsRead: (id: string) =>
    patch<{ ok: boolean }>('/notifications/read-all', id),

  getApplication: (id: string) =>
    get<{ state: string; currentStep: number; rejectionReason?: string | null }>('/application', id),

  acceptAgreement: (id: string) =>
    fetch(`${PREFIX}/agreement/accept`, {
      method: 'POST',
      headers: devHeaders(id),
    }).then((r) => r.json()),
}
