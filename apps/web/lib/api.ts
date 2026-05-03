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

  uploadDocument: async (kind: string, file: File, driverId: string) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${PREFIX}/documents/${kind}/upload`, {
      method: 'POST',
      headers: { 'X-Teeko-User': driverId, 'X-Teeko-Role': 'driver' },
      body: formData,
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(error.error || `POST /documents/${kind}/upload → ${res.status}`)
    }
    return res.json() as Promise<{ url: string }>
  },

  loginDriver: async (phone: string) => {
    const res = await fetch(`${PREFIX}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(error.error || `POST /auth/login → ${res.status}`)
    }
    return res.json() as Promise<{ message: string; devOtp?: string }>
  },

  verifyOtp: async (phone: string, code: string) => {
    const res = await fetch(`${PREFIX}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(error.error || `POST /auth/verify → ${res.status}`)
    }
    return res.json() as Promise<{ id: string; phone: string; fullName: string; locale: string }>
  },

  sendRegisterOtp: async (phone: string) => {
    const res = await fetch(`${PREFIX}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(error.error || `POST /auth/register → ${res.status}`)
    }
    return res.json() as Promise<{ message: string; devOtp?: string }>
  },

  verifyRegister: async (phone: string, code: string, fullName: string) => {
    const res = await fetch(`${PREFIX}/auth/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, fullName }),
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(error.error || `POST /auth/register/verify → ${res.status}`)
    }
    return res.json() as Promise<{ id: string; phone: string; fullName: string }>
  },
}
