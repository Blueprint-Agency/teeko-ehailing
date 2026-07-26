import type { ApplicationStatus, DocumentState, DriverProfile, Notification } from '@teeko/shared/types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
export const PREFIX = `${BASE}/api/v1/driver-web`

// Clerk owns the session. `lib/api` isn't a React hook, so a client component
// (components/ClerkTokenBridge) registers Clerk's getToken here on mount and
// every request picks the current token up from it.
type TokenGetter = () => Promise<string | null>
let tokenGetter: TokenGetter | null = null

export function setTokenGetter(fn: TokenGetter | null) {
  tokenGetter = fn
}

// Local/staging escape hatch matching the backend's DEV_AUTH_BYPASS: send
// X-Teeko-User instead of a real Clerk token. Off unless explicitly enabled.
const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true'

export async function authHeaders(driverId?: string): Promise<HeadersInit> {
  const headers: Record<string, string> = {}
  const token = tokenGetter ? await tokenGetter() : null
  if (token) {
    headers.Authorization = `Bearer ${token}`
  } else if (DEV_BYPASS && driverId) {
    headers['X-Teeko-User'] = driverId
    headers['X-Teeko-Role'] = 'driver'
  }
  return headers
}

async function request<T>(
  path: string,
  init: RequestInit & { driverId?: string } = {},
): Promise<T> {
  const { driverId, headers, ...rest } = init
  const res = await fetch(`${PREFIX}${path}`, {
    ...rest,
    headers: { ...(await authHeaders(driverId)), ...(headers as Record<string, string>) },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || `${rest.method ?? 'GET'} ${path} → ${res.status}`)
  }
  return res.json() as Promise<T>
}

const get = <T>(path: string, driverId?: string) => request<T>(path, { driverId })

const patch = <T>(path: string, driverId?: string) =>
  request<T>(path, { method: 'PATCH', driverId })

const postJson = <T>(path: string, driverId?: string, body: unknown = {}) =>
  request<T>(path, {
    method: 'POST',
    driverId,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export type DriverMe = {
  user: {
    id: string
    email: string | null
    emailVerified: boolean
    fullName: string | null
    status: 'active' | 'suspended' | 'deactivated'
    pdpaConsentAt: string | null
  }
  driverProfile: { approvalStatus: string }
  application: { state: string; rejectionReason: string | null; submittedAt: string | null } | null
}

export const api = {
  // Resolves the Clerk session into our driver row, provisioning it on first
  // call. Replaces the old loginDriver/registerDriver endpoints — Clerk creates
  // the credential, this mirrors it into our tables.
  getMe: () => get<DriverMe>('/auth/me'),

  // PDPA 2010 consent, recorded on our side (not in Clerk metadata) so the
  // consent trail stays with us for APAD/JPJ. First consent wins.
  acceptConsent: () => postJson<{ ok: boolean }>('/auth/consent'),

  sendOtp: () => postJson<{ ok: boolean }>('/auth/send-otp'),

  verifyOtp: (code: string) => postJson<{ ok: boolean }>('/auth/verify-otp', undefined, { code }),

  getAccount: (id: string) => get<DriverProfile>('/account', id),

  getStatus: (id: string) => get<ApplicationStatus>('/status', id),

  getDocuments: (id: string) =>
    get<{ personal: DocumentState[]; vehicle: DocumentState[] }>('/documents', id),

  getNotifications: (id: string) => get<Notification[]>('/notifications', id),

  markNotificationRead: (id: string, notifId: string) =>
    patch<{ ok: boolean }>(`/notifications/${notifId}/read`, id),

  markAllNotificationsRead: (id: string) => patch<{ ok: boolean }>('/notifications/read-all', id),

  getApplication: (id: string) =>
    get<{ state: string; currentStep: number; rejectionReason?: string | null }>('/application', id),

  submitApplication: (id: string) =>
    postJson<{ ok: boolean; state: string; submittedAt: string | null }>('/application/submit', id),

  // Batch onboarding submit: sends vehicle details + all document files in one
  // multipart request. This is the only onboarding call that writes to the DB.
  submitOnboarding: async (
    driverId: string,
    vehicle: {
      plateNumber: string
      make: string
      model: string
      year: number
      colour: string
    },
    files: Record<string, File>,
  ) => {
    const formData = new FormData()
    formData.append('vehicle', JSON.stringify(vehicle))
    for (const [docId, file] of Object.entries(files)) {
      formData.append(docId, file, file.name)
    }
    // No Content-Type — the browser sets the multipart boundary.
    return request<{ ok: boolean; state: string; submittedAt: string | null }>(
      '/application/onboard',
      { method: 'POST', driverId, body: formData },
    )
  },

  acceptAgreement: (id: string) => postJson<{ ok: boolean }>('/agreement/accept', id),

  uploadDocument: async (kind: string, file: File, driverId: string) => {
    const formData = new FormData()
    formData.append('file', file)
    return request<{ url: string }>(`/documents/${kind}/upload`, {
      method: 'POST',
      driverId,
      body: formData,
    })
  },

  addVehicle: (
    driverId: string,
    details: {
      plateNumber: string
      make: string
      model: string
      year: number
      colour: string
      category?: 'go' | 'comfort' | 'xl' | 'premium' | 'bike'
    },
  ) =>
    postJson<{
      id: string
      plateNumber: string
      make: string
      model: string
      year: number
      colour: string
      category: string
    }>('/vehicles', driverId, details),
}
